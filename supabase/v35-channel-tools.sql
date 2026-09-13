-- AutoSEO V35 channel-tool workspace isolation
-- Adds tenant-scoped competitor tracking for YouTube/Facebook tools.

create table if not exists public.social_competitors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null check (platform in ('youtube','facebook')),
  channel_id_or_handle text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, platform, channel_id_or_handle)
);

create index if not exists social_competitors_workspace_platform_idx
  on public.social_competitors(workspace_id, platform);

alter table public.social_competitors enable row level security;

drop policy if exists social_competitors_select on public.social_competitors;
create policy social_competitors_select on public.social_competitors
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists social_competitors_insert on public.social_competitors;
create policy social_competitors_insert on public.social_competitors
  for insert with check (public.is_workspace_admin(workspace_id));

drop policy if exists social_competitors_delete on public.social_competitors;
create policy social_competitors_delete on public.social_competitors
  for delete using (public.is_workspace_admin(workspace_id));

revoke all on public.social_competitors from anon;
grant select, insert, delete on public.social_competitors to authenticated;
