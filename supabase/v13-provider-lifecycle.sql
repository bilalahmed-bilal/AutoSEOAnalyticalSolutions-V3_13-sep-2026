-- V13 provider lifecycle: health timestamps, safe connection uniqueness, and cleanup.
alter table public.connections add column if not exists last_checked_at timestamptz;
create index if not exists idx_connections_health on public.connections(workspace_id, status, last_checked_at);

-- Prevent multiple active connections for the same workspace/provider while retaining revoked history.
create unique index if not exists uq_active_connection_provider
on public.connections(workspace_id, provider)
where status <> 'revoked';

-- Service-role cleanup for OAuth states and old health metadata.
create or replace function public.cleanup_oauth_and_connection_metadata()
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  delete from public.oauth_states where expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.cleanup_oauth_and_connection_metadata() from public;
grant execute on function public.cleanup_oauth_and_connection_metadata() to service_role;
