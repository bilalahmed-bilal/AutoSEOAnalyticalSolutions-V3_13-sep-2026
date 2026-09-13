create table if not exists public.local_seo_projects (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, target_url text not null, location text not null, business_name text, keyword_project_id uuid references public.keyword_research_projects(id) on delete set null,
 status text not null default 'ready' check (status in ('ready','running','failed')),
 summary jsonb not null default '{}'::jsonb, analysis jsonb not null default '{}'::jsonb, created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists local_seo_projects_workspace_created_idx on public.local_seo_projects(workspace_id,created_at desc);
alter table public.local_seo_projects enable row level security;
drop policy if exists local_seo_projects_select on public.local_seo_projects;
drop policy if exists local_seo_projects_insert on public.local_seo_projects;
create policy local_seo_projects_select on public.local_seo_projects for select using (public.is_workspace_member(workspace_id));
create policy local_seo_projects_insert on public.local_seo_projects for insert with check (public.is_workspace_member(workspace_id));
drop trigger if exists local_seo_projects_updated_at on public.local_seo_projects;
create trigger local_seo_projects_updated_at before update on public.local_seo_projects for each row execute function public.set_updated_at();
