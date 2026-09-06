-- V10 security hardening. Run after schema.sql and v6-queue.sql.
-- Canonical workspace roles are owner/admin/editor/viewer.

-- Remove any legacy role values before enforcing the canonical set.
update public.workspace_members set role = 'editor' where role = 'staff';

alter table public.workspace_members
  drop constraint if exists workspace_members_role_check;
alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner','admin','editor','viewer'));

-- Prevent owners from being removed or demoted by ordinary member APIs.
create or replace function public.prevent_owner_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner' then
    if tg_op = 'DELETE' then
      raise exception 'owner membership cannot be deleted';
    elsif new.role <> 'owner' then
      raise exception 'owner membership cannot be demoted';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prevent_owner_membership_change on public.workspace_members;
create trigger trg_prevent_owner_membership_change
before update or delete on public.workspace_members
for each row execute function public.prevent_owner_membership_change();

-- Audit log entries are append-only from the client perspective.
drop policy if exists audit_insert on public.audit_logs;
drop policy if exists audit_update on public.audit_logs;
drop policy if exists audit_delete on public.audit_logs;
create policy audit_insert on public.audit_logs for insert
  with check (actor_user_id = auth.uid() and (workspace_id is null or public.is_workspace_member(workspace_id)));

-- No client UPDATE/DELETE policy is intentionally created.

create index if not exists idx_connections_health
  on public.connections(workspace_id, status, last_checked_at desc);
create index if not exists idx_jobs_workspace_status
  on public.jobs(workspace_id, status, updated_at desc);
