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
