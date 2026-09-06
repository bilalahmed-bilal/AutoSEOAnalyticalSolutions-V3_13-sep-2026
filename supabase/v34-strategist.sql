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
