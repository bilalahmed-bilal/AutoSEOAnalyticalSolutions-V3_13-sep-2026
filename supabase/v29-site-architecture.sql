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
