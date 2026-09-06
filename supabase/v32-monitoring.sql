-- V32: SEO Monitoring & Alert Center
create table if not exists public.monitoring_profiles (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, target_url text not null, frequency text not null default 'daily' check(frequency in ('hourly','daily','weekly')),
 enabled boolean not null default true, last_run_at timestamptz, next_run_at timestamptz, created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.monitoring_snapshots (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 profile_id uuid not null references public.monitoring_profiles(id) on delete cascade, target_url text not null,
 technical_score numeric, issue_count integer not null default 0, metrics jsonb not null default '[]'::jsonb,
 search_console jsonb, alerts jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
create index if not exists monitoring_profiles_workspace_idx on public.monitoring_profiles(workspace_id,created_at desc);
create index if not exists monitoring_snapshots_profile_idx on public.monitoring_snapshots(profile_id,created_at desc);
alter table public.monitoring_profiles enable row level security;
alter table public.monitoring_snapshots enable row level security;
drop policy if exists monitoring_profiles_member on public.monitoring_profiles;
create policy monitoring_profiles_member on public.monitoring_profiles for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists monitoring_snapshots_member on public.monitoring_snapshots;
create policy monitoring_snapshots_member on public.monitoring_snapshots for select using (public.is_workspace_member(workspace_id));
-- Trusted server code writes snapshots with service role.
