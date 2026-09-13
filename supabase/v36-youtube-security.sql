-- AutoSEO V36 YouTube security hardening
-- Closes the remaining channel-tool tenant boundary for YouTube.
-- Apply after the existing migrations through V35.

create table if not exists public.youtube_competitors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id_or_handle text not null check (length(trim(channel_id_or_handle)) between 1 and 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, channel_id_or_handle)
);

create index if not exists youtube_competitors_workspace_idx
  on public.youtube_competitors(workspace_id, created_at desc);

alter table public.youtube_competitors enable row level security;

drop policy if exists youtube_competitors_select on public.youtube_competitors;
create policy youtube_competitors_select on public.youtube_competitors
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists youtube_competitors_insert on public.youtube_competitors;
create policy youtube_competitors_insert on public.youtube_competitors
  for insert with check (public.is_workspace_editor(workspace_id));

drop policy if exists youtube_competitors_delete on public.youtube_competitors;
create policy youtube_competitors_delete on public.youtube_competitors
  for delete using (public.is_workspace_admin(workspace_id));

drop trigger if exists trg_youtube_competitors_workspace_id on public.youtube_competitors;
create trigger trg_youtube_competitors_workspace_id
before update on public.youtube_competitors
for each row execute function public.prevent_workspace_id_change();

grant select on public.youtube_competitors to authenticated;
grant insert on public.youtube_competitors to authenticated;
grant delete on public.youtube_competitors to authenticated;
