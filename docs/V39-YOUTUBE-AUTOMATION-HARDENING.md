# AutoSEO V39 — Automation Engine Hardening

## Scope
This phase hardens the shared automation run lifecycle before the YouTube automation worker/scheduler phase.

## Changes
- Added workspace-scoped automation run idempotency keys.
- Added a unique database constraint to prevent duplicate runs for the same workspace + idempotency key.
- Manual execution now uses an atomic `queued -> running` transition and returns HTTP 409 when a run is already executing or completed.
- Run updates only set timestamps for the appropriate lifecycle states.
- Existing workflow execution behavior is preserved; durable unattended execution remains the next phase.

## Migration
Apply `supabase/v39-automation-hardening.sql` after the V37 security migration.

## Verification
Run locally:

```bash
npm run lint
npm run build
```

Then verify:
1. Creating the same run twice returns the same run ID.
2. Two concurrent execute requests cannot both claim the same queued run.
3. A succeeded/failed run cannot be executed again through the manual execute endpoint.
