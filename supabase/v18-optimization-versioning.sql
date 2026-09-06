-- V18: human-in-the-loop optimization versioning and rollback support
create table if not exists public.draft_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  version_number integer not null,
  source text not null default 'ai_optimization' check (source in ('original','ai_optimization','manual')),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','applied','rolled_back')),
  original_content jsonb not null,
  optimized_content jsonb not null,
  change_decisions jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  applied_at timestamptz,
  unique (draft_id, version_number)
);

create index if not exists idx_draft_versions_workspace on public.draft_versions(workspace_id, created_at desc);
create index if not exists idx_draft_versions_draft on public.draft_versions(draft_id, version_number desc);

alter table public.draft_versions enable row level security;
drop policy if exists draft_versions_select on public.draft_versions;
create policy draft_versions_select on public.draft_versions for select using (public.is_workspace_member(workspace_id));
drop policy if exists draft_versions_insert on public.draft_versions;
create policy draft_versions_insert on public.draft_versions for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists draft_versions_update on public.draft_versions;
create policy draft_versions_update on public.draft_versions for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- A database guard prevents deleting version history from the client.
create or replace function public.prevent_draft_version_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'draft_versions are immutable; use rollback status instead of delete';
end;
$$;
drop trigger if exists trg_prevent_draft_version_delete on public.draft_versions;
create trigger trg_prevent_draft_version_delete before delete on public.draft_versions
for each row execute function public.prevent_draft_version_delete();
