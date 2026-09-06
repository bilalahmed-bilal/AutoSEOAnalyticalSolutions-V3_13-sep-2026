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

-- One owner per workspace. Existing bad data must be corrected before this index.
create unique index if not exists uq_workspace_single_owner
on public.workspace_members(workspace_id)
where role = 'owner';

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

-- Useful production diagnostics, exposed only to trusted service role.
create or replace function public.recover_stale_jobs(stale_after interval default interval '15 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare recovered integer;
begin
  update public.jobs
     set status = 'queued',
         locked_at = null,
         locked_by = null,
         run_after = now(),
         last_error = coalesce(last_error || E'\n', '') || 'Recovered stale worker lock.',
         updated_at = now()
   where status = 'running'
     and locked_at is not null
     and locked_at < now() - stale_after;
  get diagnostics recovered = row_count;
  return recovered;
end;
$$;
revoke all on function public.recover_stale_jobs(interval) from public;
grant execute on function public.recover_stale_jobs(interval) to service_role;

-- Service-side event history for operational debugging.
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
  unique(job_id, attempt)
);
create index if not exists idx_job_attempts_job on public.job_attempts(job_id, attempt desc);
alter table public.job_attempts enable row level security;

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
create unique index if not exists uq_active_publish_draft
on public.jobs((payload->>'draftId'))
where type = 'publish_draft' and status in ('queued','running');
