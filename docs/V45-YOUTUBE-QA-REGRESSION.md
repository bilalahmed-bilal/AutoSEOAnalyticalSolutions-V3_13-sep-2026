# V45 — YouTube QA & Regression Baseline

V45 adds a dependency-free Node.js regression suite for the YouTube security, approval, and automation boundaries introduced in V36–V44.

## Covered

- Shared authenticated/workspace access guard on YouTube API routes.
- Same-origin protection on browser mutation routes.
- No regression to the legacy global `getPublishSettings()` path in YouTube routes.
- Bulk optimization remains approval-gated.
- Approval review remains workspace-scoped and pending-only.
- Critical actions cannot be auto-executed.
- Approval RLS and workspace-id immutability remain present in the migration.

## Run locally

```bash
npm test
```

For the full project verification, also run:

```bash
npm run lint
npm run build
```

V45 does not claim production readiness until the local build, lint, Supabase migrations, and runtime/integration checks pass in the user's environment.
