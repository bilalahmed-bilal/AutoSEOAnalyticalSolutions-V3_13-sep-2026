# AutoSEO V35 — RLS + RBAC Hardening

This is a production-hardening migration, not a product feature.

## What it closes

- Aligns Supabase Row Level Security with the application roles: `owner`, `admin`, `editor`, `viewer`.
- Prevents direct client mutations on trusted/server-managed tables such as jobs, audit logs, OAuth state, analytics snapshots and monitoring snapshots.
- Prevents `workspace_id` from being changed during an update, closing a tenant-isolation bypass.
- Keeps content/analysis writes at editor level and administrative deletion at admin level.
- Keeps workspace creation on the existing `create_workspace_atomic()` RPC.

## Apply order

Run this after the existing V3–V35 schema migrations have been applied.

`supabase/v35-rbac-hardening.sql`

## Verification goals

Test with one user in each workspace role:

- viewer: SELECT allowed; editor/admin mutations denied by RLS.
- editor: content, calendar, research and workflow writes allowed; admin-only deletes denied.
- admin: editor permissions plus admin deletes/connection/member operations through the server APIs.
- owner: all admin capabilities, while owner protection remains enforced.
- cross-workspace UPDATE attempts must fail because `workspace_id` is immutable.

## Important operational note

Service-role server code bypasses RLS by design. That is expected for worker jobs, OAuth lifecycle, publication, analytics snapshots and immutable audit recording. Those server paths still require application-level authentication/authorization before invoking privileged operations.
