-- V20: analytics snapshots for Search Console + channel performance.
create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, period_start, period_end)
);
create index if not exists idx_analytics_snapshots_workspace on public.analytics_snapshots(workspace_id, created_at desc);
alter table public.analytics_snapshots enable row level security;
drop policy if exists analytics_snapshots_select on public.analytics_snapshots;
create policy analytics_snapshots_select on public.analytics_snapshots for select using (public.is_workspace_member(workspace_id));
-- Snapshot writes are performed by trusted server code using service role.

-- Existing V12 databases need the provider check expanded as well.
alter table public.connections drop constraint if exists connections_provider_check;
alter table public.connections add constraint connections_provider_check check (provider in ('wordpress','shopify','custom','youtube','facebook','google-search-console'));
alter table public.oauth_states drop constraint if exists oauth_states_provider_check;
alter table public.oauth_states add constraint oauth_states_provider_check check (provider in ('google-youtube','google-search-console','facebook'));
