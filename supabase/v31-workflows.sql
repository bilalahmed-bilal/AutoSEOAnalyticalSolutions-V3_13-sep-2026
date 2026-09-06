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
