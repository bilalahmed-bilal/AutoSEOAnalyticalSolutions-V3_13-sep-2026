-- AutoSEO V39: automation run idempotency + execution safety
alter table public.automation_runs add column if not exists idempotency_key text;

create unique index if not exists automation_runs_workspace_idempotency_uidx
  on public.automation_runs(workspace_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists automation_runs_status_created_idx
  on public.automation_runs(status, created_at);

-- A workflow run may only transition from queued -> running once at the API layer.
-- Terminal states are retained for auditability; retries will be introduced through durable jobs/worker phase.
