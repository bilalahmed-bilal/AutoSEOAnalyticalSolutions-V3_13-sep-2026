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
