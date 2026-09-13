-- AutoSEO V11: data integrity, atomic operations, lifecycle protection.
-- Run AFTER schema.sql, v6-queue.sql and v10-security.sql.

-- Keep mutable timestamps consistent across server-side updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_connections_updated_at on public.connections;
create trigger trg_connections_updated_at
before update on public.connections
for each row execute function public.set_updated_at();

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

-- One owner per workspace. Skip rather than fail if historical duplicates exist.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'uq_workspace_single_owner'
  ) and not exists (
    select 1 from public.workspace_members
    where role = 'owner'
    group by workspace_id
    having count(*) > 1
  ) then
    execute 'create unique index uq_workspace_single_owner on public.workspace_members(workspace_id) where role = ''owner''';
  elsif exists (
    select 1 from public.workspace_members
    where role = 'owner'
    group by workspace_id
    having count(*) > 1
  ) then
    raise notice 'uq_workspace_single_owner skipped; multiple owners exist';
  end if;
end $$;

-- Protect immutable identity fields after creation.
create or replace function public.prevent_workspace_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at then
    raise exception 'workspace identity fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_workspace_identity on public.workspaces;
create trigger trg_workspace_identity
before update on public.workspaces
for each row execute function public.prevent_workspace_identity_change();

-- Audit rows are append-only. Only trusted service_role/server code should delete them.
create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit logs are immutable';
end;
$$;

drop trigger if exists trg_audit_immutable_update on public.audit_logs;
create trigger trg_audit_immutable_update
before update on public.audit_logs
for each row execute function public.prevent_audit_mutation();

drop trigger if exists trg_audit_immutable_delete on public.audit_logs;
create trigger trg_audit_immutable_delete
before delete on public.audit_logs
for each row execute function public.prevent_audit_mutation();

-- Valid job lifecycle transitions. Claim/complete/fail functions remain the normal path.
create or replace function public.enforce_job_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'succeeded' and new.status <> 'succeeded' then
    raise exception 'succeeded job cannot transition';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'cancelled job cannot transition';
  end if;
  if old.status = 'running' and new.status = 'queued' and new.run_after is null then
    raise exception 'retrying job requires run_after';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_job_transition on public.jobs;
create trigger trg_job_transition
before update on public.jobs
for each row execute function public.enforce_job_transition();

-- Atomic workspace creation: workspace + owner membership in one transaction.
create or replace function public.create_workspace_atomic(workspace_name text, workspace_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.workspaces;
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'authentication required'; end if;
  if length(trim(workspace_name)) < 2 or length(trim(workspace_name)) > 80 then
    raise exception 'invalid workspace name';
  end if;
  if workspace_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid workspace slug';
  end if;

  insert into public.workspaces(name, slug)
  values (trim(workspace_name), lower(workspace_slug))
  returning * into created;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (created.id, caller, 'owner');

  return created;
end;
$$;

revoke all on function public.create_workspace_atomic(text, text) from public;
grant execute on function public.create_workspace_atomic(text, text) to authenticated;

-- recover_stale_jobs(interval) is defined once in v6-queue.sql with the canonical
-- p_stale_after signature expected by app/api/cron/autoseo/route.ts.

-- Canonical table for fresh DBs that skipped v6; no-op when the table already exists.
create table if not exists public.job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  attempt integer not null check (attempt > 0),
  worker_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','succeeded','failed')),
  error_message text,
  provider_job_id text,
  provider_link text,
  created_at timestamptz not null default now(),
  unique (job_id, attempt)
);

-- Reconcile any existing job_attempts shape (including tables that lack created_at
-- or use attempt_no) BEFORE indexes, triggers, or policies reference those columns.
-- ADD COLUMN IF NOT EXISTS never drops rows.
alter table public.job_attempts add column if not exists job_id uuid;
alter table public.job_attempts add column if not exists workspace_id uuid;
alter table public.job_attempts add column if not exists attempt integer;
alter table public.job_attempts add column if not exists worker_id text;
alter table public.job_attempts add column if not exists started_at timestamptz;
alter table public.job_attempts add column if not exists finished_at timestamptz;
alter table public.job_attempts add column if not exists status text;
alter table public.job_attempts add column if not exists error_message text;
alter table public.job_attempts add column if not exists provider_job_id text;
alter table public.job_attempts add column if not exists provider_link text;
alter table public.job_attempts add column if not exists created_at timestamptz;

-- Copy legacy attempt_no into attempt without requiring attempt_no to exist.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_attempts' and column_name = 'attempt_no'
  ) then
    execute 'update public.job_attempts set attempt = attempt_no where attempt is null';
  end if;
end $$;

-- Backfill timestamps using only columns that now exist.
update public.job_attempts
   set created_at = coalesce(created_at, started_at, now())
 where created_at is null;
update public.job_attempts
   set started_at = coalesce(started_at, created_at, now())
 where started_at is null;

alter table public.job_attempts alter column created_at set default now();
alter table public.job_attempts alter column started_at set default now();
do $$
begin
  alter table public.job_attempts alter column created_at set not null;
exception when others then
  raise notice 'job_attempts.created_at left nullable; existing nulls could not be tightened';
end $$;
do $$
begin
  alter table public.job_attempts alter column started_at set not null;
exception when others then
  raise notice 'job_attempts.started_at left nullable; existing nulls could not be tightened';
end $$;

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'job_attempts'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~* 'status'
  loop
    execute format('alter table public.job_attempts drop constraint if exists %I', r.conname);
  end loop;
  begin
    alter table public.job_attempts
      add constraint job_attempts_status_check
      check (status in ('running','succeeded','failed'));
  exception when check_violation or duplicate_object then
    raise notice 'job_attempts status check skipped to avoid failing on existing rows';
  end;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_attempts' and column_name = 'attempt'
  ) and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_attempts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* 'attempt'
      and pg_get_constraintdef(oid) !~* 'status'
  ) then
    begin
      alter table public.job_attempts
        add constraint job_attempts_attempt_check check (attempt > 0);
    exception when check_violation then
      raise notice 'job_attempts.attempt > 0 check skipped to avoid failing on existing rows';
    end;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_attempts' and column_name = 'attempt'
  ) and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_attempts'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%(job_id, attempt)%'
  ) then
    begin
      alter table public.job_attempts
        add constraint job_attempts_job_id_attempt_key unique (job_id, attempt);
    exception when unique_violation then
      raise notice 'job_attempts unique(job_id, attempt) skipped; duplicate rows were left untouched';
    end;
  end if;
end $$;

-- Recreate indexes only after canonical columns exist.
drop index if exists public.idx_job_attempts_job;
drop index if exists public.idx_job_attempts_workspace;
create index if not exists idx_job_attempts_job on public.job_attempts(job_id, attempt desc);
create index if not exists idx_job_attempts_workspace on public.job_attempts(workspace_id, created_at desc);
alter table public.job_attempts enable row level security;

drop policy if exists job_attempts_select on public.job_attempts;
create policy job_attempts_select on public.job_attempts
for select using (
  exists (
    select 1 from public.jobs j
    where j.id = job_attempts.job_id
      and j.workspace_id = job_attempts.workspace_id
      and public.is_workspace_member(j.workspace_id)
  )
);
-- No client insert/update/delete policies: attempts are written by trusted worker code.

-- Prevent duplicate active publish jobs even if an idempotency key is accidentally changed.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'uq_active_publish_draft'
  ) then
    if exists (
      select 1
      from public.jobs
      where type = 'publish_draft'
        and status in ('queued','running')
        and payload->>'draftId' is not null
      group by payload->>'draftId'
      having count(*) > 1
    ) then
      raise notice 'uq_active_publish_draft skipped; duplicate active publish jobs exist';
    else
      execute $idx$
        create unique index uq_active_publish_draft
        on public.jobs((payload->>'draftId'))
        where type = 'publish_draft' and status in ('queued','running')
      $idx$;
    end if;
  end if;
end $$;
