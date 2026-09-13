# AutoSEO V41 — YouTube Automation Worker

V41 adds the execution-worker layer for durable automation runs created by V40.

## Included
- Atomic `queued -> running` run claim with `FOR UPDATE SKIP LOCKED`.
- Workspace-scoped automation-run execution.
- Dedicated worker endpoint protected by `CRON_SECRET`.
- Workflow step execution through the existing automation executor.
- Retry scheduling with bounded exponential backoff.
- Terminal failure after `max_attempts`.
- Stale running-run recovery.
- Cron integration so due runs can execute without a user request.

## Operational flow
`scheduled workflow -> automation_run(queued) -> worker claim -> execute steps -> succeeded | retry | failed`

## Required migration
Apply `supabase/v41-youtube-automation-worker.sql` after V39 and V40 migrations.

## Important
The worker uses the Supabase service role only inside the server-side worker path. Never expose the service-role key to browser/client code.
