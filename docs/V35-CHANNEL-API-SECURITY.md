# V35 Channel API Security Hardening

## Scope
This hardening closes the production security gap in the YouTube/Facebook tool APIs.

All channel-tool API routes now require verified API access and a valid authenticated workspace. Read operations require `viewer`; operations that mutate workspace data or perform external social actions require `editor` or `admin` as appropriate.

Provider credentials are loaded through the existing workspace-scoped Supabase connection repository rather than the process-wide local store when authenticated production access is used.

Competitor tracking is now workspace-scoped through `social_competitors`.

## Supabase
Run `supabase/v35-channel-tools.sql` once after the base AutoSEO migrations have created `workspaces` and RLS helper functions.

## Verification
1. `npm run build`
2. Confirm unauthenticated channel-tool calls return `401` when `AUTOSEO_AUTH_REQUIRED=true`.
3. Confirm a user from workspace A cannot see or mutate workspace B competitor records.
4. Confirm viewer cannot add/remove competitors or send/apply external changes.
5. Confirm authenticated settings are read from workspace connections, not `data/db.json`.

## Remaining hardening
Publisher adapters now share `assertSafeUrl` / `safeOutboundFetch` with the crawler (localhost, private IPs, mapped IPv6, metadata hosts, odd ports, credentials). DNS rebinding without IP pinning is still an open residual. External publish reconciliation is separate and not included here. Live RLS for `social_competitors` is **NOT VERIFIED**.
