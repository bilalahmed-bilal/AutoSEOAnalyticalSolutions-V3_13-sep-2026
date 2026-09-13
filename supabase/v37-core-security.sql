-- AutoSEO V37 Core Security Foundation
-- Apply after migrations through V36.
-- This migration is intentionally security-only: no product features.

-- 1) Keep role helpers deterministic and protected from search_path manipulation.
create or replace function public.is_workspace_editor(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','editor')
  );
$$;

create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

create or replace function public.prevent_workspace_id_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id cannot be changed';
  end if;
  return new;
end;
$$;

-- 2) Enforce tenant identity immutability on every current tenant table.
do $$
declare t text;
begin
  foreach t in array array[
    'connections','drafts','seo_score_history','jobs','audit_logs','calendar_items',
    'job_attempts','draft_versions','draft_publication_history','analytics_snapshots',
    'attribution_reports','seo_experiments','experiment_observations',
    'keyword_research_projects','keyword_opportunities','competitor_projects',
    'content_strategy_projects','content_studio_projects','content_studio_assets',
    'content_quality_reports','technical_seo_audits','site_architecture_projects',
    'local_seo_projects','automation_workflows','automation_runs','monitoring_profiles',
    'monitoring_snapshots','roi_reports','strategy_runs','operating_runs','oauth_states',
    'youtube_competitors','social_competitors','publication_intents','action_approvals'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_v37_workspace_id_immutable on public.%I', t);
      execute format('create trigger trg_v37_workspace_id_immutable before update on public.%I for each row execute function public.prevent_workspace_id_change()', t);
    end if;
  end loop;
end $$;

-- 3) Never grant tenant table access to the unauthenticated anon role.
do $$
declare t text;
begin
  foreach t in array array[
    'workspaces','workspace_members','connections','drafts','seo_score_history','jobs',
    'audit_logs','calendar_items','job_attempts','draft_versions','draft_publication_history',
    'analytics_snapshots','attribution_reports','roi_reports','seo_experiments',
    'experiment_observations','keyword_research_projects','keyword_opportunities',
    'competitor_projects','content_strategy_projects','content_studio_projects',
    'content_studio_assets','content_quality_reports','technical_seo_audits',
    'site_architecture_projects','local_seo_projects','automation_workflows',
    'automation_runs','monitoring_profiles','monitoring_snapshots','strategy_runs',
    'operating_runs','youtube_competitors','social_competitors','oauth_states',
    'publication_intents','action_approvals'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon', t);
    end if;
  end loop;
end $$;

-- 4) Sensitive helper functions are callable only by authenticated users.
revoke all on function public.is_workspace_editor(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_editor(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- 5) Revoke client access to the security-sensitive tenant state tables.
do $$
begin
  if to_regclass('public.connections') is not null then
    execute 'revoke insert, update, delete on public.connections from authenticated';
  end if;
  if to_regclass('public.oauth_states') is not null then
    execute 'revoke all on public.oauth_states from authenticated';
  end if;
  if to_regclass('public.jobs') is not null then
    execute 'revoke insert, update, delete on public.jobs from authenticated';
  end if;
  if to_regclass('public.job_attempts') is not null then
    execute 'revoke all on public.job_attempts from authenticated';
  end if;
  if to_regclass('public.audit_logs') is not null then
    execute 'revoke insert, update, delete on public.audit_logs from authenticated';
  end if;
end $$;
