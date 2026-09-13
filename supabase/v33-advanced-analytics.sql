create table if not exists public.roi_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(workspace_id,name,period_start,period_end)
);

create index if not exists roi_reports_workspace_period_idx on public.roi_reports(workspace_id, period_start desc);

alter table public.roi_reports enable row level security;

drop policy if exists "roi_reports_select_members" on public.roi_reports;
create policy "roi_reports_select_members" on public.roi_reports for select using (public.is_workspace_member(workspace_id));
drop policy if exists "roi_reports_insert_members" on public.roi_reports;
create policy "roi_reports_insert_members" on public.roi_reports for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists "roi_reports_update_admins" on public.roi_reports;
create policy "roi_reports_update_admins" on public.roi_reports for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop policy if exists "roi_reports_delete_admins" on public.roi_reports;
create policy "roi_reports_delete_admins" on public.roi_reports for delete using (public.is_workspace_admin(workspace_id));
