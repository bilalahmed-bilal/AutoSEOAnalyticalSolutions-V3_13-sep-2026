create extension if not exists pgcrypto;
create table if not exists public.content_strategy_projects (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, keyword_project_id uuid references public.keyword_research_projects(id) on delete set null,
 competitor_project_id uuid references public.competitor_projects(id) on delete set null,
 status text not null default 'ready' check(status in ('ready','running','failed')),
 summary jsonb not null default '{}'::jsonb, strategy jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists content_strategy_workspace_idx on public.content_strategy_projects(workspace_id,created_at desc);
alter table public.content_strategy_projects enable row level security;
drop policy if exists content_strategy_select on public.content_strategy_projects; create policy content_strategy_select on public.content_strategy_projects for select using(public.is_workspace_member(workspace_id));
drop policy if exists content_strategy_insert on public.content_strategy_projects; create policy content_strategy_insert on public.content_strategy_projects for insert with check(public.is_workspace_member(workspace_id));
drop policy if exists content_strategy_update on public.content_strategy_projects; create policy content_strategy_update on public.content_strategy_projects for update using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id));
drop policy if exists content_strategy_delete on public.content_strategy_projects; create policy content_strategy_delete on public.content_strategy_projects for delete using(public.is_workspace_admin(workspace_id));
drop trigger if exists content_strategy_updated_at on public.content_strategy_projects; create trigger content_strategy_updated_at before update on public.content_strategy_projects for each row execute function public.set_updated_at();
