# V36 — YouTube Security Hardening

## Scope

This phase starts the security-first channel-by-channel gap closure. It hardens the YouTube module without changing the product's UI direction.

## Implemented

- All YouTube tool API routes now require an authenticated Supabase workspace context.
- AI-generation routes require at least the `editor` workspace role.
- YouTube data routes require a valid workspace YouTube connection.
- YouTube credentials are loaded from the workspace-scoped `connections` table rather than the legacy global JSON store.
- OAuth token refresh is reused before YouTube API calls when needed.
- Mutating YouTube endpoints reject cross-origin writes.
- Bulk YouTube optimization persists drafts through the workspace-scoped Supabase repository.
- YouTube competitor tracking moved from the global local JSON store to a workspace-scoped `youtube_competitors` table.
- Competitor reads require viewer access; additions require editor access; deletion requires admin access.
- Browser YouTube API calls now use the shared `apiFetch()` helper so the Supabase access token and selected workspace ID are sent consistently.
- Added V36 RLS policies and tenant-identity protection for YouTube competitors.

## Not claimed yet

This phase does not by itself prove production readiness. The project still needs to be built and tested in the user's environment with the real Supabase project and OAuth credentials.

## User-side verification

1. Apply `supabase/v36-youtube-security.sql` to the same Supabase project after the existing V35 hardening migration.
2. Install dependencies in the local AutoSEO project.
3. Run:

```bash
npm run lint
npm run build
```

4. Log in with a Supabase user, select a workspace, and verify YouTube tools.
5. Verify a viewer cannot add/delete competitors or perform editor-only operations.
6. Verify two different workspaces cannot see each other's YouTube competitors or connections.
