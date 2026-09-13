-- ============================================================
-- AutoSEO — Combined migration (run this once in Supabase SQL Editor)
-- Canonical, idempotent path through V44. Safe for a fresh database
-- and for a database that already has the initial schema tables:
-- workspaces, workspace_members, connections, drafts, seo_score_history,
-- jobs, audit_logs, calendar_items, job_attempts.
--
-- This file does not delete application data.
-- Do not run against production until you have a backup.
-- Generated from versioned supabase/*.sql files in dependency order.
-- There is no V38 or V43 SQL file (those versions are application-only).
--
-- CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
-- job_attempts indexes/policies are created only after V11 column reconciliation.
-- ============================================================


-- ==================== schema.sql ====================
-- AutoSEO production foundation: PostgreSQL/Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('wordpress','shopify','custom','youtube','facebook','google-search-console')),
  display_name text,
  encrypted_credentials text not null,
  status text not null default 'active' check (status in ('active','degraded','revoked','error')),
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel text not null,
  kind text not null,
  title text not null,
  body text not null,
  meta_description text,
  video_id text,
  target_url text,
  suggested_headings jsonb,
  schema_jsonld text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  published_url text,
  error_message text
);

create table if not exists public.seo_score_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  url text not null,
  score integer not null check (score between 0 and 100),
  deterministic_score integer check (deterministic_score between 0 and 100),
  ai_score integer check (ai_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  idempotency_key text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  provider_job_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_drafts_workspace on public.drafts(workspace_id, created_at desc);
create index if not exists idx_seo_history_workspace on public.seo_score_history(workspace_id, created_at desc);
create index if not exists idx_jobs_due on public.jobs(status, run_after);
create index if not exists idx_audit_workspace on public.audit_logs(workspace_id, created_at desc);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.connections enable row level security;
alter table public.drafts enable row level security;
alter table public.seo_score_history enable row level security;
alter table public.jobs enable row level security;
alter table public.audit_logs enable row level security;

-- Membership helper. SECURITY DEFINER avoids recursive policy evaluation.
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin')
  );
$$;

drop policy if exists workspace_select on public.workspaces;
create policy workspace_select on public.workspaces for select using (public.is_workspace_member(id));

drop policy if exists member_select on public.workspace_members;
create policy member_select on public.workspace_members for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

drop policy if exists connection_all on public.connections;
create policy connection_all on public.connections for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists draft_all on public.drafts;
create policy draft_all on public.drafts for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists seo_history_all on public.seo_score_history;
create policy seo_history_all on public.seo_score_history for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists jobs_all on public.jobs;
create policy jobs_all on public.jobs for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select using (workspace_id is null or public.is_workspace_member(workspace_id));

-- Inserts into audit logs should normally happen through trusted server code.
-- A production deployment should additionally restrict direct client inserts.

create table if not exists public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel text not null,
  topic text not null,
  scheduled_date date not null,
  status text not null default 'planned' check (status in ('planned','generated','failed')),
  created_at timestamptz not null default now(),
  result_draft_id uuid references public.drafts(id) on delete set null,
  error_message text
);
create index if not exists idx_calendar_workspace_date on public.calendar_items(workspace_id, scheduled_date);
alter table public.calendar_items enable row level security;
drop policy if exists calendar_all on public.calendar_items;
create policy calendar_all on public.calendar_items for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));


-- ==================== v6-queue.sql ====================
-- V6 durable queue additions. Run after supabase/schema.sql.

create or replace function public.claim_next_job(p_worker_id text)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.jobs;
begin
  with candidate as (
    select id
    from public.jobs
    where status = 'queued'
      and run_after <= now()
    order by run_after asc, created_at asc
    for update skip locked
    limit 1
  )
  update public.jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         locked_at = now(),
         locked_by = p_worker_id,
         updated_at = now()
    from candidate c
   where j.id = c.id
   returning j.* into claimed;

  if claimed.id is not null then
    return next claimed;
  end if;
  return;
end;
$$;

revoke all on function public.claim_next_job(text) from public;
grant execute on function public.claim_next_job(text) to service_role;

create index if not exists idx_jobs_running_lock on public.jobs(status, locked_at);

-- Canonical stale-job recovery. Parameter name must stay p_stale_after (cron RPC).
-- Honors max_attempts and sets run_after so enforce_job_transition() allows re-queue.
drop function if exists public.recover_stale_jobs(interval);
create function public.recover_stale_jobs(p_stale_after interval default interval '10 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare recovered integer;
begin
  update public.jobs
     set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
         locked_at = null,
         locked_by = null,
         run_after = case when attempts >= max_attempts then run_after else now() end,
         last_error = coalesce(last_error, 'Worker lock expired; job recovered automatically.'),
         updated_at = now()
   where status = 'running'
     and locked_at is not null
     and locked_at < now() - p_stale_after;
  get diagnostics recovered = row_count;
  return recovered;
end;
$$;
revoke all on function public.recover_stale_jobs(interval) from public;
grant execute on function public.recover_stale_jobs(interval) to service_role;

-- Canonical job_attempts schema for a fresh database.
-- If public.job_attempts already exists (partial production), CREATE TABLE IF NOT EXISTS
-- is a no-op and does not add columns. Do not create indexes or policies here: they can
-- reference columns the existing table does not have (for example created_at / attempt).
-- v11-data-integrity.sql reconciles columns first, then creates indexes and policies.
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
alter table public.job_attempts enable row level security;


-- ==================== v10-security.sql ====================
-- V10 security hardening. Run after schema.sql and v6-queue.sql.
-- Canonical workspace roles are owner/admin/editor/viewer.

-- Remove any legacy role values before enforcing the canonical set.
update public.workspace_members set role = 'editor' where role = 'staff';

alter table public.workspace_members
  drop constraint if exists workspace_members_role_check;
do $$
begin
  alter table public.workspace_members
    add constraint workspace_members_role_check
    check (role in ('owner','admin','editor','viewer'));
exception when duplicate_object then
  null;
end $$;

-- Prevent owners from being removed or demoted by ordinary member APIs.
create or replace function public.prevent_owner_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner' then
    if tg_op = 'DELETE' then
      raise exception 'owner membership cannot be deleted';
    elsif new.role <> 'owner' then
      raise exception 'owner membership cannot be demoted';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prevent_owner_membership_change on public.workspace_members;
create trigger trg_prevent_owner_membership_change
before update or delete on public.workspace_members
for each row execute function public.prevent_owner_membership_change();

-- Audit log entries are append-only from the client perspective.
drop policy if exists audit_insert on public.audit_logs;
drop policy if exists audit_update on public.audit_logs;
drop policy if exists audit_delete on public.audit_logs;
create policy audit_insert on public.audit_logs for insert
  with check (actor_user_id = auth.uid() and (workspace_id is null or public.is_workspace_member(workspace_id)));

-- No client UPDATE/DELETE policy is intentionally created.

create index if not exists idx_connections_health
  on public.connections(workspace_id, status, last_checked_at desc);
create index if not exists idx_jobs_workspace_status
  on public.jobs(workspace_id, status, updated_at desc);


-- ==================== v11-data-integrity.sql ====================
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


-- ==================== v12-oauth.sql ====================
-- V12 OAuth connection lifecycle
create table if not exists public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  provider text not null check (provider in ('google-youtube','facebook')),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_oauth_states_expiry on public.oauth_states(expires_at);
alter table public.oauth_states enable row level security;
-- OAuth states are created/consumed only by trusted server code.
revoke all on public.oauth_states from anon, authenticated;

-- Extra connection metadata for token lifecycle.
alter table public.connections add column if not exists token_expires_at timestamptz;
alter table public.connections add column if not exists last_token_refresh_at timestamptz;
alter table public.connections add column if not exists display_name text;

-- Remove expired one-time OAuth states. Run from a trusted scheduler if desired.
create or replace function public.cleanup_expired_oauth_states()
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  delete from public.oauth_states where expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.cleanup_expired_oauth_states() from public;
grant execute on function public.cleanup_expired_oauth_states() to service_role;


-- ==================== v13-provider-lifecycle.sql ====================
-- V13 provider lifecycle: health timestamps, safe connection uniqueness, and cleanup.
alter table public.connections add column if not exists last_checked_at timestamptz;
create index if not exists idx_connections_health on public.connections(workspace_id, status, last_checked_at);

-- Prevent multiple active connections for the same workspace/provider while retaining revoked history.
create unique index if not exists uq_active_connection_provider
on public.connections(workspace_id, provider)
where status <> 'revoked';

-- Service-role cleanup for OAuth states and old health metadata.
create or replace function public.cleanup_oauth_and_connection_metadata()
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  delete from public.oauth_states where expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.cleanup_oauth_and_connection_metadata() from public;
grant execute on function public.cleanup_oauth_and_connection_metadata() to service_role;


-- ==================== v18-optimization-versioning.sql ====================
-- V18: human-in-the-loop optimization versioning and rollback support
create table if not exists public.draft_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  version_number integer not null,
  source text not null default 'ai_optimization' check (source in ('original','ai_optimization','manual')),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','applied','rolled_back')),
  original_content jsonb not null,
  optimized_content jsonb not null,
  change_decisions jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  applied_at timestamptz,
  unique (draft_id, version_number)
);

create index if not exists idx_draft_versions_workspace on public.draft_versions(workspace_id, created_at desc);
create index if not exists idx_draft_versions_draft on public.draft_versions(draft_id, version_number desc);

alter table public.draft_versions enable row level security;
drop policy if exists draft_versions_select on public.draft_versions;
create policy draft_versions_select on public.draft_versions for select using (public.is_workspace_member(workspace_id));
drop policy if exists draft_versions_insert on public.draft_versions;
create policy draft_versions_insert on public.draft_versions for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists draft_versions_update on public.draft_versions;
create policy draft_versions_update on public.draft_versions for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- A database guard prevents deleting version history from the client.
create or replace function public.prevent_draft_version_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'draft_versions are immutable; use rollback status instead of delete';
end;
$$;
drop trigger if exists trg_prevent_draft_version_delete on public.draft_versions;
create trigger trg_prevent_draft_version_delete before delete on public.draft_versions
for each row execute function public.prevent_draft_version_delete();


-- ==================== v19-rollback.sql ====================
-- V19: reversible publishing and rollback history
create table if not exists public.draft_publication_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  version_id uuid references public.draft_versions(id) on delete set null,
  event_type text not null check (event_type in ('published','rollback_requested','rollback_published','rollback_failed')),
  snapshot jsonb not null,
  published_url text,
  job_id uuid references public.jobs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pub_history_draft on public.draft_publication_history(draft_id, created_at desc);
create index if not exists idx_pub_history_workspace on public.draft_publication_history(workspace_id, created_at desc);

alter table public.draft_publication_history enable row level security;
drop policy if exists draft_publication_history_select on public.draft_publication_history;
create policy draft_publication_history_select on public.draft_publication_history for select using (public.is_workspace_member(workspace_id));
drop policy if exists draft_publication_history_insert on public.draft_publication_history;
create policy draft_publication_history_insert on public.draft_publication_history for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists draft_publication_history_update on public.draft_publication_history;
create policy draft_publication_history_update on public.draft_publication_history for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop policy if exists draft_publication_history_delete on public.draft_publication_history;
create policy draft_publication_history_delete on public.draft_publication_history for delete using (false);

-- Version rollback metadata. A rollback is represented by a new immutable version.
alter table public.draft_versions add column if not exists rollback_of_version_id uuid references public.draft_versions(id) on delete set null;
create index if not exists idx_draft_versions_rollback on public.draft_versions(rollback_of_version_id);

create or replace function public.prevent_draft_publication_history_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'draft_publication_history is immutable';
end;
$$;
drop trigger if exists trg_prevent_draft_publication_history_update on public.draft_publication_history;
create trigger trg_prevent_draft_publication_history_update before update on public.draft_publication_history for each row execute function public.prevent_draft_publication_history_mutation();
drop trigger if exists trg_prevent_draft_publication_history_delete on public.draft_publication_history;
create trigger trg_prevent_draft_publication_history_delete before delete on public.draft_publication_history for each row execute function public.prevent_draft_publication_history_mutation();


-- ==================== v20-analytics.sql ====================
-- V20: analytics snapshots for Search Console + channel performance.
create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, period_start, period_end)
);
create index if not exists idx_analytics_snapshots_workspace on public.analytics_snapshots(workspace_id, created_at desc);
alter table public.analytics_snapshots enable row level security;
drop policy if exists analytics_snapshots_select on public.analytics_snapshots;
create policy analytics_snapshots_select on public.analytics_snapshots for select using (public.is_workspace_member(workspace_id));
-- Snapshot writes are performed by trusted server code using service role.

-- Existing V12 databases need the provider check expanded as well.
alter table public.connections drop constraint if exists connections_provider_check;
do $$
begin
  alter table public.connections add constraint connections_provider_check check (provider in ('wordpress','shopify','custom','youtube','facebook','google-search-console'));
exception when duplicate_object then
  null;
end $$;
alter table public.oauth_states drop constraint if exists oauth_states_provider_check;
do $$
begin
  alter table public.oauth_states add constraint oauth_states_provider_check check (provider in ('google-youtube','google-search-console','facebook'));
exception when duplicate_object then
  null;
end $$;


-- ==================== v21-attribution.sql ====================
-- V21: optional persisted attribution reports. Reports are immutable snapshots of a comparison.
create table if not exists public.attribution_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  target_url text not null,
  publication_date timestamptz not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_attribution_reports_workspace on public.attribution_reports(workspace_id, created_at desc);
create index if not exists idx_attribution_reports_draft on public.attribution_reports(draft_id, created_at desc);
alter table public.attribution_reports enable row level security;
drop policy if exists attribution_reports_select on public.attribution_reports;
create policy attribution_reports_select on public.attribution_reports for select using (public.is_workspace_member(workspace_id));
drop policy if exists attribution_reports_insert on public.attribution_reports;
create policy attribution_reports_insert on public.attribution_reports for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists attribution_reports_update on public.attribution_reports;
create policy attribution_reports_update on public.attribution_reports for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop policy if exists attribution_reports_delete on public.attribution_reports;
create policy attribution_reports_delete on public.attribution_reports for delete using (false);


-- ==================== v22-experiments.sql ====================
-- V22: sequential SEO experimentation. This is measurement-based, not randomized traffic splitting.
create table if not exists public.seo_experiments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  target_url text not null,
  metric text not null default 'ctr' check (metric in ('ctr','clicks','impressions','position')),
  status text not null default 'draft' check (status in ('draft','running_a','running_b','evaluating','winner_a','winner_b','inconclusive','promoted','stopped')),
  variant_a_version_id uuid not null references public.draft_versions(id),
  variant_b_version_id uuid not null references public.draft_versions(id),
  baseline_start date,
  baseline_end date,
  variant_a_start date,
  variant_a_end date,
  variant_b_start date,
  variant_b_end date,
  min_impressions integer not null default 100,
  min_clicks integer not null default 10,
  confidence_threshold numeric not null default 0.95 check (confidence_threshold > 0 and confidence_threshold < 1),
  min_absolute_ctr_lift numeric not null default 0.01 check (min_absolute_ctr_lift >= 0),
  result jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_seo_experiments_workspace on public.seo_experiments(workspace_id, created_at desc);
create index if not exists idx_seo_experiments_draft on public.seo_experiments(draft_id, created_at desc);

create table if not exists public.experiment_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  experiment_id uuid not null references public.seo_experiments(id) on delete cascade,
  variant text not null check (variant in ('a','b','baseline')),
  period_start date not null,
  period_end date not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric not null default 0,
  average_position numeric,
  created_at timestamptz not null default now(),
  unique(experiment_id, variant, period_start, period_end)
);
create index if not exists idx_experiment_observations_experiment on public.experiment_observations(experiment_id, created_at desc);

alter table public.seo_experiments enable row level security;
alter table public.experiment_observations enable row level security;

drop policy if exists seo_experiments_select on public.seo_experiments;
create policy seo_experiments_select on public.seo_experiments for select using (public.is_workspace_member(workspace_id));
drop policy if exists seo_experiments_insert on public.seo_experiments;
create policy seo_experiments_insert on public.seo_experiments for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists seo_experiments_update on public.seo_experiments;
create policy seo_experiments_update on public.seo_experiments for update using (public.is_workspace_admin(workspace_id) or public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists seo_experiments_delete on public.seo_experiments;
create policy seo_experiments_delete on public.seo_experiments for delete using (public.is_workspace_admin(workspace_id));

drop policy if exists experiment_observations_select on public.experiment_observations;
create policy experiment_observations_select on public.experiment_observations for select using (public.is_workspace_member(workspace_id));
drop policy if exists experiment_observations_insert on public.experiment_observations;
create policy experiment_observations_insert on public.experiment_observations for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists experiment_observations_update on public.experiment_observations;
create policy experiment_observations_update on public.experiment_observations for update using (public.is_workspace_admin(workspace_id) or public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create or replace function public.set_seo_experiment_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_seo_experiment_updated_at on public.seo_experiments;
create trigger trg_seo_experiment_updated_at before update on public.seo_experiments for each row execute function public.set_seo_experiment_updated_at();


-- ==================== v23-keyword-research.sql ====================
-- V23: Advanced keyword research and opportunity intelligence.
create table if not exists public.keyword_research_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  seed_keyword text not null,
  target_url text,
  status text not null default 'ready' check (status in ('draft','running','ready','failed')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.keyword_opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.keyword_research_projects(id) on delete cascade,
  keyword text not null,
  normalized_keyword text not null,
  source text not null check (source in ('seed','related','question','modifier','page','gsc')),
  intent text not null check (intent in ('informational','commercial','transactional','navigational','local','mixed')),
  relevance_score integer not null check (relevance_score between 0 and 100),
  opportunity_score integer not null check (opportunity_score between 0 and 100),
  difficulty_score integer not null check (difficulty_score between 0 and 100),
  content_fit_score integer not null check (content_fit_score between 0 and 100),
  current_signal_score integer not null check (current_signal_score between 0 and 100),
  tier text not null check (tier in ('priority','strong','watch','low')),
  recommended_content_type text not null check (recommended_content_type in ('pillar','landing-page','article','faq','comparison','local-page')),
  recommendation text not null,
  created_at timestamptz not null default now(),
  unique(project_id, normalized_keyword)
);
create index if not exists idx_keyword_projects_workspace on public.keyword_research_projects(workspace_id,created_at desc);
create index if not exists idx_keyword_opportunities_project on public.keyword_opportunities(project_id,opportunity_score desc);
create index if not exists idx_keyword_opportunities_workspace on public.keyword_opportunities(workspace_id,opportunity_score desc);

alter table public.keyword_research_projects enable row level security;
alter table public.keyword_opportunities enable row level security;
drop policy if exists keyword_projects_all on public.keyword_research_projects;
create policy keyword_projects_all on public.keyword_research_projects for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists keyword_opportunities_all on public.keyword_opportunities;
create policy keyword_opportunities_all on public.keyword_opportunities for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create or replace function public.set_keyword_research_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_keyword_research_updated_at on public.keyword_research_projects;
create trigger trg_keyword_research_updated_at before update on public.keyword_research_projects for each row execute function public.set_keyword_research_updated_at();


-- ==================== v24-competitor-intelligence.sql ====================
create extension if not exists pgcrypto;
create table if not exists public.competitor_projects (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, target_url text not null, competitor_urls jsonb not null default '[]'::jsonb,
 keyword_project_id uuid references public.keyword_research_projects(id) on delete set null,
 status text not null default 'ready' check(status in ('ready','running','failed')),
 summary jsonb not null default '{}'::jsonb, analysis jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists competitor_projects_workspace_idx on public.competitor_projects(workspace_id,created_at desc);
alter table public.competitor_projects enable row level security;
drop policy if exists competitor_projects_select on public.competitor_projects;
create policy competitor_projects_select on public.competitor_projects for select using (public.is_workspace_member(workspace_id));
drop policy if exists competitor_projects_insert on public.competitor_projects;
create policy competitor_projects_insert on public.competitor_projects for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists competitor_projects_update on public.competitor_projects;
create policy competitor_projects_update on public.competitor_projects for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists competitor_projects_delete on public.competitor_projects;
create policy competitor_projects_delete on public.competitor_projects for delete using (public.is_workspace_admin(workspace_id));
drop trigger if exists competitor_projects_updated_at on public.competitor_projects;
create trigger competitor_projects_updated_at before update on public.competitor_projects for each row execute function public.set_updated_at();


-- ==================== v25-content-strategy.sql ====================
create extension if not exists pgcrypto;
create table if not exists public.content_strategy_projects (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, keyword_project_id uuid references public.keyword_research_projects(id) on delete set null,
 competitor_project_id uuid references public.competitor_projects(id) on delete set null,
 status text not null default 'ready' check(status in ('ready','running','failed')),
 summary jsonb not null default '{}'::jsonb, strategy jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists content_strategy_workspace_idx on public.content_strategy_projects(workspace_id,created_at desc);
alter table public.content_strategy_projects enable row level security;
drop policy if exists content_strategy_select on public.content_strategy_projects; create policy content_strategy_select on public.content_strategy_projects for select using(public.is_workspace_member(workspace_id));
drop policy if exists content_strategy_insert on public.content_strategy_projects; create policy content_strategy_insert on public.content_strategy_projects for insert with check(public.is_workspace_member(workspace_id));
drop policy if exists content_strategy_update on public.content_strategy_projects; create policy content_strategy_update on public.content_strategy_projects for update using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id));
drop policy if exists content_strategy_delete on public.content_strategy_projects; create policy content_strategy_delete on public.content_strategy_projects for delete using(public.is_workspace_admin(workspace_id));
drop trigger if exists content_strategy_updated_at on public.content_strategy_projects; create trigger content_strategy_updated_at before update on public.content_strategy_projects for each row execute function public.set_updated_at();


-- ==================== v26-content-studio.sql ====================
-- V26 AI Content Production Studio
create table if not exists public.content_studio_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  strategy_project_id uuid references public.content_strategy_projects(id) on delete set null,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_studio_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.content_studio_projects(id) on delete cascade,
  strategy_item jsonb not null default '{}'::jsonb,
  brief jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'brief' check (status in ('brief','generated','queued','published','failed')),
  draft_id uuid references public.drafts(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_studio_projects_workspace on public.content_studio_projects(workspace_id, created_at desc);
create index if not exists idx_content_studio_assets_workspace on public.content_studio_assets(workspace_id, created_at desc);
create index if not exists idx_content_studio_assets_project on public.content_studio_assets(project_id, created_at desc);

alter table public.content_studio_projects enable row level security;
alter table public.content_studio_assets enable row level security;

drop policy if exists content_studio_projects_select on public.content_studio_projects;
drop policy if exists content_studio_projects_insert on public.content_studio_projects;
drop policy if exists content_studio_projects_update on public.content_studio_projects;
drop policy if exists content_studio_assets_select on public.content_studio_assets;
drop policy if exists content_studio_assets_insert on public.content_studio_assets;
drop policy if exists content_studio_assets_update on public.content_studio_assets;

create policy content_studio_projects_select on public.content_studio_projects for select using (is_workspace_member(workspace_id));
create policy content_studio_projects_insert on public.content_studio_projects for insert with check (is_workspace_member(workspace_id));
create policy content_studio_projects_update on public.content_studio_projects for update using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));
create policy content_studio_assets_select on public.content_studio_assets for select using (is_workspace_member(workspace_id));
create policy content_studio_assets_insert on public.content_studio_assets for insert with check (is_workspace_member(workspace_id));
create policy content_studio_assets_update on public.content_studio_assets for update using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));


-- ==================== v27-content-quality.sql ====================
-- V27 Content Quality & Fact Intelligence
create table if not exists public.content_quality_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid references public.content_studio_assets(id) on delete set null,
  draft_id uuid references public.drafts(id) on delete set null,
  score integer not null check (score between 0 and 100),
  verdict text not null check (verdict in ('publish-ready','needs-review','needs-rework')),
  report jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_content_quality_workspace on public.content_quality_reports(workspace_id, created_at desc);
create index if not exists idx_content_quality_asset on public.content_quality_reports(asset_id, created_at desc);
alter table public.content_quality_reports enable row level security;
drop policy if exists content_quality_reports_select on public.content_quality_reports;
drop policy if exists content_quality_reports_insert on public.content_quality_reports;
create policy content_quality_reports_select on public.content_quality_reports for select using (is_workspace_member(workspace_id));
create policy content_quality_reports_insert on public.content_quality_reports for insert with check (is_workspace_member(workspace_id));


-- ==================== v28-technical-seo.sql ====================
-- V28 Technical SEO Automation Engine
create table if not exists public.technical_seo_audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target_url text not null,
  score integer not null check (score between 0 and 100),
  summary jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_technical_seo_workspace on public.technical_seo_audits(workspace_id, created_at desc);
create index if not exists idx_technical_seo_target on public.technical_seo_audits(workspace_id, target_url, created_at desc);
alter table public.technical_seo_audits enable row level security;
drop policy if exists technical_seo_select on public.technical_seo_audits;
drop policy if exists technical_seo_insert on public.technical_seo_audits;
create policy technical_seo_select on public.technical_seo_audits for select using (is_workspace_member(workspace_id));
create policy technical_seo_insert on public.technical_seo_audits for insert with check (is_workspace_member(workspace_id));


-- ==================== v29-site-architecture.sql ====================
-- V29 Internal Linking & Site Architecture Engine
create table if not exists public.site_architecture_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  target_url text not null,
  keyword_project_id uuid references public.keyword_research_projects(id) on delete set null,
  status text not null default 'ready' check (status in ('ready','failed','running')),
  summary jsonb not null default '{}'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_site_architecture_workspace on public.site_architecture_projects(workspace_id, created_at desc);
create index if not exists idx_site_architecture_target on public.site_architecture_projects(workspace_id, target_url, created_at desc);
alter table public.site_architecture_projects enable row level security;
drop policy if exists site_architecture_select on public.site_architecture_projects;
drop policy if exists site_architecture_insert on public.site_architecture_projects;
create policy site_architecture_select on public.site_architecture_projects for select using (is_workspace_member(workspace_id));
create policy site_architecture_insert on public.site_architecture_projects for insert with check (is_workspace_member(workspace_id));


-- ==================== v30-local-seo.sql ====================
create table if not exists public.local_seo_projects (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, target_url text not null, location text not null, business_name text, keyword_project_id uuid references public.keyword_research_projects(id) on delete set null,
 status text not null default 'ready' check (status in ('ready','running','failed')),
 summary jsonb not null default '{}'::jsonb, analysis jsonb not null default '{}'::jsonb, created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists local_seo_projects_workspace_created_idx on public.local_seo_projects(workspace_id,created_at desc);
alter table public.local_seo_projects enable row level security;
drop policy if exists local_seo_projects_select on public.local_seo_projects;
drop policy if exists local_seo_projects_insert on public.local_seo_projects;
create policy local_seo_projects_select on public.local_seo_projects for select using (public.is_workspace_member(workspace_id));
create policy local_seo_projects_insert on public.local_seo_projects for insert with check (public.is_workspace_member(workspace_id));
drop trigger if exists local_seo_projects_updated_at on public.local_seo_projects;
create trigger local_seo_projects_updated_at before update on public.local_seo_projects for each row execute function public.set_updated_at();


-- ==================== v31-workflows.sql ====================
create table if not exists public.automation_workflows (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, description text, status text not null default 'active' check(status in ('active','paused','draft')),
 trigger_type text not null default 'manual' check(trigger_type in ('manual','schedule','on_publish','on_audit')),
 schedule text, steps jsonb not null default '[]'::jsonb, last_run_at timestamptz, next_run_at timestamptz,
 created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.automation_runs (
 id uuid primary key default gen_random_uuid(), workflow_id uuid not null references public.automation_workflows(id) on delete cascade,
 workspace_id uuid not null references public.workspaces(id) on delete cascade, status text not null default 'queued' check(status in ('queued','running','succeeded','failed','cancelled')),
 input jsonb not null default '{}'::jsonb, results jsonb not null default '[]'::jsonb, error text, started_at timestamptz, finished_at timestamptz, created_by uuid, created_at timestamptz not null default now()
);
create index if not exists automation_workflows_workspace_idx on public.automation_workflows(workspace_id, created_at desc);
create index if not exists automation_runs_workspace_idx on public.automation_runs(workspace_id, created_at desc);
create index if not exists automation_runs_workflow_idx on public.automation_runs(workflow_id, created_at desc);

alter table public.automation_workflows enable row level security;
alter table public.automation_runs enable row level security;
drop policy if exists automation_workflows_member on public.automation_workflows;
create policy automation_workflows_member on public.automation_workflows for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists automation_runs_member on public.automation_runs;
create policy automation_runs_member on public.automation_runs for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));


-- ==================== v32-monitoring.sql ====================
-- V32: SEO Monitoring & Alert Center
create table if not exists public.monitoring_profiles (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, target_url text not null, frequency text not null default 'daily' check(frequency in ('hourly','daily','weekly')),
 enabled boolean not null default true, last_run_at timestamptz, next_run_at timestamptz, created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.monitoring_snapshots (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 profile_id uuid not null references public.monitoring_profiles(id) on delete cascade, target_url text not null,
 technical_score numeric, issue_count integer not null default 0, metrics jsonb not null default '[]'::jsonb,
 search_console jsonb, alerts jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
create index if not exists monitoring_profiles_workspace_idx on public.monitoring_profiles(workspace_id,created_at desc);
create index if not exists monitoring_snapshots_profile_idx on public.monitoring_snapshots(profile_id,created_at desc);
alter table public.monitoring_profiles enable row level security;
alter table public.monitoring_snapshots enable row level security;
drop policy if exists monitoring_profiles_member on public.monitoring_profiles;
create policy monitoring_profiles_member on public.monitoring_profiles for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists monitoring_snapshots_member on public.monitoring_snapshots;
create policy monitoring_snapshots_member on public.monitoring_snapshots for select using (public.is_workspace_member(workspace_id));
-- Trusted server code writes snapshots with service role.


-- ==================== v33-advanced-analytics.sql ====================
create table if not exists public.roi_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(workspace_id,name,period_start,period_end)
);

create index if not exists roi_reports_workspace_period_idx on public.roi_reports(workspace_id, period_start desc);

alter table public.roi_reports enable row level security;

drop policy if exists "roi_reports_select_members" on public.roi_reports;
create policy "roi_reports_select_members" on public.roi_reports for select using (public.is_workspace_member(workspace_id));
drop policy if exists "roi_reports_insert_members" on public.roi_reports;
create policy "roi_reports_insert_members" on public.roi_reports for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists "roi_reports_update_admins" on public.roi_reports;
create policy "roi_reports_update_admins" on public.roi_reports for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop policy if exists "roi_reports_delete_admins" on public.roi_reports;
create policy "roi_reports_delete_admins" on public.roi_reports for delete using (public.is_workspace_admin(workspace_id));


-- ==================== v34-strategist.sql ====================
create table if not exists public.strategy_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target_url text not null,
  overall_priority text not null check (overall_priority in ('critical','high','medium','low')),
  confidence integer not null check (confidence between 0 and 100),
  summary text not null,
  plan jsonb not null default '{}'::jsonb,
  ai_summary text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists strategy_runs_workspace_created_idx on public.strategy_runs(workspace_id, created_at desc);
alter table public.strategy_runs enable row level security;
drop policy if exists strategy_runs_select on public.strategy_runs;
create policy strategy_runs_select on public.strategy_runs for select using (public.is_workspace_member(workspace_id));
drop policy if exists strategy_runs_insert on public.strategy_runs;
create policy strategy_runs_insert on public.strategy_runs for insert with check (public.is_workspace_member(workspace_id));


-- ==================== v35-operating-system.sql ====================
create table if not exists public.operating_runs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 target_url text not null, score integer not null check(score between 0 and 100), status text not null check(status in ('healthy','attention','action_required')),
 summary text not null, cycle jsonb not null default '{}'::jsonb, created_by uuid, created_at timestamptz not null default now()
);
create index if not exists operating_runs_workspace_created_idx on public.operating_runs(workspace_id,created_at desc);
alter table public.operating_runs enable row level security;
drop policy if exists operating_runs_select on public.operating_runs;
create policy operating_runs_select on public.operating_runs for select using (public.is_workspace_member(workspace_id));
drop policy if exists operating_runs_insert on public.operating_runs;
create policy operating_runs_insert on public.operating_runs for insert with check (public.is_workspace_member(workspace_id));


-- ==================== v35-channel-tools.sql ====================
-- AutoSEO V35 channel-tool workspace isolation
-- Adds tenant-scoped competitor tracking for YouTube/Facebook tools.

create table if not exists public.social_competitors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null check (platform in ('youtube','facebook')),
  channel_id_or_handle text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, platform, channel_id_or_handle)
);

create index if not exists social_competitors_workspace_platform_idx
  on public.social_competitors(workspace_id, platform);

alter table public.social_competitors enable row level security;

drop policy if exists social_competitors_select on public.social_competitors;
create policy social_competitors_select on public.social_competitors
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists social_competitors_insert on public.social_competitors;
create policy social_competitors_insert on public.social_competitors
  for insert with check (public.is_workspace_admin(workspace_id));

drop policy if exists social_competitors_delete on public.social_competitors;
create policy social_competitors_delete on public.social_competitors
  for delete using (public.is_workspace_admin(workspace_id));

revoke all on public.social_competitors from anon;
grant select, insert, delete on public.social_competitors to authenticated;


-- ==================== v35-rbac-hardening.sql ====================
-- AutoSEO V35 production hardening: RLS + RBAC alignment
-- Apply after schema.sql and all versioned migrations through v35.
-- No new product feature; this migration closes authorization/tenant-isolation gaps.

-- -----------------------------------------------------------------------------
-- 1. Role helpers
-- -----------------------------------------------------------------------------
create or replace function public.is_workspace_editor(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','editor')
  );
$$;

create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Tenant identity immutability
-- Prevent a direct client update from moving a row from workspace A to B.
-- -----------------------------------------------------------------------------
create or replace function public.prevent_workspace_id_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id cannot be changed';
  end if;
  return new;
end;
$$;

-- Tables that carry workspace tenancy.
do $$
declare
  t text;
begin
  foreach t in array array[
    'connections',
    'drafts',
    'seo_score_history',
    'jobs',
    'audit_logs',
    'calendar_items',
    'job_attempts',
    'draft_versions',
    'draft_publication_history',
    'analytics_snapshots',
    'attribution_reports',
    'seo_experiments',
    'experiment_observations',
    'keyword_research_projects',
    'keyword_opportunities',
    'competitor_projects',
    'content_strategy_projects',
    'content_studio_projects',
    'content_studio_assets',
    'content_quality_reports',
    'technical_seo_audits',
    'site_architecture_projects',
    'local_seo_projects',
    'automation_workflows',
    'automation_runs',
    'monitoring_profiles',
    'monitoring_snapshots',
    'roi_reports',
    'strategy_runs',
    'operating_runs',
    'oauth_states',
    'social_competitors'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_prevent_workspace_id_change on public.%I', t);
      execute format('create trigger trg_prevent_workspace_id_change before update on public.%I for each row execute function public.prevent_workspace_id_change()', t);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Core workspace tables
-- -----------------------------------------------------------------------------
-- Workspace itself is readable to members. Creation happens through the
-- SECURITY DEFINER create_workspace_atomic() RPC. Direct client mutations are denied.
alter table public.workspaces enable row level security;
drop policy if exists workspace_select on public.workspaces;
create policy workspace_select on public.workspaces
  for select using (public.is_workspace_member(id));
drop policy if exists workspace_insert on public.workspaces;
drop policy if exists workspace_update on public.workspaces;
drop policy if exists workspace_delete on public.workspaces;

-- Membership reads are needed by the UI. Membership mutations are performed by
-- trusted server-side code/RPCs; ordinary client inserts/updates/deletes are denied.
alter table public.workspace_members enable row level security;
drop policy if exists member_select on public.workspace_members;
create policy member_select on public.workspace_members
  for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));
drop policy if exists member_insert on public.workspace_members;
drop policy if exists member_update on public.workspace_members;
drop policy if exists member_delete on public.workspace_members;

-- -----------------------------------------------------------------------------
-- 4. Publishing connections: members can inspect connection status, but only
-- trusted server code can mutate encrypted credentials.
-- -----------------------------------------------------------------------------
alter table public.connections enable row level security;
drop policy if exists connection_all on public.connections;
drop policy if exists connection_select_members on public.connections;
create policy connection_select_members on public.connections
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists connection_insert_admin on public.connections;
drop policy if exists connection_update_admin on public.connections;
drop policy if exists connection_delete_admin on public.connections;

-- -----------------------------------------------------------------------------
-- 5. Drafts / calendar: editor-level writes, member reads, admin delete.
-- -----------------------------------------------------------------------------
alter table public.drafts enable row level security;
drop policy if exists draft_all on public.drafts;
drop policy if exists draft_select_members on public.drafts;
create policy draft_select_members on public.drafts
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists draft_insert_editors on public.drafts;
create policy draft_insert_editors on public.drafts
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists draft_update_editors on public.drafts;
create policy draft_update_editors on public.drafts
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists draft_delete_admins on public.drafts;
create policy draft_delete_admins on public.drafts
  for delete using (public.is_workspace_admin(workspace_id));

alter table public.calendar_items enable row level security;
drop policy if exists calendar_all on public.calendar_items;
drop policy if exists calendar_select_members on public.calendar_items;
create policy calendar_select_members on public.calendar_items
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists calendar_insert_editors on public.calendar_items;
create policy calendar_insert_editors on public.calendar_items
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists calendar_update_editors on public.calendar_items;
create policy calendar_update_editors on public.calendar_items
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists calendar_delete_admins on public.calendar_items;
create policy calendar_delete_admins on public.calendar_items
  for delete using (public.is_workspace_admin(workspace_id));

-- -----------------------------------------------------------------------------
-- 6. SEO history: member reads, editor inserts, no client mutation afterward.
-- -----------------------------------------------------------------------------
alter table public.seo_score_history enable row level security;
drop policy if exists seo_history_all on public.seo_score_history;
drop policy if exists seo_history_select_members on public.seo_score_history;
create policy seo_history_select_members on public.seo_score_history
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists seo_history_insert_editors on public.seo_score_history;
create policy seo_history_insert_editors on public.seo_score_history
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists seo_history_update on public.seo_score_history;
drop policy if exists seo_history_delete on public.seo_score_history;

-- -----------------------------------------------------------------------------
-- 7. Jobs / worker state: member read only. Queueing and worker state transitions
-- use trusted service_role code and RPCs.
-- -----------------------------------------------------------------------------
alter table public.jobs enable row level security;
drop policy if exists jobs_all on public.jobs;
drop policy if exists jobs_select_members on public.jobs;
create policy jobs_select_members on public.jobs
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists jobs_insert on public.jobs;
drop policy if exists jobs_update on public.jobs;
drop policy if exists jobs_delete on public.jobs;

alter table public.job_attempts enable row level security;
drop policy if exists job_attempts_select on public.job_attempts;
create policy job_attempts_select on public.job_attempts
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists job_attempts_insert on public.job_attempts;
drop policy if exists job_attempts_update on public.job_attempts;
drop policy if exists job_attempts_delete on public.job_attempts;

-- -----------------------------------------------------------------------------
-- 8. Audit logs: member reads only. Writes are trusted-server only.
-- -----------------------------------------------------------------------------
alter table public.audit_logs enable row level security;
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
  for select using (workspace_id is null or public.is_workspace_member(workspace_id));
drop policy if exists audit_insert on public.audit_logs;
drop policy if exists audit_update on public.audit_logs;
drop policy if exists audit_delete on public.audit_logs;

-- -----------------------------------------------------------------------------
-- 9. Versioning / rollback: member reads, editor creates/updates versions; no
-- client deletes. Publication history is append-only from the client perspective.
-- -----------------------------------------------------------------------------
alter table public.draft_versions enable row level security;
drop policy if exists draft_versions_select on public.draft_versions;
create policy draft_versions_select on public.draft_versions
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists draft_versions_insert on public.draft_versions;
create policy draft_versions_insert on public.draft_versions
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists draft_versions_update on public.draft_versions;
create policy draft_versions_update on public.draft_versions
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists draft_versions_delete on public.draft_versions;

alter table public.draft_publication_history enable row level security;
drop policy if exists draft_publication_history_select on public.draft_publication_history;
create policy draft_publication_history_select on public.draft_publication_history
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists draft_publication_history_insert on public.draft_publication_history;
drop policy if exists draft_publication_history_update on public.draft_publication_history;
drop policy if exists draft_publication_history_delete on public.draft_publication_history;

-- -----------------------------------------------------------------------------
-- 10. Analytics / monitoring snapshots: read-only to workspace members; trusted
-- server writes the snapshots/reports.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['analytics_snapshots','monitoring_snapshots','strategy_runs'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_select', t);
      execute format('drop policy if exists %I on public.%I', t || '_insert', t);
      execute format('drop policy if exists %I on public.%I', t || '_update', t);
      execute format('drop policy if exists %I on public.%I', t || '_delete', t);
      execute format('create policy %I on public.%I for select using (public.is_workspace_member(workspace_id))', t || '_select', t);
    end if;
  end loop;
end $$;

alter table public.attribution_reports enable row level security;
drop policy if exists attribution_reports_select on public.attribution_reports;
create policy attribution_reports_select on public.attribution_reports
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists attribution_reports_insert on public.attribution_reports;
drop policy if exists attribution_reports_update on public.attribution_reports;
drop policy if exists attribution_reports_delete on public.attribution_reports;

alter table public.roi_reports enable row level security;
drop policy if exists roi_reports_select_members on public.roi_reports;
create policy roi_reports_select_members on public.roi_reports
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists roi_reports_insert_members on public.roi_reports;
drop policy if exists roi_reports_update_admins on public.roi_reports;
drop policy if exists roi_reports_delete_admins on public.roi_reports;

-- -----------------------------------------------------------------------------
-- 11. Research/analysis tables: members read; editors write; admins delete.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'keyword_research_projects',
    'competitor_projects',
    'content_strategy_projects',
    'content_studio_projects',
    'content_quality_reports',
    'technical_seo_audits',
    'site_architecture_projects',
    'local_seo_projects'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_select', t);
      execute format('drop policy if exists %I on public.%I', t || '_insert', t);
      execute format('drop policy if exists %I on public.%I', t || '_update', t);
      execute format('drop policy if exists %I on public.%I', t || '_delete', t);
      execute format('create policy %I on public.%I for select using (public.is_workspace_member(workspace_id))', t || '_select', t);
      execute format('create policy %I on public.%I for insert with check (public.is_workspace_editor(workspace_id))', t || '_insert', t);
      execute format('create policy %I on public.%I for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id))', t || '_update', t);
      execute format('create policy %I on public.%I for delete using (public.is_workspace_admin(workspace_id))', t || '_delete', t);
    end if;
  end loop;
end $$;

-- Drop legacy permissive policy names that would otherwise OR with the RBAC policies.
do $$
begin
  if to_regclass('public.keyword_research_projects') is not null then
    execute 'drop policy if exists keyword_projects_all on public.keyword_research_projects';
  end if;
  if to_regclass('public.keyword_opportunities') is not null then
    execute 'drop policy if exists keyword_opportunities_all on public.keyword_opportunities';
  end if;
  if to_regclass('public.content_strategy_projects') is not null then
    execute 'drop policy if exists content_strategy_select on public.content_strategy_projects';
    execute 'drop policy if exists content_strategy_insert on public.content_strategy_projects';
    execute 'drop policy if exists content_strategy_update on public.content_strategy_projects';
    execute 'drop policy if exists content_strategy_delete on public.content_strategy_projects';
  end if;
  if to_regclass('public.technical_seo_audits') is not null then
    execute 'drop policy if exists technical_seo_select on public.technical_seo_audits';
    execute 'drop policy if exists technical_seo_insert on public.technical_seo_audits';
  end if;
  if to_regclass('public.site_architecture_projects') is not null then
    execute 'drop policy if exists site_architecture_select on public.site_architecture_projects';
    execute 'drop policy if exists site_architecture_insert on public.site_architecture_projects';
  end if;
  if to_regclass('public.monitoring_snapshots') is not null then
    execute 'drop policy if exists monitoring_snapshots_member on public.monitoring_snapshots';
  end if;
end $$;

-- Keyword opportunities are replaced as a batch by editor-level keyword research.
alter table public.keyword_opportunities enable row level security;
drop policy if exists keyword_opportunities_select on public.keyword_opportunities;
create policy keyword_opportunities_select on public.keyword_opportunities
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists keyword_opportunities_insert on public.keyword_opportunities;
create policy keyword_opportunities_insert on public.keyword_opportunities
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists keyword_opportunities_update on public.keyword_opportunities;
create policy keyword_opportunities_update on public.keyword_opportunities
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists keyword_opportunities_delete on public.keyword_opportunities;
create policy keyword_opportunities_delete on public.keyword_opportunities
  for delete using (public.is_workspace_editor(workspace_id));

-- Content studio assets may be created/updated by editors; deletes remain admin-only.
alter table public.content_studio_assets enable row level security;
drop policy if exists content_studio_assets_select on public.content_studio_assets;
create policy content_studio_assets_select on public.content_studio_assets
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists content_studio_assets_insert on public.content_studio_assets;
create policy content_studio_assets_insert on public.content_studio_assets
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists content_studio_assets_update on public.content_studio_assets;
create policy content_studio_assets_update on public.content_studio_assets
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists content_studio_assets_delete on public.content_studio_assets;
create policy content_studio_assets_delete on public.content_studio_assets
  for delete using (public.is_workspace_admin(workspace_id));

-- -----------------------------------------------------------------------------
-- 12. Automation: members read, editors mutate workflow definitions/runs. Worker
-- state is still subject to same role boundary for direct REST clients.
-- -----------------------------------------------------------------------------
alter table public.automation_workflows enable row level security;
drop policy if exists automation_workflows_member on public.automation_workflows;
drop policy if exists automation_workflows_select on public.automation_workflows;
drop policy if exists automation_workflows_insert on public.automation_workflows;
drop policy if exists automation_workflows_update on public.automation_workflows;
drop policy if exists automation_workflows_delete on public.automation_workflows;
create policy automation_workflows_select on public.automation_workflows
  for select using (public.is_workspace_member(workspace_id));
create policy automation_workflows_insert on public.automation_workflows
  for insert with check (public.is_workspace_editor(workspace_id));
create policy automation_workflows_update on public.automation_workflows
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
create policy automation_workflows_delete on public.automation_workflows
  for delete using (public.is_workspace_admin(workspace_id));

alter table public.automation_runs enable row level security;
drop policy if exists automation_runs_member on public.automation_runs;
drop policy if exists automation_runs_select on public.automation_runs;
drop policy if exists automation_runs_insert on public.automation_runs;
drop policy if exists automation_runs_update on public.automation_runs;
drop policy if exists automation_runs_delete on public.automation_runs;
create policy automation_runs_select on public.automation_runs
  for select using (public.is_workspace_member(workspace_id));
create policy automation_runs_insert on public.automation_runs
  for insert with check (public.is_workspace_editor(workspace_id));
create policy automation_runs_update on public.automation_runs
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists automation_runs_delete on public.automation_runs;
create policy automation_runs_delete on public.automation_runs
  for delete using (public.is_workspace_admin(workspace_id));

-- -----------------------------------------------------------------------------
-- 13. Experiments: member reads, editors manage experiments/observations; no
-- direct delete for observations.
-- -----------------------------------------------------------------------------
alter table public.seo_experiments enable row level security;
drop policy if exists seo_experiments_select on public.seo_experiments;
create policy seo_experiments_select on public.seo_experiments
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists seo_experiments_insert on public.seo_experiments;
create policy seo_experiments_insert on public.seo_experiments
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists seo_experiments_update on public.seo_experiments;
create policy seo_experiments_update on public.seo_experiments
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists seo_experiments_delete on public.seo_experiments;
create policy seo_experiments_delete on public.seo_experiments
  for delete using (public.is_workspace_admin(workspace_id));

alter table public.experiment_observations enable row level security;
drop policy if exists experiment_observations_select on public.experiment_observations;
create policy experiment_observations_select on public.experiment_observations
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists experiment_observations_insert on public.experiment_observations;
create policy experiment_observations_insert on public.experiment_observations
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists experiment_observations_update on public.experiment_observations;
create policy experiment_observations_update on public.experiment_observations
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists experiment_observations_delete on public.experiment_observations;

-- -----------------------------------------------------------------------------
-- 14. Monitoring profiles: member reads, editors manage profiles. Snapshots are
-- trusted-server writes and member reads.
-- -----------------------------------------------------------------------------
alter table public.monitoring_profiles enable row level security;
drop policy if exists monitoring_profiles_member on public.monitoring_profiles;
drop policy if exists monitoring_profiles_select on public.monitoring_profiles;
drop policy if exists monitoring_profiles_insert on public.monitoring_profiles;
drop policy if exists monitoring_profiles_update on public.monitoring_profiles;
drop policy if exists monitoring_profiles_delete on public.monitoring_profiles;
create policy monitoring_profiles_select on public.monitoring_profiles
  for select using (public.is_workspace_member(workspace_id));
create policy monitoring_profiles_insert on public.monitoring_profiles
  for insert with check (public.is_workspace_editor(workspace_id));
create policy monitoring_profiles_update on public.monitoring_profiles
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
create policy monitoring_profiles_delete on public.monitoring_profiles
  for delete using (public.is_workspace_admin(workspace_id));

-- -----------------------------------------------------------------------------
-- 15. Operating runs are created by the authenticated operating-system UI, so
-- editors can insert and members can inspect history.
-- -----------------------------------------------------------------------------
alter table public.operating_runs enable row level security;
drop policy if exists operating_runs_select on public.operating_runs;
create policy operating_runs_select on public.operating_runs
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists operating_runs_insert on public.operating_runs;
create policy operating_runs_insert on public.operating_runs
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists operating_runs_update on public.operating_runs;
drop policy if exists operating_runs_delete on public.operating_runs;

-- -----------------------------------------------------------------------------
-- 16. OAuth states: service-side lifecycle only. No client table access.
-- -----------------------------------------------------------------------------
alter table public.oauth_states enable row level security;
drop policy if exists oauth_states_select on public.oauth_states;
drop policy if exists oauth_states_insert on public.oauth_states;
drop policy if exists oauth_states_update on public.oauth_states;
drop policy if exists oauth_states_delete on public.oauth_states;

-- -----------------------------------------------------------------------------
-- 17. Explicit grants: PostgREST's authenticated role must have table privileges,
-- while RLS policies are the row/role boundary. Service role remains unrestricted.
-- GRANT statements below assume product tables created by earlier versioned files.
-- -----------------------------------------------------------------------------
grant select on public.workspaces, public.workspace_members, public.connections,
  public.drafts, public.seo_score_history, public.jobs, public.audit_logs,
  public.calendar_items, public.job_attempts, public.draft_versions,
  public.draft_publication_history, public.analytics_snapshots,
  public.attribution_reports, public.roi_reports, public.seo_experiments,
  public.experiment_observations, public.keyword_research_projects,
  public.keyword_opportunities, public.competitor_projects,
  public.content_strategy_projects, public.content_studio_projects,
  public.content_studio_assets, public.content_quality_reports,
  public.technical_seo_audits, public.site_architecture_projects,
  public.local_seo_projects, public.automation_workflows,
  public.automation_runs, public.monitoring_profiles,
  public.monitoring_snapshots, public.strategy_runs, public.operating_runs
  to authenticated;

grant insert on public.drafts, public.seo_score_history, public.calendar_items,
  public.draft_versions, public.keyword_research_projects,
  public.keyword_opportunities, public.competitor_projects,
  public.content_strategy_projects, public.content_studio_projects,
  public.content_studio_assets, public.content_quality_reports,
  public.technical_seo_audits, public.site_architecture_projects,
  public.local_seo_projects, public.automation_workflows,
  public.automation_runs, public.seo_experiments,
  public.experiment_observations, public.monitoring_profiles,
  public.operating_runs
  to authenticated;

grant update on public.drafts, public.calendar_items, public.draft_versions,
  public.keyword_research_projects, public.keyword_opportunities,
  public.competitor_projects, public.content_strategy_projects,
  public.content_studio_assets, public.automation_workflows,
  public.automation_runs, public.seo_experiments,
  public.experiment_observations, public.monitoring_profiles
  to authenticated;

grant delete on public.drafts, public.calendar_items, public.keyword_opportunities,
  public.competitor_projects, public.content_strategy_projects,
  public.content_studio_projects, public.content_studio_assets,
  public.technical_seo_audits, public.site_architecture_projects,
  public.local_seo_projects, public.automation_workflows,
  public.automation_runs, public.seo_experiments, public.monitoring_profiles
  to authenticated;

-- Never expose credential/OAuth/job-state mutation to the authenticated
-- PostgREST client. Read-only access remains available where the UI needs it.
revoke insert, update, delete on public.connections from authenticated;
revoke all on public.oauth_states from authenticated;
revoke insert, update, delete on public.jobs from authenticated;
revoke all on public.job_attempts from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
revoke insert, update, delete on public.analytics_snapshots from authenticated;
revoke insert, update, delete on public.monitoring_snapshots from authenticated;
revoke insert, update, delete on public.strategy_runs from authenticated;

-- RPC privileges used by the application.
revoke all on function public.is_workspace_editor(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_editor(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- Ensure the existing workspace-creation RPC remains the supported mutation path.
revoke all on function public.create_workspace_atomic(text, text) from public;
grant execute on function public.create_workspace_atomic(text, text) to authenticated;


-- ==================== v36-youtube-security.sql ====================
-- AutoSEO V36 YouTube security hardening
-- Closes the remaining channel-tool tenant boundary for YouTube.
-- Apply after the existing migrations through V35.

create table if not exists public.youtube_competitors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id_or_handle text not null check (length(trim(channel_id_or_handle)) between 1 and 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, channel_id_or_handle)
);

create index if not exists youtube_competitors_workspace_idx
  on public.youtube_competitors(workspace_id, created_at desc);

alter table public.youtube_competitors enable row level security;

drop policy if exists youtube_competitors_select on public.youtube_competitors;
create policy youtube_competitors_select on public.youtube_competitors
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists youtube_competitors_insert on public.youtube_competitors;
create policy youtube_competitors_insert on public.youtube_competitors
  for insert with check (public.is_workspace_editor(workspace_id));

drop policy if exists youtube_competitors_delete on public.youtube_competitors;
create policy youtube_competitors_delete on public.youtube_competitors
  for delete using (public.is_workspace_admin(workspace_id));

drop trigger if exists trg_youtube_competitors_workspace_id on public.youtube_competitors;
create trigger trg_youtube_competitors_workspace_id
before update on public.youtube_competitors
for each row execute function public.prevent_workspace_id_change();

grant select on public.youtube_competitors to authenticated;
grant insert on public.youtube_competitors to authenticated;
grant delete on public.youtube_competitors to authenticated;


-- ==================== v37-core-security.sql ====================
-- AutoSEO V37 Core Security Foundation
-- Apply after migrations through V36.
-- This migration is intentionally security-only: no product features.

-- 1) Keep role helpers deterministic and protected from search_path manipulation.
create or replace function public.is_workspace_editor(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','editor')
  );
$$;

create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

create or replace function public.prevent_workspace_id_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id cannot be changed';
  end if;
  return new;
end;
$$;

-- 2) Enforce tenant identity immutability on every current tenant table.
do $$
declare t text;
begin
  foreach t in array array[
    'connections','drafts','seo_score_history','jobs','audit_logs','calendar_items',
    'job_attempts','draft_versions','draft_publication_history','analytics_snapshots',
    'attribution_reports','seo_experiments','experiment_observations',
    'keyword_research_projects','keyword_opportunities','competitor_projects',
    'content_strategy_projects','content_studio_projects','content_studio_assets',
    'content_quality_reports','technical_seo_audits','site_architecture_projects',
    'local_seo_projects','automation_workflows','automation_runs','monitoring_profiles',
    'monitoring_snapshots','roi_reports','strategy_runs','operating_runs','oauth_states',
    'youtube_competitors','social_competitors','publication_intents','action_approvals'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_v37_workspace_id_immutable on public.%I', t);
      execute format('create trigger trg_v37_workspace_id_immutable before update on public.%I for each row execute function public.prevent_workspace_id_change()', t);
    end if;
  end loop;
end $$;

-- 3) Never grant tenant table access to the unauthenticated anon role.
do $$
declare t text;
begin
  foreach t in array array[
    'workspaces','workspace_members','connections','drafts','seo_score_history','jobs',
    'audit_logs','calendar_items','job_attempts','draft_versions','draft_publication_history',
    'analytics_snapshots','attribution_reports','roi_reports','seo_experiments',
    'experiment_observations','keyword_research_projects','keyword_opportunities',
    'competitor_projects','content_strategy_projects','content_studio_projects',
    'content_studio_assets','content_quality_reports','technical_seo_audits',
    'site_architecture_projects','local_seo_projects','automation_workflows',
    'automation_runs','monitoring_profiles','monitoring_snapshots','strategy_runs',
    'operating_runs','youtube_competitors','social_competitors','oauth_states',
    'publication_intents','action_approvals'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon', t);
    end if;
  end loop;
end $$;

-- 4) Sensitive helper functions are callable only by authenticated users.
revoke all on function public.is_workspace_editor(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_editor(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- 5) Revoke client access to the security-sensitive tenant state tables.
do $$
begin
  if to_regclass('public.connections') is not null then
    execute 'revoke insert, update, delete on public.connections from authenticated';
  end if;
  if to_regclass('public.oauth_states') is not null then
    execute 'revoke all on public.oauth_states from authenticated';
  end if;
  if to_regclass('public.jobs') is not null then
    execute 'revoke insert, update, delete on public.jobs from authenticated';
  end if;
  if to_regclass('public.job_attempts') is not null then
    execute 'revoke all on public.job_attempts from authenticated';
  end if;
  if to_regclass('public.audit_logs') is not null then
    execute 'revoke insert, update, delete on public.audit_logs from authenticated';
  end if;
end $$;


-- ==================== v39-automation-hardening.sql ====================
-- AutoSEO V39: automation run idempotency + execution safety
alter table public.automation_runs add column if not exists idempotency_key text;

create unique index if not exists automation_runs_workspace_idempotency_uidx
  on public.automation_runs(workspace_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists automation_runs_status_created_idx
  on public.automation_runs(status, created_at);

-- A workflow run may only transition from queued -> running once at the API layer.
-- Terminal states are retained for auditability; retries will be introduced through durable jobs/worker phase.


-- ==================== v40-automation-scheduler.sql ====================
-- AutoSEO V40: scheduled automation workflow dispatcher
-- The cron route claims due schedules and creates idempotent automation_runs.
create index if not exists automation_workflows_due_schedule_idx
  on public.automation_workflows(status, trigger_type, next_run_at)
  where status = 'active' and trigger_type = 'schedule';

create index if not exists automation_runs_workspace_status_created_idx
  on public.automation_runs(workspace_id, status, created_at desc);

-- Prevent tenant/workflow mismatch at the database layer.
create or replace function public.enforce_automation_run_workspace()
returns trigger
language plpgsql
as $$
declare workflow_workspace uuid;
begin
  select workspace_id into workflow_workspace
  from public.automation_workflows where id = new.workflow_id;
  if workflow_workspace is null or workflow_workspace <> new.workspace_id then
    raise exception 'Automation run workspace does not match workflow workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists automation_run_workspace_guard on public.automation_runs;
create trigger automation_run_workspace_guard
before insert or update on public.automation_runs
for each row execute function public.enforce_automation_run_workspace();


-- ==================== v41-youtube-automation-worker.sql ====================
-- AutoSEO V41: durable automation-run worker, atomic claiming and retries.
-- Apply after V39 and V40.

alter table public.automation_runs add column if not exists attempts integer not null default 0;
alter table public.automation_runs add column if not exists max_attempts integer not null default 5;
alter table public.automation_runs add column if not exists run_after timestamptz not null default now();
alter table public.automation_runs add column if not exists locked_at timestamptz;
alter table public.automation_runs add column if not exists locked_by text;

create index if not exists automation_runs_due_idx
  on public.automation_runs(status, run_after, created_at)
  where status = 'queued';

create index if not exists automation_runs_lock_idx
  on public.automation_runs(status, locked_at)
  where status = 'running';

create or replace function public.claim_next_automation_run(p_worker_id text)
returns setof public.automation_runs
language sql
security definer
set search_path = public
as $$
  update public.automation_runs r
  set status = 'running',
      attempts = r.attempts + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      started_at = coalesce(r.started_at, now())
  where r.id = (
    select candidate.id
    from public.automation_runs candidate
    where candidate.status = 'queued'
      and candidate.run_after <= now()
    order by candidate.run_after asc, candidate.created_at asc
    for update skip locked
    limit 1
  )
  returning r.*;
$$;

create or replace function public.recover_stale_automation_runs(p_stale_after interval default interval '10 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare recovered integer;
begin
  update public.automation_runs
  set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
      run_after = case when attempts >= max_attempts then run_after else now() end,
      error = case when attempts >= max_attempts then coalesce(error, 'Automation run exceeded maximum attempts after stale lock.') else 'Worker lock expired; run re-queued.' end,
      locked_at = null,
      locked_by = null,
      finished_at = case when attempts >= max_attempts then now() else finished_at end
  where status = 'running'
    and locked_at is not null
    and locked_at < now() - p_stale_after;
  get diagnostics recovered = row_count;
  return recovered;
end;
$$;

revoke all on function public.claim_next_automation_run(text) from public, anon, authenticated;
grant execute on function public.claim_next_automation_run(text) to service_role;
revoke all on function public.recover_stale_automation_runs(interval) from public, anon, authenticated;
grant execute on function public.recover_stale_automation_runs(interval) to service_role;


-- ==================== v42-youtube-publishing-reliability.sql ====================
-- AutoSEO V42: YouTube publishing reliability / reconciliation foundation.
-- This migration adds a durable, workspace-scoped publication intent ledger.
-- The provider adapter remains the source of truth for the final YouTube state.

create table if not exists public.publication_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  channel text not null,
  provider_resource_id text not null,
  operation text not null,
  fingerprint text not null,
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  provider_url text,
  last_error text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz
);

create unique index if not exists publication_intents_workspace_fingerprint_uq
  on public.publication_intents(workspace_id, fingerprint);
create index if not exists publication_intents_draft_idx
  on public.publication_intents(workspace_id, draft_id, created_at desc);

alter table public.publication_intents enable row level security;
drop policy if exists publication_intents_select on public.publication_intents;
create policy publication_intents_select on public.publication_intents
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists publication_intents_insert on public.publication_intents;
drop policy if exists publication_intents_update on public.publication_intents;
drop policy if exists publication_intents_delete on public.publication_intents;

-- Publication intents are server-managed. Clients can only read them.
revoke all on table public.publication_intents from anon, authenticated;
grant select on table public.publication_intents to authenticated;

create or replace function public.touch_publication_intent_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_publication_intents_updated_at on public.publication_intents;
create trigger trg_publication_intents_updated_at
before update on public.publication_intents
for each row execute function public.touch_publication_intent_updated_at();

drop trigger if exists trg_prevent_workspace_id_change on public.publication_intents;
create trigger trg_prevent_workspace_id_change
before update on public.publication_intents
for each row execute function public.prevent_workspace_id_change();


-- ==================== v44-youtube-approval-risk.sql ====================
-- V44: YouTube human approval + risk engine
create table if not exists public.action_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action_type text not null,
  risk text not null check (risk in ('low','medium','high','critical')),
  status text not null check (status in ('pending','approved','rejected','executed','cancelled','blocked')),
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  reason text not null,
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  executed_at timestamptz
);
create index if not exists action_approvals_workspace_status_idx on public.action_approvals(workspace_id,status,created_at desc);
create index if not exists action_approvals_workspace_risk_idx on public.action_approvals(workspace_id,risk,created_at desc);
alter table public.action_approvals enable row level security;
drop policy if exists action_approvals_select_members on public.action_approvals;
create policy action_approvals_select_members on public.action_approvals for select using (public.is_workspace_member(workspace_id));
drop policy if exists action_approvals_insert_editors on public.action_approvals;
create policy action_approvals_insert_editors on public.action_approvals for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists action_approvals_update_admins on public.action_approvals;
create policy action_approvals_update_admins on public.action_approvals for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop trigger if exists trg_prevent_workspace_id_change on public.action_approvals;
create trigger trg_prevent_workspace_id_change before update on public.action_approvals for each row execute function public.prevent_workspace_id_change();
revoke all on public.action_approvals from anon;
grant select, insert, update on public.action_approvals to authenticated;

-- ==================== V45 final security hardening ====================
-- Pin SECURITY DEFINER search_path and restrict function EXECUTE privileges.
-- This section is idempotent and may safely run after the preceding sections.
begin;

alter function public.set_updated_at() set search_path = '';
alter function public.prevent_workspace_identity_change() set search_path = '';
alter function public.prevent_audit_mutation() set search_path = '';
alter function public.enforce_job_transition() set search_path = '';
alter function public.set_seo_experiment_updated_at() set search_path = '';
alter function public.set_keyword_research_updated_at() set search_path = '';
alter function public.enforce_automation_run_workspace() set search_path = '';
alter function public.touch_publication_intent_updated_at() set search_path = '';
alter function public.claim_next_job(text) set search_path = '';
alter function public.cleanup_expired_oauth_states() set search_path = '';
alter function public.cleanup_oauth_and_connection_metadata() set search_path = '';
alter function public.create_workspace_atomic(text, text) set search_path = '';
alter function public.is_workspace_admin(uuid) set search_path = '';
alter function public.is_workspace_editor(uuid) set search_path = '';
alter function public.is_workspace_member(uuid) set search_path = '';
alter function public.is_workspace_owner(uuid) set search_path = '';
alter function public.prevent_draft_publication_history_mutation() set search_path = '';
alter function public.prevent_draft_version_delete() set search_path = '';
alter function public.prevent_owner_membership_change() set search_path = '';
alter function public.prevent_workspace_id_change() set search_path = '';
alter function public.recover_stale_jobs(interval) set search_path = '';

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_workspace_identity_change() from public, anon, authenticated;
revoke all on function public.prevent_audit_mutation() from public, anon, authenticated;
revoke all on function public.enforce_job_transition() from public, anon, authenticated;
revoke all on function public.set_seo_experiment_updated_at() from public, anon, authenticated;
revoke all on function public.set_keyword_research_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_automation_run_workspace() from public, anon, authenticated;
revoke all on function public.touch_publication_intent_updated_at() from public, anon, authenticated;

revoke all on function public.claim_next_job(text) from public, anon, authenticated;
revoke all on function public.cleanup_expired_oauth_states() from public, anon, authenticated;
revoke all on function public.cleanup_oauth_and_connection_metadata() from public, anon, authenticated;
revoke all on function public.recover_stale_jobs(interval) from public, anon, authenticated;
grant execute on function public.claim_next_job(text) to service_role;
grant execute on function public.cleanup_expired_oauth_states() to service_role;
grant execute on function public.cleanup_oauth_and_connection_metadata() to service_role;
grant execute on function public.recover_stale_jobs(interval) to service_role;

revoke all on function public.create_workspace_atomic(text, text) from public, anon, authenticated;
revoke all on function public.is_workspace_admin(uuid) from public, anon, authenticated;
revoke all on function public.is_workspace_editor(uuid) from public, anon, authenticated;
revoke all on function public.is_workspace_member(uuid) from public, anon, authenticated;
revoke all on function public.is_workspace_owner(uuid) from public, anon, authenticated;
grant execute on function public.create_workspace_atomic(text, text) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.is_workspace_editor(uuid) to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- OAuth state table is intentionally inaccessible to API clients.
drop policy if exists oauth_states_deny_all on public.oauth_states;
create policy oauth_states_deny_all on public.oauth_states for all using (false) with check (false);

commit;

-- ==================== v46-nexora-saas.sql ====================
-- See supabase/v46-nexora-saas.sql for the canonical versioned file.
alter table public.workspaces add column if not exists status text not null default 'active';
alter table public.workspaces drop constraint if exists workspaces_status_check;
alter table public.workspaces add constraint workspaces_status_check check (status in ('active','suspended'));
alter table public.workspaces add column if not exists suspended_at timestamptz;
alter table public.workspaces add column if not exists suspended_reason text;
alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check check (role in ('owner','admin','editor','member','viewer'));
create table if not exists public.product_plans (
  slug text primary key, name text not null, description text not null default '',
  price_cents integer not null default 0, currency text not null default 'USD',
  billing_interval text not null default 'month', trial_days integer not null default 0,
  team_limit integer not null default 1, api_access boolean not null default false,
  priority boolean not null default false, support_level text not null default 'community',
  status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.product_features (
  feature_key text primary key, description text not null default '', beta boolean not null default false,
  status text not null default 'active', created_at timestamptz not null default now()
);
create table if not exists public.plan_features (
  plan_slug text not null references public.product_plans(slug) on delete cascade,
  feature_key text not null references public.product_features(feature_key) on delete cascade,
  enabled boolean not null default true, primary key (plan_slug, feature_key)
);
create table if not exists public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  plan_slug text not null references public.product_plans(slug),
  status text not null default 'trial',
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '1 month'),
  cancel_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null, event_type text not null,
  from_plan text, to_plan text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.entitlement_overrides (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, feature_key text not null,
  effect text not null, limit_value integer, reason text, expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.usage_counters (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric text not null, period text not null, quantity integer not null default 0,
  updated_at timestamptz not null default now(), primary key (workspace_id, metric, period)
);
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null, metric text not null,
  quantity integer not null default 1, created_at timestamptz not null default now()
);
create table if not exists public.billing_records (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null default 'none', provider_reference text, kind text not null,
  amount_cents integer, currency text default 'USD', status text not null default 'recorded',
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.coupons (
  code text primary key, percent_off integer, amount_off_cents integer, max_redemptions integer,
  redeemed integer not null default 0, expires_at timestamptz, status text not null default 'active', created_at timestamptz not null default now()
);
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade, email text, created_at timestamptz not null default now()
);
alter table public.product_plans enable row level security;
alter table public.product_features enable row level security;
alter table public.plan_features enable row level security;
alter table public.workspace_subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.entitlement_overrides enable row level security;
alter table public.usage_counters enable row level security;
alter table public.usage_events enable row level security;
alter table public.billing_records enable row level security;
alter table public.coupons enable row level security;
alter table public.platform_admins enable row level security;

-- ==================== v47-oauth-consume.sql (optional) ====================
-- Canonical file: supabase/v47-oauth-consume.sql
-- Application consume already uses atomic DELETE ... RETURNING via PostgREST.

