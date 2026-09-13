-- V44: YouTube human approval + risk engine
create table if not exists public.action_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action_type text not null,
  risk text not null check (risk in ('low','medium','high','critical')),
  status text not null check (status in ('pending','approved','rejected','executed','cancelled','blocked')),
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  reason text not null,
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  executed_at timestamptz
);
create index if not exists action_approvals_workspace_status_idx on public.action_approvals(workspace_id,status,created_at desc);
create index if not exists action_approvals_workspace_risk_idx on public.action_approvals(workspace_id,risk,created_at desc);
alter table public.action_approvals enable row level security;
drop policy if exists action_approvals_select_members on public.action_approvals;
create policy action_approvals_select_members on public.action_approvals for select using (public.is_workspace_member(workspace_id));
drop policy if exists action_approvals_insert_editors on public.action_approvals;
create policy action_approvals_insert_editors on public.action_approvals for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists action_approvals_update_admins on public.action_approvals;
create policy action_approvals_update_admins on public.action_approvals for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop trigger if exists trg_prevent_workspace_id_change on public.action_approvals;
create trigger trg_prevent_workspace_id_change before update on public.action_approvals for each row execute function public.prevent_workspace_id_change();
