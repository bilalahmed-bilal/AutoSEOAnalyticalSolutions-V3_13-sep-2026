-- V19: reversible publishing and rollback history
create table if not exists public.draft_publication_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  version_id uuid references public.draft_versions(id) on delete set null,
  event_type text not null check (event_type in ('published','rollback_requested','rollback_published','rollback_failed')),
  snapshot jsonb not null,
  published_url text,
  job_id uuid references public.jobs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pub_history_draft on public.draft_publication_history(draft_id, created_at desc);
create index if not exists idx_pub_history_workspace on public.draft_publication_history(workspace_id, created_at desc);

alter table public.draft_publication_history enable row level security;
drop policy if exists draft_publication_history_select on public.draft_publication_history;
create policy draft_publication_history_select on public.draft_publication_history for select using (public.is_workspace_member(workspace_id));
drop policy if exists draft_publication_history_insert on public.draft_publication_history;
create policy draft_publication_history_insert on public.draft_publication_history for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists draft_publication_history_update on public.draft_publication_history;
create policy draft_publication_history_update on public.draft_publication_history for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop policy if exists draft_publication_history_delete on public.draft_publication_history;
create policy draft_publication_history_delete on public.draft_publication_history for delete using (false);

-- Version rollback metadata. A rollback is represented by a new immutable version.
alter table public.draft_versions add column if not exists rollback_of_version_id uuid references public.draft_versions(id) on delete set null;
create index if not exists idx_draft_versions_rollback on public.draft_versions(rollback_of_version_id);

create or replace function public.prevent_draft_publication_history_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'draft_publication_history is immutable';
end;
$$;
drop trigger if exists trg_prevent_draft_publication_history_update on public.draft_publication_history;
create trigger trg_prevent_draft_publication_history_update before update on public.draft_publication_history for each row execute function public.prevent_draft_publication_history_mutation();
drop trigger if exists trg_prevent_draft_publication_history_delete on public.draft_publication_history;
create trigger trg_prevent_draft_publication_history_delete before delete on public.draft_publication_history for each row execute function public.prevent_draft_publication_history_mutation();
