-- V28 Technical SEO Automation Engine
create table if not exists public.technical_seo_audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target_url text not null,
  score integer not null check (score between 0 and 100),
  summary jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_technical_seo_workspace on public.technical_seo_audits(workspace_id, created_at desc);
create index if not exists idx_technical_seo_target on public.technical_seo_audits(workspace_id, target_url, created_at desc);
alter table public.technical_seo_audits enable row level security;
drop policy if exists technical_seo_select on public.technical_seo_audits;
drop policy if exists technical_seo_insert on public.technical_seo_audits;
create policy technical_seo_select on public.technical_seo_audits for select using (is_workspace_member(workspace_id));
create policy technical_seo_insert on public.technical_seo_audits for insert with check (is_workspace_member(workspace_id));
