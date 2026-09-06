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
