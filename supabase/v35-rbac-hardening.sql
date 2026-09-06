-- AutoSEO V35 production hardening: RLS + RBAC alignment
-- Apply after schema.sql and all versioned migrations through v35.
-- No new product feature; this migration closes authorization/tenant-isolation gaps.

-- -----------------------------------------------------------------------------
-- 1. Role helpers
-- -----------------------------------------------------------------------------
create or replace function public.is_workspace_editor(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','editor')
  );
$$;

create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Tenant identity immutability
-- Prevent a direct client update from moving a row from workspace A to B.
-- -----------------------------------------------------------------------------
create or replace function public.prevent_workspace_id_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id cannot be changed';
  end if;
  return new;
end;
$$;

-- Tables that carry workspace tenancy.
do $$
declare
  t text;
begin
  foreach t in array array[
    'connections',
    'drafts',
    'seo_score_history',
    'jobs',
    'audit_logs',
    'calendar_items',
    'job_attempts',
    'draft_versions',
    'draft_publication_history',
    'analytics_snapshots',
    'attribution_reports',
    'seo_experiments',
    'experiment_observations',
    'keyword_research_projects',
    'keyword_opportunities',
    'competitor_projects',
    'content_strategy_projects',
    'content_studio_projects',
    'content_studio_assets',
    'content_quality_reports',
    'technical_seo_audits',
    'site_architecture_projects',
    'local_seo_projects',
    'automation_workflows',
    'automation_runs',
    'monitoring_profiles',
    'monitoring_snapshots',
    'roi_reports',
    'strategy_runs',
    'operating_runs',
    'oauth_states'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_prevent_workspace_id_change on public.%I', t);
      execute format('create trigger trg_prevent_workspace_id_change before update on public.%I for each row execute function public.prevent_workspace_id_change()', t);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Core workspace tables
-- -----------------------------------------------------------------------------
-- Workspace itself is readable to members. Creation happens through the
-- SECURITY DEFINER create_workspace_atomic() RPC. Direct client mutations are denied.
alter table public.workspaces enable row level security;
drop policy if exists workspace_select on public.workspaces;
create policy workspace_select on public.workspaces
  for select using (public.is_workspace_member(id));
drop policy if exists workspace_insert on public.workspaces;
drop policy if exists workspace_update on public.workspaces;
drop policy if exists workspace_delete on public.workspaces;

-- Membership reads are needed by the UI. Membership mutations are performed by
-- trusted server-side code/RPCs; ordinary client inserts/updates/deletes are denied.
alter table public.workspace_members enable row level security;
drop policy if exists member_select on public.workspace_members;
create policy member_select on public.workspace_members
  for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));
drop policy if exists member_insert on public.workspace_members;
drop policy if exists member_update on public.workspace_members;
drop policy if exists member_delete on public.workspace_members;

-- -----------------------------------------------------------------------------
-- 4. Publishing connections: members can inspect connection status, but only
-- trusted server code can mutate encrypted credentials.
-- -----------------------------------------------------------------------------
alter table public.connections enable row level security;
drop policy if exists connection_all on public.connections;
drop policy if exists connection_select_members on public.connections;
create policy connection_select_members on public.connections
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists connection_insert_admin on public.connections;
drop policy if exists connection_update_admin on public.connections;
drop policy if exists connection_delete_admin on public.connections;

-- -----------------------------------------------------------------------------
-- 5. Drafts / calendar: editor-level writes, member reads, admin delete.
-- -----------------------------------------------------------------------------
alter table public.drafts enable row level security;
drop policy if exists draft_all on public.drafts;
drop policy if exists draft_select_members on public.drafts;
create policy draft_select_members on public.drafts
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists draft_insert_editors on public.drafts;
create policy draft_insert_editors on public.drafts
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists draft_update_editors on public.drafts;
create policy draft_update_editors on public.drafts
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists draft_delete_admins on public.drafts;
create policy draft_delete_admins on public.drafts
  for delete using (public.is_workspace_admin(workspace_id));

alter table public.calendar_items enable row level security;
drop policy if exists calendar_all on public.calendar_items;
drop policy if exists calendar_select_members on public.calendar_items;
create policy calendar_select_members on public.calendar_items
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists calendar_insert_editors on public.calendar_items;
create policy calendar_insert_editors on public.calendar_items
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists calendar_update_editors on public.calendar_items;
create policy calendar_update_editors on public.calendar_items
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists calendar_delete_admins on public.calendar_items;
create policy calendar_delete_admins on public.calendar_items
  for delete using (public.is_workspace_admin(workspace_id));

-- -----------------------------------------------------------------------------
-- 6. SEO history: member reads, editor inserts, no client mutation afterward.
-- -----------------------------------------------------------------------------
alter table public.seo_score_history enable row level security;
drop policy if exists seo_history_all on public.seo_score_history;
drop policy if exists seo_history_select_members on public.seo_score_history;
create policy seo_history_select_members on public.seo_score_history
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists seo_history_insert_editors on public.seo_score_history;
create policy seo_history_insert_editors on public.seo_score_history
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists seo_history_update on public.seo_score_history;
drop policy if exists seo_history_delete on public.seo_score_history;

-- -----------------------------------------------------------------------------
-- 7. Jobs / worker state: member read only. Queueing and worker state transitions
-- use trusted service_role code and RPCs.
-- -----------------------------------------------------------------------------
alter table public.jobs enable row level security;
drop policy if exists jobs_all on public.jobs;
drop policy if exists jobs_select_members on public.jobs;
create policy jobs_select_members on public.jobs
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists jobs_insert on public.jobs;
drop policy if exists jobs_update on public.jobs;
drop policy if exists jobs_delete on public.jobs;

alter table public.job_attempts enable row level security;
drop policy if exists job_attempts_select on public.job_attempts;
create policy job_attempts_select on public.job_attempts
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists job_attempts_insert on public.job_attempts;
drop policy if exists job_attempts_update on public.job_attempts;
drop policy if exists job_attempts_delete on public.job_attempts;

-- -----------------------------------------------------------------------------
-- 8. Audit logs: member reads only. Writes are trusted-server only.
-- -----------------------------------------------------------------------------
alter table public.audit_logs enable row level security;
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
  for select using (workspace_id is null or public.is_workspace_member(workspace_id));
drop policy if exists audit_insert on public.audit_logs;
drop policy if exists audit_update on public.audit_logs;
drop policy if exists audit_delete on public.audit_logs;

-- -----------------------------------------------------------------------------
-- 9. Versioning / rollback: member reads, editor creates/updates versions; no
-- client deletes. Publication history is append-only from the client perspective.
-- -----------------------------------------------------------------------------
alter table public.draft_versions enable row level security;
drop policy if exists draft_versions_select on public.draft_versions;
create policy draft_versions_select on public.draft_versions
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists draft_versions_insert on public.draft_versions;
create policy draft_versions_insert on public.draft_versions
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists draft_versions_update on public.draft_versions;
create policy draft_versions_update on public.draft_versions
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists draft_versions_delete on public.draft_versions;

alter table public.draft_publication_history enable row level security;
drop policy if exists draft_publication_history_select on public.draft_publication_history;
create policy draft_publication_history_select on public.draft_publication_history
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists draft_publication_history_insert on public.draft_publication_history;
drop policy if exists draft_publication_history_update on public.draft_publication_history;
drop policy if exists draft_publication_history_delete on public.draft_publication_history;

-- -----------------------------------------------------------------------------
-- 10. Analytics / monitoring snapshots: read-only to workspace members; trusted
-- server writes the snapshots/reports.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['analytics_snapshots','monitoring_snapshots','strategy_runs'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_select', t);
      execute format('drop policy if exists %I on public.%I', t || '_insert', t);
      execute format('drop policy if exists %I on public.%I', t || '_update', t);
      execute format('drop policy if exists %I on public.%I', t || '_delete', t);
      execute format('create policy %I on public.%I for select using (public.is_workspace_member(workspace_id))', t || '_select', t);
    end if;
  end loop;
end $$;

alter table public.attribution_reports enable row level security;
drop policy if exists attribution_reports_select on public.attribution_reports;
create policy attribution_reports_select on public.attribution_reports
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists attribution_reports_insert on public.attribution_reports;
drop policy if exists attribution_reports_update on public.attribution_reports;
drop policy if exists attribution_reports_delete on public.attribution_reports;

alter table public.roi_reports enable row level security;
drop policy if exists roi_reports_select_members on public.roi_reports;
create policy roi_reports_select_members on public.roi_reports
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists roi_reports_insert_members on public.roi_reports;
drop policy if exists roi_reports_update_admins on public.roi_reports;
drop policy if exists roi_reports_delete_admins on public.roi_reports;

-- -----------------------------------------------------------------------------
-- 11. Research/analysis tables: members read; editors write; admins delete.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'keyword_research_projects',
    'competitor_projects',
    'content_strategy_projects',
    'content_studio_projects',
    'content_quality_reports',
    'technical_seo_audits',
    'site_architecture_projects',
    'local_seo_projects'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_select', t);
      execute format('drop policy if exists %I on public.%I', t || '_insert', t);
      execute format('drop policy if exists %I on public.%I', t || '_update', t);
      execute format('drop policy if exists %I on public.%I', t || '_delete', t);
      execute format('create policy %I on public.%I for select using (public.is_workspace_member(workspace_id))', t || '_select', t);
      execute format('create policy %I on public.%I for insert with check (public.is_workspace_editor(workspace_id))', t || '_insert', t);
      execute format('create policy %I on public.%I for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id))', t || '_update', t);
      execute format('create policy %I on public.%I for delete using (public.is_workspace_admin(workspace_id))', t || '_delete', t);
    end if;
  end loop;
end $$;

-- Keyword opportunities are replaced as a batch by editor-level keyword research.
alter table public.keyword_opportunities enable row level security;
drop policy if exists keyword_opportunities_select on public.keyword_opportunities;
create policy keyword_opportunities_select on public.keyword_opportunities
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists keyword_opportunities_insert on public.keyword_opportunities;
create policy keyword_opportunities_insert on public.keyword_opportunities
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists keyword_opportunities_update on public.keyword_opportunities;
create policy keyword_opportunities_update on public.keyword_opportunities
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists keyword_opportunities_delete on public.keyword_opportunities;
create policy keyword_opportunities_delete on public.keyword_opportunities
  for delete using (public.is_workspace_editor(workspace_id));

-- Content studio assets may be created/updated by editors; deletes remain admin-only.
alter table public.content_studio_assets enable row level security;
drop policy if exists content_studio_assets_select on public.content_studio_assets;
create policy content_studio_assets_select on public.content_studio_assets
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists content_studio_assets_insert on public.content_studio_assets;
create policy content_studio_assets_insert on public.content_studio_assets
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists content_studio_assets_update on public.content_studio_assets;
create policy content_studio_assets_update on public.content_studio_assets
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists content_studio_assets_delete on public.content_studio_assets;
create policy content_studio_assets_delete on public.content_studio_assets
  for delete using (public.is_workspace_admin(workspace_id));

-- -----------------------------------------------------------------------------
-- 12. Automation: members read, editors mutate workflow definitions/runs. Worker
-- state is still subject to same role boundary for direct REST clients.
-- -----------------------------------------------------------------------------
alter table public.automation_workflows enable row level security;
drop policy if exists automation_workflows_member on public.automation_workflows;
drop policy if exists automation_workflows_select on public.automation_workflows;
drop policy if exists automation_workflows_insert on public.automation_workflows;
drop policy if exists automation_workflows_update on public.automation_workflows;
drop policy if exists automation_workflows_delete on public.automation_workflows;
create policy automation_workflows_select on public.automation_workflows
  for select using (public.is_workspace_member(workspace_id));
create policy automation_workflows_insert on public.automation_workflows
  for insert with check (public.is_workspace_editor(workspace_id));
create policy automation_workflows_update on public.automation_workflows
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
create policy automation_workflows_delete on public.automation_workflows
  for delete using (public.is_workspace_admin(workspace_id));

alter table public.automation_runs enable row level security;
drop policy if exists automation_runs_member on public.automation_runs;
drop policy if exists automation_runs_select on public.automation_runs;
drop policy if exists automation_runs_insert on public.automation_runs;
drop policy if exists automation_runs_update on public.automation_runs;
drop policy if exists automation_runs_delete on public.automation_runs;
create policy automation_runs_select on public.automation_runs
  for select using (public.is_workspace_member(workspace_id));
create policy automation_runs_insert on public.automation_runs
  for insert with check (public.is_workspace_editor(workspace_id));
create policy automation_runs_update on public.automation_runs
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists automation_runs_delete on public.automation_runs;
create policy automation_runs_delete on public.automation_runs
  for delete using (public.is_workspace_admin(workspace_id));

-- -----------------------------------------------------------------------------
-- 13. Experiments: member reads, editors manage experiments/observations; no
-- direct delete for observations.
-- -----------------------------------------------------------------------------
alter table public.seo_experiments enable row level security;
drop policy if exists seo_experiments_select on public.seo_experiments;
create policy seo_experiments_select on public.seo_experiments
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists seo_experiments_insert on public.seo_experiments;
create policy seo_experiments_insert on public.seo_experiments
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists seo_experiments_update on public.seo_experiments;
create policy seo_experiments_update on public.seo_experiments
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists seo_experiments_delete on public.seo_experiments;
create policy seo_experiments_delete on public.seo_experiments
  for delete using (public.is_workspace_admin(workspace_id));

alter table public.experiment_observations enable row level security;
drop policy if exists experiment_observations_select on public.experiment_observations;
create policy experiment_observations_select on public.experiment_observations
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists experiment_observations_insert on public.experiment_observations;
create policy experiment_observations_insert on public.experiment_observations
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists experiment_observations_update on public.experiment_observations;
create policy experiment_observations_update on public.experiment_observations
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists experiment_observations_delete on public.experiment_observations;

-- -----------------------------------------------------------------------------
-- 14. Monitoring profiles: member reads, editors manage profiles. Snapshots are
-- trusted-server writes and member reads.
-- -----------------------------------------------------------------------------
alter table public.monitoring_profiles enable row level security;
drop policy if exists monitoring_profiles_member on public.monitoring_profiles;
drop policy if exists monitoring_profiles_select on public.monitoring_profiles;
drop policy if exists monitoring_profiles_insert on public.monitoring_profiles;
drop policy if exists monitoring_profiles_update on public.monitoring_profiles;
drop policy if exists monitoring_profiles_delete on public.monitoring_profiles;
create policy monitoring_profiles_select on public.monitoring_profiles
  for select using (public.is_workspace_member(workspace_id));
create policy monitoring_profiles_insert on public.monitoring_profiles
  for insert with check (public.is_workspace_editor(workspace_id));
create policy monitoring_profiles_update on public.monitoring_profiles
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
create policy monitoring_profiles_delete on public.monitoring_profiles
  for delete using (public.is_workspace_admin(workspace_id));

-- -----------------------------------------------------------------------------
-- 15. Operating runs are created by the authenticated operating-system UI, so
-- editors can insert and members can inspect history.
-- -----------------------------------------------------------------------------
alter table public.operating_runs enable row level security;
drop policy if exists operating_runs_select on public.operating_runs;
create policy operating_runs_select on public.operating_runs
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists operating_runs_insert on public.operating_runs;
create policy operating_runs_insert on public.operating_runs
  for insert with check (public.is_workspace_editor(workspace_id));
drop policy if exists operating_runs_update on public.operating_runs;
drop policy if exists operating_runs_delete on public.operating_runs;

-- -----------------------------------------------------------------------------
-- 16. OAuth states: service-side lifecycle only. No client table access.
-- -----------------------------------------------------------------------------
alter table public.oauth_states enable row level security;
drop policy if exists oauth_states_select on public.oauth_states;
drop policy if exists oauth_states_insert on public.oauth_states;
drop policy if exists oauth_states_update on public.oauth_states;
drop policy if exists oauth_states_delete on public.oauth_states;

-- -----------------------------------------------------------------------------
-- 17. Explicit grants: PostgREST's authenticated role must have table privileges,
-- while RLS policies are the row/role boundary. Service role remains unrestricted.
-- -----------------------------------------------------------------------------
grant select on public.workspaces, public.workspace_members, public.connections,
  public.drafts, public.seo_score_history, public.jobs, public.audit_logs,
  public.calendar_items, public.job_attempts, public.draft_versions,
  public.draft_publication_history, public.analytics_snapshots,
  public.attribution_reports, public.roi_reports, public.seo_experiments,
  public.experiment_observations, public.keyword_research_projects,
  public.keyword_opportunities, public.competitor_projects,
  public.content_strategy_projects, public.content_studio_projects,
  public.content_studio_assets, public.content_quality_reports,
  public.technical_seo_audits, public.site_architecture_projects,
  public.local_seo_projects, public.automation_workflows,
  public.automation_runs, public.monitoring_profiles,
  public.monitoring_snapshots, public.strategy_runs, public.operating_runs
  to authenticated;

grant insert on public.drafts, public.seo_score_history, public.calendar_items,
  public.draft_versions, public.keyword_research_projects,
  public.keyword_opportunities, public.competitor_projects,
  public.content_strategy_projects, public.content_studio_projects,
  public.content_studio_assets, public.content_quality_reports,
  public.technical_seo_audits, public.site_architecture_projects,
  public.local_seo_projects, public.automation_workflows,
  public.automation_runs, public.seo_experiments,
  public.experiment_observations, public.monitoring_profiles,
  public.operating_runs
  to authenticated;

grant update on public.drafts, public.calendar_items, public.draft_versions,
  public.keyword_research_projects, public.keyword_opportunities,
  public.competitor_projects, public.content_strategy_projects,
  public.content_studio_assets, public.automation_workflows,
  public.automation_runs, public.seo_experiments,
  public.experiment_observations, public.monitoring_profiles
  to authenticated;

grant delete on public.drafts, public.calendar_items, public.keyword_opportunities,
  public.competitor_projects, public.content_strategy_projects,
  public.content_studio_projects, public.content_studio_assets,
  public.technical_seo_audits, public.site_architecture_projects,
  public.local_seo_projects, public.automation_workflows,
  public.automation_runs, public.seo_experiments, public.monitoring_profiles
  to authenticated;

-- Never expose credential/OAuth/job-state mutation to the authenticated
-- PostgREST client. Read-only access remains available where the UI needs it.
revoke insert, update, delete on public.connections from authenticated;
revoke all on public.oauth_states from authenticated;
revoke insert, update, delete on public.jobs from authenticated;
revoke all on public.job_attempts from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
revoke insert, update, delete on public.analytics_snapshots from authenticated;
revoke insert, update, delete on public.monitoring_snapshots from authenticated;
revoke insert, update, delete on public.strategy_runs from authenticated;

-- RPC privileges used by the application.
revoke all on function public.is_workspace_editor(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_editor(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- Ensure the existing workspace-creation RPC remains the supported mutation path.
revoke all on function public.create_workspace_atomic(text, text) from public;
grant execute on function public.create_workspace_atomic(text, text) to authenticated;
