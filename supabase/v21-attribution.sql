-- V21: optional persisted attribution reports. Reports are immutable snapshots of a comparison.
create table if not exists public.attribution_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  target_url text not null,
  publication_date timestamptz not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_attribution_reports_workspace on public.attribution_reports(workspace_id, created_at desc);
create index if not exists idx_attribution_reports_draft on public.attribution_reports(draft_id, created_at desc);
alter table public.attribution_reports enable row level security;
drop policy if exists attribution_reports_select on public.attribution_reports;
create policy attribution_reports_select on public.attribution_reports for select using (public.is_workspace_member(workspace_id));
drop policy if exists attribution_reports_insert on public.attribution_reports;
create policy attribution_reports_insert on public.attribution_reports for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists attribution_reports_update on public.attribution_reports;
create policy attribution_reports_update on public.attribution_reports for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop policy if exists attribution_reports_delete on public.attribution_reports;
create policy attribution_reports_delete on public.attribution_reports for delete using (false);
