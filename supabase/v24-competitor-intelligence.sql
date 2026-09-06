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
