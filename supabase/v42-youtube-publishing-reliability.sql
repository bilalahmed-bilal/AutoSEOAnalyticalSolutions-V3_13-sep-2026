-- AutoSEO V42: YouTube publishing reliability / reconciliation foundation.
-- This migration adds a durable, workspace-scoped publication intent ledger.
-- The provider adapter remains the source of truth for the final YouTube state.

create table if not exists public.publication_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  channel text not null,
  provider_resource_id text not null,
  operation text not null,
  fingerprint text not null,
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  provider_url text,
  last_error text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz
);

create unique index if not exists publication_intents_workspace_fingerprint_uq
  on public.publication_intents(workspace_id, fingerprint);
create index if not exists publication_intents_draft_idx
  on public.publication_intents(workspace_id, draft_id, created_at desc);

alter table public.publication_intents enable row level security;
drop policy if exists publication_intents_select on public.publication_intents;
create policy publication_intents_select on public.publication_intents
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists publication_intents_insert on public.publication_intents;
drop policy if exists publication_intents_update on public.publication_intents;
drop policy if exists publication_intents_delete on public.publication_intents;

-- Publication intents are server-managed. Clients can only read them.
revoke all on table public.publication_intents from anon, authenticated;
grant select on table public.publication_intents to authenticated;

create or replace function public.touch_publication_intent_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_publication_intents_updated_at on public.publication_intents;
create trigger trg_publication_intents_updated_at
before update on public.publication_intents
for each row execute function public.touch_publication_intent_updated_at();

drop trigger if exists trg_prevent_workspace_id_change on public.publication_intents;
create trigger trg_prevent_workspace_id_change
before update on public.publication_intents
for each row execute function public.prevent_workspace_id_change();
