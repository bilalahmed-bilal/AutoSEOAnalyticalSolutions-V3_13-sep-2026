-- V27 Content Quality & Fact Intelligence
create table if not exists public.content_quality_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid references public.content_studio_assets(id) on delete set null,
  draft_id uuid references public.drafts(id) on delete set null,
  score integer not null check (score between 0 and 100),
  verdict text not null check (verdict in ('publish-ready','needs-review','needs-rework')),
  report jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_content_quality_workspace on public.content_quality_reports(workspace_id, created_at desc);
create index if not exists idx_content_quality_asset on public.content_quality_reports(asset_id, created_at desc);
alter table public.content_quality_reports enable row level security;
drop policy if exists content_quality_reports_select on public.content_quality_reports;
drop policy if exists content_quality_reports_insert on public.content_quality_reports;
create policy content_quality_reports_select on public.content_quality_reports for select using (is_workspace_member(workspace_id));
create policy content_quality_reports_insert on public.content_quality_reports for insert with check (is_workspace_member(workspace_id));
