# AutoSEO Supabase migration reconciliation

**Date:** 2026-09-13  
**Apply file:** `supabase/COMBINED-MIGRATION.sql` (through V44)  
**Do not** apply this by running destructive SQL, deleting rows, or pointing it at production without a backup. This audit did not touch any live database.

## Strategy

Use **one file**: paste `COMBINED-MIGRATION.sql` into the Supabase SQL Editor and run it once.

| Database | What happens |
|---|---|
| **A. Fresh** | `CREATE TABLE IF NOT EXISTS` / `CREATE OR REPLACE` build the full schema through V44. |
| **B. Current partial** (workspaces, workspace_members, connections, drafts, seo_score_history, jobs, audit_logs, calendar_items, job_attempts) | Existing tables are left in place. Missing tables/functions/policies are added. `job_attempts` is **altered** to the canonical worker schema without dropping rows. |

Versioned `supabase/v*.sql` files remain the source of truth and match the combined file. There is **no V38 or V43 SQL** (those versions are application-only).

## Canonical objects the app requires

### `job_attempts` (`lib/jobs/attempts.ts`)

Columns used: `job_id`, `workspace_id`, `attempt`, `worker_id`, `status` (`running` \| `succeeded` \| `failed`), `finished_at`, `error_message`, `provider_job_id`, `provider_link`. Upsert key: `UNIQUE (job_id, attempt)`. `created_at` is part of the canonical table (default `now()`) and the workspace index; the app does not write it explicitly.

`CREATE TABLE IF NOT EXISTS` does **not** add columns to an already-present table. V6 therefore only creates the table. V11 adds every canonical column (including `created_at` and `attempt`), copies `attempt_no` into `attempt` when that legacy column exists, then creates indexes and policies. Existing rows are kept.

### `recover_stale_jobs(interval)` (`app/api/cron/autoseo/route.ts`)

Cron posts `{ "p_stale_after": "10 minutes" }`. One function remains:

- Parameter name: **`p_stale_after`** (not `stale_after`)
- Re-queue sets `run_after = now()` so `enforce_job_transition()` allows `running → queued`
- Exhausted `max_attempts` marks the job `failed`

The old V11 copy (`stale_after`, always re-queue, 15-minute default) is removed. It overwrote the V6 function because PostgreSQL `CREATE OR REPLACE` keeps the `(interval)` signature and only changes argument names, which then broke PostgREST named-argument matching.

## Issues found and fixed (original line references)

Line numbers below are the **pre-fix** locations unless marked *new*.

### Blocking apply failures

| Issue | Original location | Fix |
|---|---|---|
| `job_attempts_select` created twice; V11 had no `DROP POLICY IF EXISTS` | `COMBINED-MIGRATION.sql` L267 then L492; `v11-data-integrity.sql` L170 | Drop then create. Combined *new* L228 / L575. |
| Combined file stopped at V36; missing V35 channel tools and V37/V39/V40/V41/V42/V44 | `COMBINED-MIGRATION.sql` ended ~L1673; no `social_competitors` / `publication_intents` / `action_approvals` | Included in order. Combined *new* L1245, L1875, L1985, L2000, L2032, L2104, L2164. |
| V33 `roi_reports_*` policies created without drop (re-run fails) | `v33-advanced-analytics.sql` L17–L20 | `DROP POLICY IF EXISTS` before each create. |
| V30 `local_seo_projects_updated_at` trigger created without drop (re-run fails) | `v30-local-seo.sql` L13 | `DROP TRIGGER IF EXISTS` first. |

### Incompatible duplicates

| Issue | Original location | Fix |
|---|---|---|
| Two `recover_stale_jobs(interval)` bodies; last write used `stale_after` | Combined L230–L248 vs L448–L468; `v6-queue.sql` L44–L63; `v11-data-integrity.sql` L126–L149 | Drop `(interval)` then create canonical `p_stale_after`. Removed from V11. Combined *new* L239–L263. |
| Two `job_attempts` definitions; V11 `IF NOT EXISTS` was a no-op on the older table | Combined L253–L262 vs L474–L488; `v6-queue.sql` L67–L76; `v11-data-integrity.sql` L152–L166 | Canonical `CREATE TABLE IF NOT EXISTS` plus `ADD COLUMN IF NOT EXISTS` reconciliation. Combined *new* L266–L281 and L493–L575. |
| `idx_job_attempts_job` defined as `(job_id, created_at desc)` then `(job_id, attempt desc)` | Combined L263 vs L489 | Drop and recreate `(job_id, attempt desc)`. |

### Ordering / dependency / grants

| Issue | Original location | Fix |
|---|---|---|
| `idx_job_attempts_workspace` on `(workspace_id, created_at desc)` ran in V6 before V11 added `created_at`. Current partial `job_attempts` has no `created_at`, so apply failed. V6 also indexed `attempt` before that column is guaranteed. | Combined (previous) ~L282–L283; `v6-queue.sql` L88–L89 | V6 no longer creates `job_attempts` indexes or policies. V11 adds columns first (combined *new* L514–L524), then indexes (L628–L631). |
| V6 recover did not set `run_after`; V11 trigger rejects `running → queued` when `run_after` is null | `v6-queue.sql` L52–L59; `v11-data-integrity.sql` L80–L82 | Canonical recover sets `run_after` on re-queue. |
| V35 RBAC left legacy `FOR ALL` policies (`keyword_projects_all`, `content_strategy_*`, `technical_seo_*`, `site_architecture_*`, `monitoring_snapshots_member`) | `v35-rbac-hardening.sql` §11 vs `v23` L40–L42, `v25` L12–L15, `v28` L16–L18, `v29` L19–L21, `v32` L20 | Explicit `DROP POLICY IF EXISTS` for those names. |
| V37 `REVOKE ALL ON t1, t2, …` fails if any table is missing; `social_competitors` omitted | `v37-core-security.sql` L62–L73 | `to_regclass` loop; include later tenant tables when present. |
| V36 trigger needs `is_workspace_editor` / `prevent_workspace_id_change` | `v36-youtube-security.sql` L25, L34 | Still after V35 RBAC (combined *new* L1279 then L1834). |
| V44 `action_approvals` had no anon revoke | `v44-youtube-approval-risk.sql` L28 | Revoke anon; grant authenticated select/insert/update. |

### Idempotency hardening

| Issue | Original location | Fix |
|---|---|---|
| `ADD CONSTRAINT` role/provider checks could error on duplicate_object | `v10-security.sql` L7–L11; `v20-analytics.sql` L19–L22 | Drop if exists + exception handler. |
| `uq_workspace_single_owner` / `uq_active_publish_draft` abort the whole script on duplicate data | `v11-data-integrity.sql` L26–L28, L181–L184 | Create only when no duplicates; otherwise `RAISE NOTICE` and continue. **No rows deleted.** |

### Intentionally not changed

- `connections` unique `(workspace_id, provider)` is **kept**. V13 added a partial unique index for revoked history, but the app upserts with `on_conflict=workspace_id,provider` (`lib/store-repository.ts`, `lib/oauth/provider.ts`). Dropping the full unique constraint would break those upserts.
- Compatible `CREATE OR REPLACE` of `is_workspace_editor`, `is_workspace_owner`, and `prevent_workspace_id_change` in V35 RBAC and V37 is left in place (same signatures).

## Combined file section map (new file)

| Section | Combined line | Status |
|---|---|---|
| schema.sql | 15 | included |
| v6-queue.sql | 194 | included, canonical recover + job_attempts |
| v10-security.sql | 289 | included |
| v11-data-integrity.sql | 346 | included, reconciliation only |
| v12–v34 | 633–1231 | included |
| v35-operating-system.sql | 1231 | included |
| v35-channel-tools.sql | 1245 | **was missing; now included** |
| v35-rbac-hardening.sql | 1279 | included |
| v36-youtube-security.sql | 1834 | included |
| v37-core-security.sql | 1875 | **was missing; now included** |
| v39-automation-hardening.sql | 1985 | **was missing; now included** |
| v40-automation-scheduler.sql | 2000 | **was missing; now included** |
| v41-youtube-automation-worker.sql | 2032 | **was missing; now included** |
| v42-youtube-publishing-reliability.sql | 2104 | **was missing; now included** |
| v44-youtube-approval-risk.sql | 2164 | **was missing; now included** |

**Confirmation:** all migration sections through V44 are present. V38 and V43 have no SQL files.

## Static validation (already run against the new combined file)

Two apply models were checked:

- **fresh** — `CREATE TABLE IF NOT EXISTS` establishes columns
- **partial** — the nine current tables already exist; `CREATE TABLE IF NOT EXISTS` adds no columns; `job_attempts` is modeled **without** `created_at` or `attempt`

Both passed:

- No `CREATE INDEX` / `CREATE TRIGGER` / `CREATE POLICY` on a missing table
- No `CREATE INDEX` referencing a column before `ADD COLUMN IF NOT EXISTS` (or a real `CREATE TABLE` on a new table)
- Trigger `EXECUTE FUNCTION` and `GRANT EXECUTE` only after the function is created
- Exactly one `recover_stale_jobs(interval)` definition with `p_stale_after`
- V6 contains **no** `job_attempts` indexes; V11 adds `created_at` before `idx_job_attempts_workspace`

Other indexes that add columns first (still valid):

- V12/V13: `connections` token/health columns then `idx_connections_health`
- V19: `rollback_of_version_id` then `idx_draft_versions_rollback`
- V39: `idempotency_key` then unique index
- V41: `attempts` / `run_after` / `locked_at` / `locked_by` as separate `ADD COLUMN IF NOT EXISTS` statements, then due/lock indexes

## Post-apply checks (run in SQL Editor after the combined script)

```sql
-- 1) Canonical recover_stale_jobs argument name
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_arguments(p.oid) as named_args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'recover_stale_jobs';
-- expect one row: named_args includes p_stale_after interval

-- 2) job_attempts canonical columns + unique (job_id, attempt)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'job_attempts'
order by ordinal_position;
-- expect worker_id, started_at, finished_at, provider_job_id, status, attempt

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.job_attempts'::regclass;

-- 3) Required RPCs exist
select proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in (
    'claim_next_job','recover_stale_jobs','create_workspace_atomic',
    'claim_next_automation_run','recover_stale_automation_runs',
    'is_workspace_member','is_workspace_editor','is_workspace_owner'
  )
order by 1;

-- 4) Product tables through V44
select c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in (
    'social_competitors','youtube_competitors','publication_intents',
    'action_approvals','automation_runs','automation_workflows'
  )
order by 1;

-- 5) automation_runs worker columns (V39/V41)
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'automation_runs'
  and column_name in ('idempotency_key','attempts','max_attempts','run_after','locked_at','locked_by')
order by 1;

-- 6) Smoke RPCs (service role / SQL editor)
select public.recover_stale_jobs(interval '10 minutes');
select public.recover_stale_automation_runs(interval '10 minutes');
```

If `job_attempts` unique `(job_id, attempt)` is missing after apply, inspect duplicates with:

```sql
select job_id, attempt, count(*)
from public.job_attempts
group by 1, 2
having count(*) > 1;
```

Do not delete those rows automatically. Resolve them, then add the unique constraint by re-running the V11 unique block.
