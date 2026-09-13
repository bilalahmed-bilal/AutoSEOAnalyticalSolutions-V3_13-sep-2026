-- V46: Nexora SaaS plans, entitlements, usage, platform admin, workspace status
-- Idempotent and data-preserving.

alter table public.workspaces add column if not exists status text not null default 'active';
alter table public.workspaces drop constraint if exists workspaces_status_check;
alter table public.workspaces add constraint workspaces_status_check check (status in ('active','suspended'));
alter table public.workspaces add column if not exists suspended_at timestamptz;
alter table public.workspaces add column if not exists suspended_reason text;

alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner','admin','editor','member','viewer'));

create table if not exists public.product_plans (
  slug text primary key,
  name text not null,
  description text not null default '',
  price_cents integer not null default 0,
  currency text not null default 'USD',
  billing_interval text not null default 'month' check (billing_interval in ('month','year')),
  trial_days integer not null default 0,
  team_limit integer not null default 1,
  api_access boolean not null default false,
  priority boolean not null default false,
  support_level text not null default 'community',
  status text not null default 'active' check (status in ('active','hidden','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_features (
  feature_key text primary key,
  description text not null default '',
  beta boolean not null default false,
  status text not null default 'active' check (status in ('active','disabled','beta')),
  created_at timestamptz not null default now()
);

create table if not exists public.plan_features (
  plan_slug text not null references public.product_plans(slug) on delete cascade,
  feature_key text not null references public.product_features(feature_key) on delete cascade,
  enabled boolean not null default true,
  primary key (plan_slug, feature_key)
);

create table if not exists public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  plan_slug text not null references public.product_plans(slug),
  status text not null default 'trial' check (status in ('trial','active','grace','restricted','canceled','past_due')),
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '1 month'),
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_plan text,
  to_plan text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  feature_key text not null,
  effect text not null check (effect in ('grant','revoke','limit')),
  limit_value integer,
  reason text,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists entitlement_overrides_workspace_idx on public.entitlement_overrides(workspace_id, feature_key);

create table if not exists public.usage_counters (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric text not null,
  period text not null,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, metric, period)
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  metric text not null,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_workspace_idx on public.usage_events(workspace_id, created_at desc);

create table if not exists public.billing_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null default 'none',
  provider_reference text,
  kind text not null check (kind in ('checkout','invoice','payment','refund','credit','webhook')),
  amount_cents integer,
  currency text default 'USD',
  status text not null default 'recorded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  code text primary key,
  percent_off integer,
  amount_off_cents integer,
  max_redemptions integer,
  redeemed integer not null default 0,
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now()
);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

insert into public.product_plans (slug, name, description, price_cents, trial_days, team_limit, api_access, priority, support_level)
values
  ('free','Free','Basic SEO, limited YouTube, limited AI',0,0,1,false,false,'community'),
  ('starter','Starter','More SEO usage, content generation, basic YouTube',2900,14,3,false,false,'email'),
  ('pro','Pro','Advanced SEO, YouTube analytics, Facebook, automation',7900,14,8,false,false,'email'),
  ('pro-plus','Pro+','Bulk optimization, deeper analytics, priority processing',12900,14,15,false,true,'priority'),
  ('business','Business','Teams, API, agency-ready controls',24900,14,50,true,true,'dedicated'),
  ('custom','Custom','Admin-defined limits and features',0,0,100,true,true,'dedicated')
on conflict (slug) do nothing;

insert into public.product_features (feature_key, description) values
  ('website_seo.audit','Website SEO audit'),
  ('website_seo.crawl','Website crawler'),
  ('website_seo.technical','Technical SEO'),
  ('keywords.research','Keyword research'),
  ('content.generate','Content generation'),
  ('content.refresh','Content refresh'),
  ('youtube.connect','YouTube connection'),
  ('youtube.analytics','YouTube analytics'),
  ('youtube.seo','YouTube SEO tools'),
  ('youtube.publish','YouTube publishing'),
  ('youtube.bulk','YouTube bulk optimization'),
  ('facebook.connect','Facebook connection'),
  ('facebook.analytics','Facebook analytics'),
  ('facebook.publish','Facebook publishing'),
  ('automation.basic','Basic automation'),
  ('automation.advanced','Advanced automation'),
  ('ai.strategist','AI strategist'),
  ('ai.action_center','AI action center'),
  ('api.access','Public API access'),
  ('priority.processing','Priority processing')
on conflict (feature_key) do nothing;

alter table public.product_plans enable row level security;
alter table public.product_features enable row level security;
alter table public.plan_features enable row level security;
alter table public.workspace_subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.entitlement_overrides enable row level security;
alter table public.usage_counters enable row level security;
alter table public.usage_events enable row level security;
alter table public.billing_records enable row level security;
alter table public.coupons enable row level security;
alter table public.platform_admins enable row level security;

drop policy if exists product_plans_select on public.product_plans;
create policy product_plans_select on public.product_plans for select using (true);
drop policy if exists product_features_select on public.product_features;
create policy product_features_select on public.product_features for select using (true);
drop policy if exists plan_features_select on public.plan_features;
create policy plan_features_select on public.plan_features for select using (true);

drop policy if exists workspace_subscriptions_select on public.workspace_subscriptions;
create policy workspace_subscriptions_select on public.workspace_subscriptions
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists usage_counters_select on public.usage_counters;
create policy usage_counters_select on public.usage_counters
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists entitlement_overrides_select on public.entitlement_overrides;
create policy entitlement_overrides_select on public.entitlement_overrides
  for select using (public.is_workspace_member(workspace_id));

revoke all on public.workspace_subscriptions, public.subscription_events, public.entitlement_overrides,
  public.usage_counters, public.usage_events, public.billing_records, public.coupons, public.platform_admins
  from anon;
grant select on public.product_plans, public.product_features, public.plan_features, public.workspace_subscriptions,
  public.usage_counters, public.entitlement_overrides to authenticated;
