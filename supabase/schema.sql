-- AutoSEO production foundation: PostgreSQL/Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('wordpress','shopify','custom','youtube','facebook','google-search-console')),
  display_name text,
  encrypted_credentials text not null,
  status text not null default 'active' check (status in ('active','degraded','revoked','error')),
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel text not null,
  kind text not null,
  title text not null,
  body text not null,
  meta_description text,
  video_id text,
  target_url text,
  suggested_headings jsonb,
  schema_jsonld text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  published_url text,
  error_message text
);

create table if not exists public.seo_score_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  url text not null,
  score integer not null check (score between 0 and 100),
  deterministic_score integer check (deterministic_score between 0 and 100),
  ai_score integer check (ai_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  idempotency_key text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  provider_job_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_drafts_workspace on public.drafts(workspace_id, created_at desc);
create index if not exists idx_seo_history_workspace on public.seo_score_history(workspace_id, created_at desc);
create index if not exists idx_jobs_due on public.jobs(status, run_after);
create index if not exists idx_audit_workspace on public.audit_logs(workspace_id, created_at desc);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.connections enable row level security;
alter table public.drafts enable row level security;
alter table public.seo_score_history enable row level security;
alter table public.jobs enable row level security;
alter table public.audit_logs enable row level security;

-- Membership helper. SECURITY DEFINER avoids recursive policy evaluation.
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin')
  );
$$;

drop policy if exists workspace_select on public.workspaces;
create policy workspace_select on public.workspaces for select using (public.is_workspace_member(id));

drop policy if exists member_select on public.workspace_members;
create policy member_select on public.workspace_members for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

drop policy if exists connection_all on public.connections;
create policy connection_all on public.connections for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists draft_all on public.drafts;
create policy draft_all on public.drafts for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists seo_history_all on public.seo_score_history;
create policy seo_history_all on public.seo_score_history for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists jobs_all on public.jobs;
create policy jobs_all on public.jobs for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select using (workspace_id is null or public.is_workspace_member(workspace_id));

-- Inserts into audit logs should normally happen through trusted server code.
-- A production deployment should additionally restrict direct client inserts.

create table if not exists public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel text not null,
  topic text not null,
  scheduled_date date not null,
  status text not null default 'planned' check (status in ('planned','generated','failed')),
  created_at timestamptz not null default now(),
  result_draft_id uuid references public.drafts(id) on delete set null,
  error_message text
);
create index if not exists idx_calendar_workspace_date on public.calendar_items(workspace_id, scheduled_date);
alter table public.calendar_items enable row level security;
drop policy if exists calendar_all on public.calendar_items;
create policy calendar_all on public.calendar_items for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
