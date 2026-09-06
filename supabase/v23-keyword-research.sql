-- V23: Advanced keyword research and opportunity intelligence.
create table if not exists public.keyword_research_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  seed_keyword text not null,
  target_url text,
  status text not null default 'ready' check (status in ('draft','running','ready','failed')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.keyword_opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.keyword_research_projects(id) on delete cascade,
  keyword text not null,
  normalized_keyword text not null,
  source text not null check (source in ('seed','related','question','modifier','page','gsc')),
  intent text not null check (intent in ('informational','commercial','transactional','navigational','local','mixed')),
  relevance_score integer not null check (relevance_score between 0 and 100),
  opportunity_score integer not null check (opportunity_score between 0 and 100),
  difficulty_score integer not null check (difficulty_score between 0 and 100),
  content_fit_score integer not null check (content_fit_score between 0 and 100),
  current_signal_score integer not null check (current_signal_score between 0 and 100),
  tier text not null check (tier in ('priority','strong','watch','low')),
  recommended_content_type text not null check (recommended_content_type in ('pillar','landing-page','article','faq','comparison','local-page')),
  recommendation text not null,
  created_at timestamptz not null default now(),
  unique(project_id, normalized_keyword)
);
create index if not exists idx_keyword_projects_workspace on public.keyword_research_projects(workspace_id,created_at desc);
create index if not exists idx_keyword_opportunities_project on public.keyword_opportunities(project_id,opportunity_score desc);
create index if not exists idx_keyword_opportunities_workspace on public.keyword_opportunities(workspace_id,opportunity_score desc);

alter table public.keyword_research_projects enable row level security;
alter table public.keyword_opportunities enable row level security;
drop policy if exists keyword_projects_all on public.keyword_research_projects;
create policy keyword_projects_all on public.keyword_research_projects for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists keyword_opportunities_all on public.keyword_opportunities;
create policy keyword_opportunities_all on public.keyword_opportunities for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create or replace function public.set_keyword_research_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_keyword_research_updated_at on public.keyword_research_projects;
create trigger trg_keyword_research_updated_at before update on public.keyword_research_projects for each row execute function public.set_keyword_research_updated_at();
