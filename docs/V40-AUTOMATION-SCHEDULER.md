# AutoSEO V40 — YouTube Automation Scheduler

V40 adds the production scheduling layer for scheduled automation workflows.

## What changed
- Due `automation_workflows` are discovered by the cron endpoint.
- Each due workflow creates an idempotent `automation_runs` record.
- `next_run_at` is calculated when a scheduled workflow is created or updated.
- Supported schedule formats: `hourly`, `every N minutes/hours/days`, `daily HH:MM`, and ISO timestamps.
- A database trigger prevents an automation run from referencing a workflow in another workspace.
- The existing publish worker remains unchanged.

## Important
V40 dispatches scheduled workflows into durable `automation_runs`; full step execution by a dedicated automation worker remains the next reliability phase.

## Migration
Apply `supabase/v40-automation-scheduler.sql` after the previous security/automation migrations.
