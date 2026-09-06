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
