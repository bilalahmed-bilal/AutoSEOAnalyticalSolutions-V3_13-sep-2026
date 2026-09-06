-- V22: sequential SEO experimentation. This is measurement-based, not randomized traffic splitting.
create table if not exists public.seo_experiments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  target_url text not null,
  metric text not null default 'ctr' check (metric in ('ctr','clicks','impressions','position')),
  status text not null default 'draft' check (status in ('draft','running_a','running_b','evaluating','winner_a','winner_b','inconclusive','promoted','stopped')),
  variant_a_version_id uuid not null references public.draft_versions(id),
  variant_b_version_id uuid not null references public.draft_versions(id),
  baseline_start date,
  baseline_end date,
  variant_a_start date,
  variant_a_end date,
  variant_b_start date,
  variant_b_end date,
  min_impressions integer not null default 100,
  min_clicks integer not null default 10,
  confidence_threshold numeric not null default 0.95 check (confidence_threshold > 0 and confidence_threshold < 1),
  min_absolute_ctr_lift numeric not null default 0.01 check (min_absolute_ctr_lift >= 0),
  result jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_seo_experiments_workspace on public.seo_experiments(workspace_id, created_at desc);
create index if not exists idx_seo_experiments_draft on public.seo_experiments(draft_id, created_at desc);

create table if not exists public.experiment_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  experiment_id uuid not null references public.seo_experiments(id) on delete cascade,
  variant text not null check (variant in ('a','b','baseline')),
  period_start date not null,
  period_end date not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric not null default 0,
  average_position numeric,
  created_at timestamptz not null default now(),
  unique(experiment_id, variant, period_start, period_end)
);
create index if not exists idx_experiment_observations_experiment on public.experiment_observations(experiment_id, created_at desc);

alter table public.seo_experiments enable row level security;
alter table public.experiment_observations enable row level security;

drop policy if exists seo_experiments_select on public.seo_experiments;
create policy seo_experiments_select on public.seo_experiments for select using (public.is_workspace_member(workspace_id));
drop policy if exists seo_experiments_insert on public.seo_experiments;
create policy seo_experiments_insert on public.seo_experiments for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists seo_experiments_update on public.seo_experiments;
create policy seo_experiments_update on public.seo_experiments for update using (public.is_workspace_admin(workspace_id) or public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists seo_experiments_delete on public.seo_experiments;
create policy seo_experiments_delete on public.seo_experiments for delete using (public.is_workspace_admin(workspace_id));

drop policy if exists experiment_observations_select on public.experiment_observations;
create policy experiment_observations_select on public.experiment_observations for select using (public.is_workspace_member(workspace_id));
drop policy if exists experiment_observations_insert on public.experiment_observations;
create policy experiment_observations_insert on public.experiment_observations for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists experiment_observations_update on public.experiment_observations;
create policy experiment_observations_update on public.experiment_observations for update using (public.is_workspace_admin(workspace_id) or public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create or replace function public.set_seo_experiment_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_seo_experiment_updated_at on public.seo_experiments;
create trigger trg_seo_experiment_updated_at before update on public.seo_experiments for each row execute function public.set_seo_experiment_updated_at();
