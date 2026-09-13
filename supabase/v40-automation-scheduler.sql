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
