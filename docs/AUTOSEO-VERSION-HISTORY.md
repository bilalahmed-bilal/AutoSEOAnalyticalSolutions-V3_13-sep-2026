# AutoSEO — Consolidated Version History (V3–V35)

This document consolidates the version-specific implementation notes that were previously spread across multiple README-Vxx.md and docs/Vxx-*.md files. It is documentation only; source code and Supabase migrations remain in their original locations.

## V3-PRODUCTION-FOUNDATION

# AutoSEO V3 Production Foundation

This update adds the code and SQL foundation for the highest-priority architecture gaps identified in the V2 gap report.

## Added

- Supabase/PostgreSQL schema for workspaces, members, connections, drafts, SEO history, jobs and audit logs.
- Row Level Security policies and workspace membership helpers.
- Server-side Supabase Auth verification through `/auth/v1/user` rather than trusting unverified JWT claims.
- Tenant context helper using an explicit `x-workspace-id`.
- Durable-job data model with status, retries, scheduling fields and idempotency keys.
- Exponential retry helper and deterministic idempotency-key generator.
- Environment placeholders for Supabase and production auth.

## Important

This is a migration foundation, not a claim that the current application is already a fully deployed SaaS.

Before production:

1. Run `supabase/schema.sql` against the production Supabase project.
2. Implement login/session handling in the UI and send authenticated requests.
3. Require tenant context on every user-owned API route.
4. Replace `data/db.json` reads/writes with PostgreSQL repositories.
5. Move secrets from JSON storage into `connections.encrypted_credentials` (or a managed secret store) and rotate legacy credentials.
6. Use a distributed queue/worker to consume `jobs`; do not execute long-running jobs in request handlers.
7. Add server-side authorization checks in addition to RLS.
8. Enable strict auth in production (`AUTOSEO_AUTH_REQUIRED=true`) and remove anonymous fallbacks.
9. Use an isolated outbound crawler worker/proxy for SSRF-sensitive fetching.
10. Add automated tests before public launch.

## Migration principle

The original AutoSEO feature set remains the source of truth. This foundation should be merged into the complete application; it must not replace working publishing, analytics, calendar, queue or dashboard features.

## V4-AUTH-API-FOUNDATION

# AutoSEO V4 — Auth & API Foundation

## What changed

V4 strengthens the V3 production foundation without breaking the existing local demo workflow.

### 1. Central API authentication guard

`lib/auth/api-access.ts` adds a single helper used by application data/mutation routes.

- `AUTOSEO_AUTH_REQUIRED=false` keeps the current local single-user demo usable.
- `AUTOSEO_AUTH_REQUIRED=true` requires a verified Supabase bearer access token.
- Token verification is performed against Supabase Auth; routes do not trust an unverified JWT payload.
- Unauthenticated requests receive HTTP 401 when production enforcement is enabled.

Protected application routes now include analysis, generation, analytics, calendar, automation run, queue, report, SEO fixes, settings and trends.

`/api/auth/me` remains the explicit authentication probe endpoint.

### 2. Workspace management API

`/api/workspaces` provides:

- `GET` — list workspaces for the authenticated user.
- `POST` — create a workspace and assign the authenticated user as `owner`.

Workspace creation uses the Supabase service-role key only on the trusted server boundary. The service-role key must never be exposed to the browser.

### 3. Existing local store remains intentionally unchanged

The current `lib/store.ts` JSON store is still the local/demo persistence layer. V4 does **not** claim that the application is fully multi-tenant yet.

The next database phase must replace these global JSON operations with workspace-scoped PostgreSQL/Supabase repositories before subscriber data is onboarded.

## Required production configuration

Set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
AUTOSEO_AUTH_REQUIRED=true
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. Do not put it in client code, public environment variables, or Git.

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL editor before using workspace APIs.

Then configure Supabase Auth providers and obtain a user access token through the application's eventual login UI. V4 provides the server verification and workspace API boundary; the full browser login/session UI is the next UI phase.

## Verification status

A full `npm run build` / TypeScript verification could not be completed in this environment because project dependencies were not installed. An attempted `npm ci --ignore-scripts --no-audit --no-fund` exceeded the execution time limit.

Therefore this V4 package must be dependency-installed and build-verified locally before deployment.

## V5-SUPABASE-DATA-LAYER

# AutoSEO V5 — Supabase Data Layer

V5 adds a production database repository while preserving the local JSON store for development.

## What changed

- Drafts, SEO score history, publish connections and calendar items can use Supabase Postgres.
- All remote reads/writes are scoped by `x-workspace-id` and the caller's Supabase bearer token.
- Supabase RLS policies remain enabled as the database authorization boundary.
- Publishing credentials are encrypted before storage using `AUTOSEO_ENCRYPTION_KEY`.
- Local `data/db.json` remains available when Supabase is not configured, so the demo can still run locally.
- SEO score history now stores deterministic and AI scores separately.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Configure:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AUTOSEO_ENCRYPTION_KEY`
   - `AUTOSEO_AUTH_REQUIRED=true`
4. Sign in with a Supabase access token.
5. Create/select a workspace and send its UUID in `x-workspace-id`.

## Important security rule

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `AUTOSEO_ENCRYPTION_KEY` to browser code.

The service-role key is only needed by trusted server-side workspace creation. Normal workspace data access uses the caller's access token so Postgres RLS applies.

## Current limitation

This V5 layer covers the main operational data paths used by the API. The original local JSON file is intentionally retained as a development fallback. A later migration step should provide an explicit import tool for existing `data/db.json` records and remove the fallback from production builds.

## V6-DURABLE-JOB-QUEUE

# AutoSEO V6 — Durable Job Queue & Publishing Worker

V6 converts publishing from an inline HTTP action into a durable Supabase-backed job flow.

## Flow
1. API creates a `publish_draft` job with a workspace + idempotency key.
2. Postgres atomically claims one due job with `FOR UPDATE SKIP LOCKED`.
3. Worker loads the draft and encrypted provider connection using the service role.
4. Publisher adapter executes.
5. Success marks the job succeeded and the draft published.
6. Failure schedules exponential retry until `max_attempts`, then marks the job failed.

## Database
Run `supabase/v6-queue.sql` after `supabase/schema.sql`.

## Worker security
Set `AUTOSEO_WORKER_SECRET` and send it as `x-autoseo-worker-secret`. Never expose the service-role key or worker secret to browser code.

## Important limitation
The queue is durable and claim/retry capable, but a hosting scheduler/cron still needs to invoke `/api/worker/publish` periodically. V6 does not claim a background worker is automatically running on every deployment platform.

## V7-RELIABILITY-SCHEDULER

# AutoSEO V7 — Publishing Reliability & Scheduler

V7 turns the V6 durable queue into an actual scheduled publishing pipeline.

## Included

- `/api/cron/autoseo` hosting-cron entry point.
- Up to 5 due publish jobs processed per invocation.
- Automatic recovery of stale `running` jobs.
- Durable auto-publish: `auto` permission now approves + enqueues instead of publishing inside the request.
- Unique idempotency key prevents duplicate enqueueing.
- Draft-status guard prevents a retry from publishing an already-published draft again.
- `job_attempts` history for provider attempts and failures.
- `GET /api/jobs` workspace queue monitoring endpoint.
- `POST /api/connections/health` provider connection health checks.
- `vercel.json` with a once-per-minute cron definition.

## Supabase migration

Run in Supabase SQL Editor, in order:

1. `supabase/schema.sql`
2. `supabase/v6-queue.sql`

The V6 SQL file now also contains the V7 stale-job recovery function and `job_attempts` table.

## Production environment

Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTOSEO_ENCRYPTION_KEY`
- `AUTOSEO_WORKER_SECRET`
- `CRON_SECRET`
- `AUTOSEO_AUTH_REQUIRED=true`

For Vercel, the cron route is `/api/cron/autoseo`. If using another scheduler, call the same route with `Authorization: Bearer <CRON_SECRET>`.

## Verification

A full production build was attempted in this environment, but the current installed `node_modules` does not contain the `next` executable (`next: not found`). So V7 is code-reviewed but not build-verified here.

Before deployment:

```bash
npm ci
npm run build
```

Fix any build/type errors before deploying.

## V8-SAAS-DASHBOARD

# AutoSEO V8 — SaaS Dashboard & Workspace Control Plane

V8 turns the production foundation into an operational SaaS control plane.

## Included

- Workspace selector persisted in the browser.
- Workspace creation from the dashboard.
- Workspace-scoped API calls through `x-workspace-id`.
- System tab with queue status, failed jobs, connection health, and audit history.
- Team/member management API with admin-only role changes and removal.
- Invite flow for Supabase Auth users.
- Password/token fields have explicit Show/Hide controls.
- Existing Generate, Analyze, Publish, Analytics and Automation tabs continue to use the selected workspace.

## Production note

Set `AUTOSEO_AUTH_REQUIRED=true` in production. Each authenticated request that accesses workspace data must carry a valid `x-workspace-id` selected from `/api/workspaces`.

The invite endpoint uses the Supabase service-role admin API. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.

## V8 verification

Run:

```bash
npm ci
npm run build
```

Then verify:

1. Login/authentication works.
2. Workspace can be created and selected.
3. Generate/analyze/publish requests remain isolated by workspace.
4. Admin can invite/add a member.
5. System tab displays jobs, connection health and audit logs.
6. Non-admin cannot mutate workspace membership.
7. Secret fields never echo stored credentials from GET responses.

## V9-AUTH-UI

# V9 — Authentication UI & Workspace Onboarding

V9 adds the user-facing authentication layer on top of the V8 SaaS dashboard.

## Included

- Sign in with Supabase Auth REST API.
- Account signup.
- Password reset email flow.
- Recovery-link password update page.
- Browser session storage and refresh handling.
- Authorization header automatically attached to `apiFetch`.
- Signed-in user identity and Sign out control.
- First-workspace onboarding when a user has no workspace.
- Existing workspace selector retained.
- Existing workspace team management retained in System tab.
- Password Show/Hide control on authentication forms.

## Required Supabase configuration

Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` on the server
- `AUTOSEO_AUTH_REQUIRED=true` for production

In Supabase Auth URL configuration, allow the application URL and the recovery redirect:

`/auth/reset`

The exact production domain must be configured in Supabase before password recovery is used in production.

## Security notes

The browser stores the Supabase session tokens required for the client-to-server bearer flow. Server API routes continue to verify the bearer token through Supabase Auth rather than trusting an unverified JWT payload. Provider secrets remain server-side and are not placed in the browser session.

For a hardened production deployment, use HTTPS, configure the exact redirect allow-list, enable appropriate Supabase password policies/MFA, and set `AUTOSEO_AUTH_REQUIRED=true`.

## V10-PRODUCTION-SECURITY

# AutoSEO V10 — Production Security & RBAC

V10 hardens the SaaS control plane without changing the provider publishing contract.

## Implemented

- Canonical roles: `owner`, `admin`, `editor`, `viewer`.
- Server-side workspace membership validation; `x-workspace-id` is never trusted alone.
- RBAC helper for API routes.
- Admin-only connection/settings mutation.
- Admin-only member management.
- Editor-or-higher publishing queue/calendar mutations.
- Viewer access for audit/job monitoring.
- Editor access for connection health checks because the operation updates health state.
- Browser cross-origin write protection through Origin validation.
- Security response headers in `next.config.js`.
- Owner membership cannot be deleted or demoted by the database trigger.
- Audit logs are append-only for client access: no UPDATE/DELETE policies.
- Report's internal analytics request forwards the authenticated workspace context.
- Secrets remain server-side and settings GET returns masked connection metadata only.

## Supabase migration

Run `supabase/v10-security.sql` after the existing schema and queue SQL.

## Production environment

Set:

- `AUTOSEO_AUTH_REQUIRED=true`
- `AUTOSEO_ENCRYPTION_KEY` to a unique 32-byte AES key
- `SUPABASE_SERVICE_ROLE_KEY` only on the server
- `AUTOSEO_WORKER_SECRET` to a strong random value
- `CRON_SECRET` to a strong random value for scheduled execution

Never expose service-role keys, encryption keys, worker secrets, or provider credentials to `NEXT_PUBLIC_*` variables.

## Remaining production work

V10 is security/access hardening, not a formal penetration test. A production launch should still include external penetration testing, dependency/SCA scanning, CSP tuning for the deployed asset set, centralized rate limiting, secret rotation, backup/restore drills, and observability/alerting.

## V11-DATA-INTEGRITY

# V11 — Database Migration & Data Integrity

V11 hardens the Supabase persistence layer without replacing the existing V3–V10 architecture.

## Migration order

Run in this order on a new or existing production database:

1. `supabase/schema.sql`
2. `supabase/v6-queue.sql`
3. `supabase/v10-security.sql`
4. `supabase/v11-data-integrity.sql`

## What V11 adds

- Atomic workspace creation with owner membership.
- One-owner-per-workspace database invariant.
- Automatic `updated_at` maintenance for connections and jobs.
- Immutable workspace identity fields.
- Database-level immutable audit logs.
- Job lifecycle transition guards.
- Stale worker-lock recovery function for trusted scheduler/worker use.
- `job_attempts` history for operational debugging and provider failures.
- Database-level protection against duplicate active `publish_draft` jobs for the same draft.

## Data migration checks

Before applying V11 to an existing database, verify:

```sql
select workspace_id, count(*)
from workspace_members
where role = 'owner'
group by workspace_id
having count(*) > 1;
```

This must return zero rows before the unique owner index is created.

Also inspect duplicate active publish jobs:

```sql
select payload->>'draftId' as draft_id, count(*)
from jobs
where type = 'publish_draft'
  and status in ('queued','running')
group by payload->>'draftId'
having count(*) > 1;
```

Resolve any returned rows before applying the migration.

## Credential lifecycle

Provider credentials remain encrypted in `connections.encrypted_credentials` and are only decrypted inside trusted server/worker code. V11 does not expose credential plaintext through the browser or database read policies.

For production operations, rotate credentials by replacing the encrypted connection value rather than storing plaintext secrets in source control.

## Backup / restore readiness

Enable Supabase/Postgres backups according to the production plan before onboarding real customers. Test a restore into a non-production project before treating backups as reliable.

V11 provides database invariants and attempt history; it is not a backup service itself.

## V12-OAUTH-INTEGRATIONS

# V12 — OAuth Integrations

V12 adds server-side OAuth 2.0 connection flows for Google/YouTube and Facebook Page publishing.

## Supported

- Google OAuth → YouTube channel access (`youtube.force-ssl`)
- Facebook OAuth → selects the first Page returned by `/me/accounts` and stores its Page Access Token
- One-time, hashed OAuth state stored in Supabase
- State expiry: 10 minutes
- OAuth credentials/tokens encrypted at rest with `AUTOSEO_ENCRYPTION_KEY`
- Google refresh-token support for long-lived YouTube connections
- Admin-only connect/disconnect actions
- Revocation marks a connection as `revoked`; credentials are replaced with a non-secret marker

## Environment

Set:

- `NEXT_PUBLIC_APP_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_CLIENT_SECRET`
- optional `FACEBOOK_GRAPH_VERSION`

OAuth redirect URIs must exactly match:

- `/api/oauth/callback/google-youtube`
- `/api/oauth/callback/facebook`

## Supabase migration

Run `supabase/v12-oauth.sql` after the previous V11 migrations.

## Security notes

- Never expose client secrets or access/refresh tokens to browser JSON responses.
- OAuth state is random, hashed before storage, single-use, workspace-bound, user-bound and expires after 10 minutes.
- Only workspace admins can start or revoke OAuth connections.
- Production should use HTTPS and a stable `NEXT_PUBLIC_APP_URL`.
- Facebook may require App Review/permissions approval before production use. The code does not bypass Meta/Google platform approval requirements.

## V13-PROVIDER-LIFECYCLE

# AutoSEO V13 — Provider Token Lifecycle & Reliability

V13 connects OAuth credentials to the publishing worker lifecycle.

## What changed
- Google/YouTube OAuth access tokens are refreshed before expiry when a refresh token exists.
- Refreshed credentials are encrypted again before storage.
- Connection health checks update `last_checked_at`, `status`, and `last_error`.
- Worker-only health endpoint can check every active connection in a workspace.
- Admin revoke endpoint performs best-effort Google token revocation before local credential destruction.
- Database prevents multiple non-revoked connections for the same workspace/provider.

## Migration order
`schema.sql` → `v6-queue.sql` → `v10-security.sql` → `v11-data-integrity.sql` → `v12-oauth.sql` → `v13-provider-lifecycle.sql`

## Important operational note
Facebook Page tokens are validated by Graph API health checks. V13 does not invent a refresh-token mechanism for Facebook because the existing integration stores Page access tokens and the provider flow is different from Google's refresh-token model.

## Production check
After applying the migration:
1. Connect YouTube and Facebook.
2. Run a connection health check.
3. Queue a YouTube/Facebook publish job.
4. Confirm worker success and `last_checked_at` / `last_error` behavior.
5. Revoke the connection and verify encrypted credentials are replaced by `revoked`.

## V14-SEO-INTELLIGENCE

# V14 — Content & SEO Intelligence Engine

V14 expands the single-page technical audit into a bounded site audit.

## Included

- Multi-page same-host crawl (default 25, hard maximum 50)
- Sitemap discovery from robots.txt and `/sitemap.xml`
- robots.txt presence and sitemap references
- Canonical detection
- noindex detection
- hreflang detection
- Open Graph metadata
- Twitter/X card metadata
- JSON-LD/schema type extraction
- Internal/external link discovery
- Broken internal-link checks (bounded)
- Duplicate title detection
- Duplicate meta-description detection
- Missing image-source signals
- Deterministic site-level SEO score and prioritized issues
- Workspace/auth/rate-limit protection on `/api/site-audit`

## Safety

All fetched URLs continue to pass the existing outbound URL safety layer. Crawling is limited to the original hostname and a bounded number of pages/link checks. Private/reserved destinations and non-HTTP(S) targets remain blocked.

## API

`POST /api/site-audit`

Body:

```json
{ "url": "https://example.com", "maxPages": 25 }
```

The endpoint returns the crawled pages, robots/sitemap signals, site-wide duplicate/broken-link findings, and the deterministic site SEO result.

## Scope boundary

This is a server-side HTML crawler, not a browser-rendering engine. JavaScript-only content, Core Web Vitals, rendered accessibility trees, authenticated pages, and search-engine index data require separate integrations and are intentionally not claimed by V14.

## V15-KEYWORD-CONTENT-INTELLIGENCE

# V15 — Keyword & Content Intelligence

V15 adds a deterministic target-keyword analysis layer on top of the existing crawler.

## Endpoint

`POST /api/keyword-intelligence`

```json
{
  "url": "https://example.com/page",
  "keyword": "target keyword"
}
```

The response includes the original crawl plus:
- intent signal (informational/commercial/transactional/navigational/mixed)
- title/meta/H1 keyword alignment
- heading coverage
- URL alignment
- conservative keyword occurrence/density signal
- content length signal
- internal-link signal
- prioritized deterministic issues and recommendations

## Design rule

The numeric score is deterministic. AI can be added as an interpretation/rewrite layer later, but must not silently replace the explainable scoring rules.

## Current limitation

`CrawlResult` intentionally stores page word count rather than raw body text. Therefore V15's exact-occurrence signal is conservative and is based on available metadata/headings. A future content-extraction layer can provide paragraph-level semantic/entity coverage without changing this API contract.

## V16-CONTENT-SEMANTIC-INTELLIGENCE

# V16 — Content Extraction & Semantic SEO Intelligence

V16 adds a readable-content extraction layer and a deterministic content intelligence endpoint.

## What it adds
- Main readable body text extraction with script/style/template/svg noise removed.
- Heading and anchor-text extraction.
- Exact target-keyword occurrence and density using actual page text.
- Semantic term frequency signals.
- Lightweight entity signals from headings and JSON-LD types.
- Search-intent-aware topic coverage and content gaps.
- Internal-link opportunity signals.
- Deterministic content score and prioritized recommendations.

## API
`POST /api/content-intelligence`

```json
{"url":"https://example.com/page","keyword":"target keyword"}
```

This is intentionally heuristic/deterministic. It does not claim Google rankings, search-volume data, embeddings, or a full NLP knowledge graph.

## V17-AI-SEO-OPTIMIZATION

# V17 — AI-Assisted SEO Optimization

V17 adds an assisted optimization workflow on top of V14–V16 crawling and deterministic intelligence.

## Flow

1. Crawl a public page with the existing SSRF-safe crawler.
2. Run deterministic content intelligence for the target keyword.
3. Send only the bounded audit brief to Claude.
4. Return an optimized title, meta description, H1 and body plus explicit changes/warnings.
5. Keep the result as a preview; publishing remains a separate approval/queue action.

## Safety rules

- The model must preserve source-supported facts.
- It must not invent prices, reviews, ratings, statistics, locations, guarantees, certifications or product facts.
- The target keyword must be used naturally.
- The optimizer does not publish automatically.
- Existing workspace auth, rate limiting and crawler URL safety remain in force.

## API

`POST /api/optimize-content`

Body:

```json
{"url":"https://example.com/page","keyword":"target keyword"}
```

Response contains `crawl`, deterministic `intelligence`, and `optimized` preview data.

## V18-OPTIMIZATION-VERSIONING

# AutoSEO V18 — Optimization Approval & Versioning

V18 adds a human-in-the-loop optimization workflow.

## Workflow

Original draft → AI proposed version → change decisions → human approval → approved draft → durable publish job.

## Version safety

- Version records are append-oriented and deletion is blocked at database level.
- Only `proposed` versions can have individual field decisions changed.
- Fields supported for selective approval: title, meta description, H1, body.
- Rejected versions remain in history.
- Applied versions retain timestamps and the source version ID is carried into the publish job payload.
- Publishing still goes through the durable queue and existing worker; approval never performs an inline provider call.

## Migration order

Run `supabase/v18-optimization-versioning.sql` after the V11/V12/V13 migrations used by the project.

## API

- `GET /api/optimization-versions?draftId=...`
- `POST /api/optimization-versions`
- `GET /api/optimization-versions/:id`
- `PATCH /api/optimization-versions/:id`
- `POST /api/optimization-versions/:id/approve`

Production mode requires an authenticated workspace and editor/admin access for mutations.

## V19-ROLLBACK-CHANGE-MANAGEMENT

# V19 — Rollback & Change Management

V19 adds reversible publishing history around V18 optimization versions.

## Capabilities
- Immutable publication history snapshots.
- Rollback creates a new manual version rather than mutating/deleting history.
- Rollback requires editor permission and is queued through the durable publishing worker.
- Rollback requests and successful rollback publications are recorded as immutable events.
- Existing idempotent publish queue prevents duplicate active publish jobs.
- `GET /api/rollback/:draftId` returns publication history for a workspace member.
- `POST /api/optimization-versions/:id/rollback` creates a rollback version and queues publication.

## Migration
Run after V18:
`supabase/v19-rollback.sql`

## Safety
Rollback is deliberately human initiated. A proposed version cannot be used as a rollback target, and the original baseline version is not a rollback target. Historical rows cannot be updated or deleted.

## Verification
Run `npm ci` then `npm run build`, then test:
1. Create/approve an optimization version.
2. Confirm a publication-history event after a successful worker publish.
3. Roll back a non-proposed version.
4. Confirm a new manual rollback version is created.
5. Confirm a durable publish job is queued.
6. Confirm the worker records `rollback_published` after success.
7. Confirm publication history remains readable and immutable.

## README-V20

# AutoSEO V20 — Analytics & Performance Intelligence

V20 adds Google Search Console OAuth, organic-search performance metrics, persisted analytics snapshots, and a unified analytics response that combines website SEO score history with existing YouTube/Facebook metrics.

## Main additions

- Google Search Console read-only OAuth connection
- Search Console property discovery
- Organic clicks, impressions, CTR, average position
- Date-range snapshot persistence
- Snapshot history API
- Analytics dashboard Search Console section
- Search Console connection health checks
- Google OAuth refresh lifecycle extended to Search Console
- Existing YouTube/Facebook/website analytics retained

## Migration

Run `supabase/v20-analytics.sql` after V19.

## Verification

```bash
npm ci
npm run build
```

Then connect Search Console from the Publish/Connections area and open Analytics.

## V20-ANALYTICS-PERFORMANCE

# V20 — Analytics & Performance Intelligence

V20 adds a production analytics layer around Google Search Console, existing YouTube/Facebook metrics, SEO score history, publication history, and persisted analytics snapshots.

## Google Search Console

OAuth provider: `google-search-console`

Scope: `https://www.googleapis.com/auth/webmasters.readonly`

The first accessible Search Console property is used by default. The `/api/analytics/search-console` endpoint lists properties so the UI can later let an administrator select one. The selected `siteUrl` is supported by the credential shape, but property selection persistence is intentionally deferred until the connection settings UI is expanded.

## Snapshot API

`POST /api/analytics/snapshot` stores a Search Console summary for a date range. Defaults to the previous 28 days excluding today. Snapshots are unique by workspace/provider/date range, so re-running a period updates the same logical record rather than creating duplicates.

## Analytics response

`GET /api/analytics` now exposes:

- `website.scoreHistory`
- `youtube.channelStats` and published-video metrics
- `facebook.pageStats` and recent post engagement
- `searchConsole` organic clicks, impressions, CTR and average position
- `snapshots` for persisted Search Console periods

## Metric honesty

YouTube uses Data API statistics already available to the project; it does not pretend to expose watch-time or audience-retention metrics. Facebook uses page/post engagement available to the current integration. Search Console provides actual organic search performance. External ranking positions, revenue attribution, and ROI are not inferred from these APIs.

## Migration

Run `supabase/v20-analytics.sql` after the existing V19 migrations.

## OAuth callback

Because the OAuth provider is now `google-search-console`, configure:

`/api/oauth/callback/google-search-console`

in the Google OAuth client.

## V20-TEST-PLAN

# V20 Test Plan

1. `npm ci`
2. `npm run build`
3. Configure Google OAuth and add the Search Console callback.
4. Connect Search Console from an admin workspace.
5. Call `GET /api/analytics/search-console` and confirm accessible properties are returned.
6. Call `POST /api/analytics/snapshot` and verify one `analytics_snapshots` row is created.
7. Repeat the same snapshot request and verify the unique period is updated, not duplicated.
8. Call `GET /api/analytics` and verify website, Search Console, YouTube/Facebook (when connected), and snapshot sections are workspace-scoped.
9. Remove/revoke the Search Console connection and confirm analytics no longer expose live Search Console data.
10. Confirm viewer users can read analytics but cannot create/revoke connections.

## README-V21

# AutoSEO V21 — SEO Performance Attribution & ROI Intelligence

V21 adds a conservative attribution layer comparing Google Search Console page performance before and after successful publication.

## Highlights
- Equal 28-day baseline/post windows.
- 3-day buffer around publication to account for Search Console lag.
- Page-level Search Console query filtered to the target URL.
- Clicks, impressions, CTR and average-position deltas.
- SEO score observations before/after publication when score history exists.
- Explicit `correlation_only` interpretation; no causal claims.
- Optional persisted `attribution_reports` table with RLS.
- Existing V20 analytics, OAuth, RBAC, publishing queue and rollback systems retained.

## New API
`GET /api/analytics/attribution?draftId=<id>&targetUrl=<url>`

## Migration
Run `supabase/v21-attribution.sql` after the V20 migration.

## V21-ATTRIBUTION-ROI

# V21 — SEO Performance Attribution & ROI Intelligence

V21 compares equal Search Console page-performance windows before and after a successful publication, with a 3-day buffer for Search Console lag. It also reports SEO score observations around the publication date.

## Attribution rule

The system deliberately labels this **correlation only**. A click/impression/CTR/position change is not treated as proof that an AutoSEO change caused the outcome.

## API

`GET /api/analytics/attribution?draftId=<id>&targetUrl=<url>`

Requires authenticated Supabase mode and a valid workspace.

## Comparison

- Baseline: publication date minus 31 to minus 4 days.
- Post period: publication date plus 4 to plus 31 days.
- Equal 28-day windows.
- Search Console page dimension is filtered to the target URL.

## Caveats

Search Console data lag, seasonality, Google algorithm changes, competitors, links, SERP layout changes and unrelated site changes can influence results. Do not present the report as causal ROI proof.

## README-V22

# AutoSEO V22 — SEO Experimentation Engine

V22 adds sequential SEO experimentation on top of V21's optimization/versioning, publishing queue and Search Console analytics.

## What it does
- Creates an experiment for one draft/target URL using two existing optimization versions.
- Publishes Variant A and Variant B in non-overlapping windows through the durable publishing queue.
- Collects page-level Google Search Console observations for each variant.
- Evaluates CTR with a two-proportion z-test plus minimum data thresholds.
- Reports winner A, winner B, or inconclusive.
- Requires an admin to promote a statistically supported winner.
- Promotion is queued through the existing durable publisher.

## Important methodology
This is **not randomized traffic A/B testing**. The current architecture changes the same page between sequential variants. Search Console is delayed and SEO results are affected by seasonality, ranking changes, algorithms, links and competitors. V22 therefore labels the result as measurement-based rather than causal proof.

## Supabase migration
Run `supabase/v22-experiments.sql` in the Supabase SQL editor after V21 migrations.

## APIs
- `GET/POST /api/experiments`
- `GET/PATCH /api/experiments/:id`
- `POST /api/experiments/:id/start-a`
- `POST /api/experiments/:id/start-b`
- `POST /api/experiments/:id/observe`
- `POST /api/experiments/:id/evaluate`
- `POST /api/experiments/:id/promote`

## Statistical rule
Default: at least 100 impressions and 10 clicks per variant, 95% confidence, and at least 1 percentage-point absolute CTR difference. These are configurable when the experiment is created through the API.

## README-V23

# AutoSEO V23 — Advanced Keyword Research Engine

V23 adds workspace-scoped keyword discovery and opportunity intelligence on top of V22 experimentation.

## Capabilities
- Seed keyword expansion using related, modifier and question patterns.
- Intent classification: informational, commercial, transactional, navigational, local and mixed.
- Deterministic opportunity scoring using relevance, intent, content fit, difficulty signals and current-page signals.
- Optional target URL crawl to understand existing topical coverage.
- Optional Google Search Console query discovery when a Search Console connection exists.
- Keyword clustering foundation through normalized candidates and intent/content-type mapping.
- Recommended content type and next-action recommendation per keyword.
- Supabase persistence with workspace RLS.

## Important methodology
V23 does not invent search-volume or keyword-difficulty numbers from nowhere. It uses deterministic on-site signals and, when available, real Search Console queries. Third-party volume APIs can be added later without changing the core repository model.

## Supabase migration
Run `supabase/v23-keyword-research.sql` after V22 migrations.

## APIs
- `GET/POST /api/keyword-research`
- `GET /api/keyword-research/:id`

## Scoring
Opportunity score combines relevance, intent fit, content fit, estimated difficulty and current-page coverage. It is an opportunity heuristic, not a vendor-provided keyword-volume metric.

## README-V24

# AutoSEO V24 — Competitor Intelligence Engine

V24 adds bounded public-web competitor intelligence on top of V23 keyword research.

## What it does
- Crawls the target site and up to 5 competitor sites with the existing SSRF-safe crawler.
- Compares V23 keyword opportunities against competitor page coverage.
- Finds content/topic gaps from competitor headings.
- Flags target technical SEO weaknesses using deterministic best-practice signals.
- Scores opportunities and produces actionable recommendations.
- Stores analyses per workspace in Supabase with RLS.

## Scope / safety
Only publicly reachable HTTP(S) pages are analyzed. Existing URL safety, redirect validation and bounded crawling remain in force. This does not access private dashboards, paid intelligence databases, credentials, or unauthorized data.

## Supabase
Run `supabase/v24-competitor-intelligence.sql` after V23/V22 migrations.

## Test
```bash
npm ci
npm run build
```
Then sign in, select a workspace, open **Competitor Intelligence**, enter a target URL, 1–5 competitor URLs, optionally select a V23 keyword project, and run the analysis.

## README-V25

# AutoSEO V25 — Topic & Content Strategy Engine

V25 turns V23 keyword opportunities into an actionable content strategy and optionally uses V24 competitor gaps to strengthen prioritization.

## What it does
- Groups related keyword opportunities into topic clusters.
- Selects primary topics and distinguishes pillar pages from supporting content.
- Recommends content types by search intent.
- Produces priority tiers and deterministic opportunity scores.
- Generates suggested titles and internal-link targets within each cluster.
- Flags possible keyword cannibalization when a cluster contains many closely related targets.
- Optionally incorporates V24 competitor keyword gaps as a prioritization signal.
- Saves strategy projects per workspace with Supabase RLS.

## Architecture
- `lib/content-strategy.ts` — deterministic strategy engine.
- `lib/content-strategy-repository.ts` — workspace-scoped persistence.
- `app/api/content-strategy` — authenticated API.
- `supabase/v25-content-strategy.sql` — schema, indexes, RLS and timestamps.
- Dashboard: **Content Strategy** tab.

## Important limitation
This version does not claim search-volume or traffic forecasts. Strategy scores are derived from AutoSEO's existing deterministic keyword signals and optional competitor-gap evidence.

## Test
```bash
npm ci
npm run build
```
After build, run `supabase/v25-content-strategy.sql` in Supabase SQL Editor, then sign in, select a workspace, create/select a V23 keyword project, optionally select a V24 competitor project, and build the strategy.

## README-V26

# AutoSEO V26 — AI Content Production Studio

V26 turns V25 content-strategy items into production-ready content using Claude, with factual-safety constraints and a review-before-publish workflow.

## Features
- Studio projects scoped to a Supabase workspace
- Select a V25 strategy and content item
- Business profile + language + channel controls
- AI-generated title, meta description, H1, body, outline, FAQs, semantic keywords and internal-link suggestions
- Competitor insights are treated as topic signals, not copied text
- Factual-safety guardrails: no invented prices, ratings, reviews, certifications, statistics, locations or claims
- Generated assets are saved in Supabase
- Existing approval/publishing queue remains the final publishing gate
- RLS on studio projects/assets

## Supabase
Run `supabase/v26-content-studio.sql` in the Supabase SQL editor after V25 migrations.

## Local verification
```bash
npm ci
npm run build
```

Do not commit/push automatically. Git/GitHub actions are performed manually by the project owner.

## README-V27

# AutoSEO V27 — Content Quality & Fact Intelligence

V27 adds a deterministic content quality gate between AI generation and publishing.

Flow:
V25 Strategy → V26 AI Content Studio → **V27 Quality & Fact Risk Review** → Approval/Publishing

The evaluator produces a 0–100 quality score, publish-ready / needs-review / needs-rework verdict, SEO/readability/structure/originality/trust issues, and a factual-risk review.

### Run
npm ci
npm run build

### Supabase
Run `supabase/v27-content-quality.sql` in the project's Supabase SQL Editor.

### Fact safety
V27 detects patterns that deserve verification. It does **not** establish factual truth and does not replace authoritative source checking.

## V27-CONTENT-QUALITY-FACT-INTELLIGENCE

# V27 — Content Quality & Fact Intelligence

V27 adds a deterministic pre-publication quality gate for content produced by AutoSEO.

## Checks
- SEO title/meta/keyword signals
- content length and heading structure
- sentence readability
- obvious claim-risk patterns: guarantees, superlatives, prices, statistics, credentials and dates
- lexical overlap against supplied reference text
- basic trust/link signals

## Important limitation
This is a **risk detector, not a truth verifier**. It cannot prove a statement is true or false. High-risk claims must be checked against authoritative sources by a human or a future verified fact-checking integration.

## API
- `GET /api/content-quality?assetId=...`
- `POST /api/content-quality`

POST accepts `title`, `body`, optional `metaDescription`, `keyword`, `channel`, `language`, `assetId`, `draftId`, and optional `referenceTexts`.

## Supabase
Run `supabase/v27-content-quality.sql` after V26 SQL.

## Security
Workspace/RBAC checks are enforced through the existing API access and workspace role layer. Reports are protected by workspace RLS.

## README-V28

# AutoSEO V28 — Technical SEO Automation Engine

V28 turns technical SEO analysis into a prioritized remediation workflow.

## Features
- Bounded public-site crawl using the existing SSRF-safe crawler.
- Technical checks for title, meta description, H1, canonical, viewport, noindex, Open Graph, Twitter metadata, image alt text, JSON-LD, hreflang and broken links.
- Severity and deterministic technical score.
- Safe-candidate vs manual-review classification.
- Workspace-scoped persistence in Supabase with RLS.
- Dashboard Technical SEO tab.

## Safety model
V28 does **not** directly modify an arbitrary production website. It produces a deterministic, reviewable fix plan. Provider-specific implementation/approval can be layered onto the durable publishing and approval systems in later workflow versions.

## Supabase
Run `supabase/v28-technical-seo.sql` after the build passes.

## Verification
```bash
npm ci
npm run build
```

## README-V29

# AutoSEO V29 — Internal Linking & Site Architecture Engine

V29 adds a bounded, reviewable internal-linking and site-architecture intelligence layer on top of V28 technical crawling, V23 keyword research, V24 competitor intelligence and V25 strategy.

## Capabilities
- Bounded public-site crawl using the existing SSRF-safe crawler
- Orphan / weakly connected page candidates
- Hub-page candidates
- Contextual internal-link opportunities
- Suggested natural anchor text
- Opportunity score and severity
- Architecture score
- V23 keyword-project integration for anchor suggestions
- Saved workspace-scoped analysis projects
- Supabase RLS
- Dashboard tab

## Safety
V29 generates recommendations only. It does not directly modify production website files. Crawl targets must remain publicly accessible HTTP(S) pages accepted by the existing URL-safety layer.

## Supabase
Run `supabase/v29-site-architecture.sql` after the build is verified.

## Verify
```bash
npm ci
npm run build
```

Git/GitHub mutations remain user-operated.

## README-V30

# AutoSEO V30 — Local SEO Intelligence

V30 adds a bounded public-site Local SEO intelligence layer on top of V23 keyword research and the existing crawler.

## Features
- Location-aware site audit
- Local keyword opportunities derived from existing keyword research
- LocalBusiness/Organization JSON-LD detection
- Location, contact and review-signal detection
- Local technical/content issue prioritization
- Local SEO score and recommendations
- Workspace-scoped Supabase persistence with RLS

## Safety
The crawler uses the existing SSRF-safe public URL fetching layer. V30 does not access private systems or automatically modify live websites. Schema/review recommendations are advisory and should use only genuine business information.

## Supabase
Run `supabase/v30-local-seo.sql` after the application build passes.

## README-V31

# AutoSEO V31 — SEO Automation & Workflows

V31 adds a workspace-scoped automation control plane that orchestrates the SEO engines built in V23–V30.

## What it provides
- Saved workflows with manual, schedule, on-publish, and on-audit trigger metadata.
- Ordered workflow steps for keyword research, competitor intelligence, content strategy, content quality, technical SEO, site architecture, and local SEO.
- Durable workflow run records in Supabase with status/results/error history.
- Safe, reviewable execution: analysis engines produce findings; V31 does not silently mutate production websites.
- Tenant-isolated RLS on workflows and runs.
- API endpoints for workflow CRUD, creating runs, listing runs, and executing a run.

## Supabase
Run `supabase/v31-workflows.sql` after the earlier migrations.

## Execution input
A run can accept `targetUrl`, `keywordProjectId`, `seedKeyword`, `competitorUrls`, `location`, `businessName`, `body`, `title`, `metaDescription`, `keyword`, `language`, `channel`, `businessFacts`, `referenceTexts`, `gscQueries`, and `maxPages` as applicable to its enabled steps.

Scheduled trigger metadata is stored in V31; a production scheduler/worker can invoke due runs in a later hardening phase. Manual execution is available now.

## README-V32

# AutoSEO V32 — SEO Monitoring & Alert Center

V32 adds persistent monitoring profiles, bounded technical SEO re-checks, Search Console trend comparisons, regression detection, alert severity, and historical snapshots.

## Flow
V28 Technical SEO + V20 Search Console → V32 Monitoring → Alerts/History → V31 Workflows (future scheduler integration).

## Safety
- Uses the existing bounded/SSRF-safe crawler.
- Does not mutate customer websites.
- Search Console data is read-only.
- Alerts are heuristic signals, not proof of causation.

## Supabase
Run `supabase/v32-monitoring.sql` after V31 SQL migrations.

## API
- `GET /api/monitoring`
- `POST /api/monitoring` with `{name,targetUrl,frequency}` to create a profile.
- `POST /api/monitoring` with `{action:"run",profileId}` to run a check and persist a snapshot.

## README-V33

# AutoSEO V33 — Advanced SEO Analytics & ROI

V33 adds an advanced analytics layer on top of V20–V32. It compares the current and previous Search Console periods, published AutoSEO content, SEO score history, directional performance signals and actionable recommendations.

## Scope
- Period-over-period organic clicks, impressions, CTR and average position
- Published-content inventory
- SEO score trend across monitored/analyzed URLs
- Directional content-performance efficiency (organic clicks per published AutoSEO draft)
- Correlation-only attribution framing; no false causal claims
- `/api/analytics/advanced`
- `supabase/v33-advanced-analytics.sql` for optional persisted ROI reports

## Important limitation
Organic clicks are not revenue. V33 does not invent monetary ROI without a connected revenue source. Attribution remains correlation-only and can be affected by seasonality, algorithm updates, SERP changes, competitors, links and Search Console lag.

## README-V34

# AutoSEO V34 — AI SEO Strategist / Decision Engine

V34 adds a workspace-scoped decision layer that turns signals from keyword research, competitor intelligence, content quality, technical SEO, site architecture, local SEO, monitoring and analytics into a prioritized next-action plan.

## Design principles
- Deterministic priority engine is the source of truth.
- Claude is optional and only explains the generated plan; it cannot invent new recommendations or facts.
- Recommendations include evidence, confidence, dependencies and source signals.
- Conflicting signals are surfaced instead of silently reconciled.
- Causality is not claimed from observational analytics.
- No publishing or site mutation occurs from a strategy run.

## New API
- `GET /api/strategist`
- `POST /api/strategist`
- `GET /api/strategist/[id]`

## Supabase
Run `supabase/v34-strategist.sql` after the existing V1–V33 migrations.

## Test
1. `npm ci`
2. `npm run build`
3. In the authenticated dashboard, open **AI SEO Strategist**.
4. Enter a target URL and run the strategist.
5. Verify actions, evidence, confidence, conflicts and guardrails.
6. If `ANTHROPIC_API_KEY` is configured, verify the optional AI explanation appears; deterministic actions must remain unchanged.

## README-V35

# AutoSEO V35 — AI Operating System

V35 turns AutoSEO into a coordinated operating layer across strategy, monitoring and operational controls. It produces an operating cycle, prioritizes next-best actions, stores runs per workspace, and keeps human approval in the loop.

## Supabase
Run `supabase/v35-operating-system.sql` after the V34 SQL migrations.

## Safety
The operating system is decision support. It does not autonomously perform destructive changes or publish externally without an explicit workflow/approval path.
