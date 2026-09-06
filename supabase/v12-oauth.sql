-- V12 OAuth connection lifecycle
create table if not exists public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  provider text not null check (provider in ('google-youtube','facebook')),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_oauth_states_expiry on public.oauth_states(expires_at);
alter table public.oauth_states enable row level security;
-- OAuth states are created/consumed only by trusted server code.
revoke all on public.oauth_states from anon, authenticated;

-- Extra connection metadata for token lifecycle.
alter table public.connections add column if not exists token_expires_at timestamptz;
alter table public.connections add column if not exists last_token_refresh_at timestamptz;
alter table public.connections add column if not exists display_name text;

-- Remove expired one-time OAuth states. Run from a trusted scheduler if desired.
create or replace function public.cleanup_expired_oauth_states()
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  delete from public.oauth_states where expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.cleanup_expired_oauth_states() from public;
grant execute on function public.cleanup_expired_oauth_states() to service_role;
