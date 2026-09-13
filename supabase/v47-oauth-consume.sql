-- V47: atomic OAuth state consume (optional).
-- The application already consumes oauth_states with a single DELETE ... WHERE
-- state_hash + provider + expires_at > now, Prefer: return=representation.
-- Apply this only if you want a SQL function for the same operation.

create or replace function public.consume_oauth_state(p_state_hash text, p_provider text)
returns table(id uuid, workspace_id uuid, actor_user_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  delete from public.oauth_states
  where state_hash = p_state_hash
    and provider = p_provider
    and expires_at > now()
  returning oauth_states.id, oauth_states.workspace_id, oauth_states.actor_user_id, oauth_states.expires_at;
end;
$$;

revoke all on function public.consume_oauth_state(text, text) from public, anon, authenticated;
grant execute on function public.consume_oauth_state(text, text) to service_role;
