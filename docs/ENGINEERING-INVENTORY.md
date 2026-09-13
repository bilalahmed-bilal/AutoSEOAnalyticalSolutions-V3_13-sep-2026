# AutoSEO Engineering Inventory — Phase 0

**Date:** 2026-09-12
**Source priority:** current source code, migrations, config, git state. Documentation is treated as secondary and often stale.
**Status:** inventory only. Runtime commands, OAuth providers, and browser QA are **NOT VERIFIED** until later phases.

## 1. Snapshot

| Item | Evidence |
|---|---|
| Package name / version | `autoseo-phase1` `1.35.0` in `package.json` |
| Stack | Next.js `^16.2.4` App Router, React `^19.2.0`, TypeScript `^5.9.0`, Tailwind CSS v4, Anthropic SDK, cheerio |
| Git | `master` at `68e243a` (“Initial AutoSEO project - all phases + V35 features”). Uncommitted V35 YouTube/Facebook tool work. No remote tracking observed in this inspection. |
| CI | None (no `.github/workflows`) |
| Tests | None found (`*.test.*`, `*.spec.*`, Jest/Vitest/Playwright configs all absent) |
| ESLint / Prettier | No config files. No `eslint` dependency. `"lint": "next lint"` |
| Typecheck script | Missing |
| `node_modules` | Present |
| `.env.local` | Present (not read during inventory) |
| Primary UI | `app/page.tsx` (~3502 lines, `"use client"`) |

## 2. Architecture

Single Next.js application:

1. Browser client (`app/page.tsx` plus a few tab components) talks to `/api/*` via `lib/client-api.ts`.
2. API routes authenticate with `requireApiAccess()` and optionally `getTenantContext()` / `requireWorkspaceRole()`.
3. Persistence is dual-path:
   - **Remote:** Supabase PostgREST (`lib/db/supabase-rest.ts`) when a workspace id and Supabase URL/anon key exist.
   - **Local fallback:** `lib/store.ts` → `data/db.json` when remote context is missing.
4. Privileged server operations use `SUPABASE_SERVICE_ROLE_KEY` (`supabaseAdmin`).
5. Publishing goes through adapters in `lib/publishers/*` and a durable job worker (`lib/jobs/*`, `/api/worker/publish`, `/api/cron/autoseo`).
6. AI calls Anthropic from `lib/claude.ts`. Strategist/OS engines are mostly deterministic planners, not autonomous publishers.

```
Browser (localStorage session + x-workspace-id)
  → Next.js API routes
      → Supabase Auth /auth/v1/user (token verify)
      → PostgREST with user JWT (RLS) OR service role (bypass)
      → Claude / Google / Meta / WordPress / Shopify / custom webhook
      → local data/db.json (demo fallback)
```

## 3. Major modules

### App

- `app/page.tsx` — channel-first dashboard (Website / YouTube / Facebook / Overview)
- `app/auth/AuthScreen.tsx`, `app/auth/reset/page.tsx`
- `app/StrategistTab.tsx`, `app/os/OperatingSystemTab.tsx`, `app/automation/AutomationWorkflowPanel.tsx`
- `app/api/**` — 87 `route.ts` files

### Lib

- Auth: `lib/auth/api-access.ts`, `supabase.ts`, `browser.ts`, `rbac.ts`, `channel-api.ts`
- Tenant: `lib/tenant.ts`
- Security: `lib/security/{url-safety,rate-limit,request,secrets,audit}.ts`
- Data: `lib/store.ts`, `lib/store-repository.ts`, `lib/db/supabase-rest.ts`, `lib/db/supabase-rpc.ts`
- SEO: `seo-crawler`, `seo-engine`, `seo-site-engine`, keyword/competitor/technical/local/architecture modules
- AI: `lib/claude.ts`, `lib/strategist/*`, `lib/os/*`, `lib/content-optimizer.ts`
- Publish: `lib/publishers/{wordpress,shopify,custom-site,youtube,facebook}.ts`, `lib/publish-dispatch.ts`
- Jobs: `lib/jobs/{queue,process-publish,attempts,idempotency,types}.ts`
- OAuth: `lib/oauth/{config,state,provider,refresh,lifecycle}.ts`
- Automation: `lib/automation-*.ts`

### Database

27 SQL files under `supabase/`, including `schema.sql`, versioned migrations `v6`–`v35`, `COMBINED-MIGRATION.sql` (untracked), and `v35-channel-tools.sql` (untracked).

## 4. Authentication flow

**IMPLEMENTED (code):**

- Browser signs in against Supabase Auth (`/auth/v1/token?grant_type=password`) in `lib/auth/browser.ts`.
- Session JSON (`access_token`, `refresh_token`, `expires_at`, `user`) is stored in `localStorage` key `autoseo.supabase.session`.
- `apiFetch` attaches `Authorization: Bearer <access_token>` and `x-workspace-id` from `localStorage`.
- Server verifies the token live with `GET {SUPABASE_URL}/auth/v1/user` (`lib/auth/supabase.ts`). JWT payloads are not trusted locally.
- Login / signup / refresh / logout / password recovery exist in `lib/auth/browser.ts`.
- `/api/auth/me` reports authenticated state.

**Fail-open switch (`lib/auth/api-access.ts`):**

- `AUTOSEO_AUTH_REQUIRED === "true"` → no user means `null` → 401.
- Otherwise missing/invalid session returns a synthetic `{ id: "anonymous-local" }` with `authenticated: false`.
- `NODE_ENV === "production"` is **not** consulted. Forgetting the env flag in production leaves APIs anonymously callable.
- Example file defaults `AUTOSEO_AUTH_REQUIRED=false` and tells operators to leave it false until login is tested (`docs/SUPABASE-SETUP-GUIDE.md`).

**Same-origin write check:** `lib/security/request.ts` allows writes with no `Origin` header.

## 5. Authorization / tenancy

**IMPLEMENTED (code):**

- Workspace id must be a UUID header; membership is confirmed via `supabaseAdmin` on `workspace_members` (`lib/tenant.ts`). Header alone is not trusted.
- Roles: `viewer < editor < admin < owner` (`lib/auth/rbac.ts`).
- Channel tools use `requireChannelAccess()` (API access + workspace role).
- Settings writes require `admin` **when authenticated**.
- Queue approve/reject requires `editor` **when authenticated**.
- OAuth start requires authenticated + `admin`.

**PARTIAL:**

- Many product routes only call `requireApiAccess()` and, if `authenticated === false`, fall through to the local JSON store. That is intentional demo behavior, not production deny-by-default.
- Automation routes require `getTenantContext()` (so anonymous callers get 403), but they do **not** call `requireWorkspaceRole()`. Any workspace member can create/execute workflows.
- RBAC is not uniform across all 87 routes.
- Service-role is used for membership lookups, OAuth state, job claiming, cron recovery. Justified, but it bypasses RLS; application checks must be correct.

**NOT VERIFIED:** live User A / Workspace B isolation, RLS policies against a real Supabase project, expired-session behavior in the browser.

## 6. Session / browser security

| Topic | Current state |
|---|---|
| Token storage | `localStorage` — access and refresh tokens readable by any script on the origin |
| Cookies | Not used for AutoSEO session |
| HttpOnly / Secure / SameSite | Not applicable to current storage |
| Refresh | `refreshSession()` using stored refresh token |
| Logout | Supabase `/auth/v1/logout` then localStorage clear |
| Recovery | `/auth/v1/recover` → `/auth/reset` |

Migrating to HttpOnly cookies is a later phase. Current architecture is Bearer-from-localStorage.

## 7. External network / publishers

| Destination | File | URL source | SSRF helper used |
|---|---|---|---|
| Public HTML crawl | `lib/seo-crawler.ts` | user URL | **Yes** (`assertSafeUrl` / `safeFetchPage`) |
| Custom webhook | `lib/publishers/custom-site.ts` | user `webhookUrl` | **No** — raw `fetch` |
| WordPress | `lib/publishers/wordpress.ts` | user `siteUrl` | **No** |
| Shopify | `lib/publishers/shopify.ts` | user `shopDomain` | **No** (HTTPS prefix only) |
| YouTube | `lib/publishers/youtube.ts` | Google APIs | Fixed hosts |
| Facebook | `lib/publishers/facebook.ts` | Graph API | Fixed hosts |
| Claude | `lib/claude.ts` | Anthropic | SDK |
| OAuth token endpoints | `lib/oauth/provider.ts` | Google/Meta | Fixed hosts |

Crawler protections (`lib/security/url-safety.ts`): HTTP(S), ports 80/443, no embedded credentials, localhost/`.local` blocked, private IPv4 ranges, some IPv6 ranges, redirect revalidation, 5 redirects, 10s timeout, 2 MB body, HTML content-type.

Crawler gaps visible in code: IPv4-mapped IPv6 (`::ffff:127.0.0.1`) not classified private; DNS lookup and fetch are not address-pinned (rebinding TOCTOU); no tests.

Publisher gaps: user-controlled webhook/site/shop destinations are fetched with timeout only.

## 8. OAuth

Providers in `lib/oauth/config.ts`: `google-youtube`, `google-search-console`, `facebook`.

**IMPLEMENTED (code):** start route, SHA-256 hashed state with 10-minute expiry, consume+delete, token exchange, AES-256-GCM encryption of credentials, workspace-scoped upsert, YouTube offline refresh for stored provider `youtube` (OAuth key `google-youtube`), Facebook long-lived page token (first page only). YouTube scopes: `youtube.force-ssl` + `yt-analytics.readonly`.

**PARTIAL / risks:**

- State consume is read-then-delete, not a single atomic compare-and-delete.
- Callback is unauthenticated by design (browser redirect); binds via state.
- Callback errors are copied into the URL query string.
- Existing YouTube tokens authorized before Analytics scope must reconnect.
- Facebook OAuth uses first Page only.
- Manual YouTube token paste remains as a legacy/testing-only UI path.

**NOT VERIFIED:** any live Google/Meta OAuth round-trip.

## 9. Secrets / environment

From `.env.local.example`:

| Variable | Class |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | PUBLIC |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PUBLIC (anon, not service role) |
| `NEXT_PUBLIC_APP_URL` | PUBLIC |
| `SUPABASE_SERVICE_ROLE_KEY` | SECRET / PRIVILEGED |
| `ANTHROPIC_API_KEY` | SECRET |
| `AUTOSEO_ENCRYPTION_KEY` | SECRET |
| `AUTOSEO_APP_SECRET` | SECRET (legacy/unused in inspected auth path) |
| `AUTOSEO_AUTH_REQUIRED` | SERVER (feature flag) |
| `AUTOSEO_WORKER_SECRET` | SECRET |
| `CRON_SECRET` | SECRET |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | PUBLIC id / SECRET |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | PUBLIC id / SECRET |
| `FACEBOOK_GRAPH_VERSION` | SERVER config |

`.gitignore` ignores `.env.local` and `data/db.json`, but not generic `.env`. No secrets were opened during this inventory.

## 10. Background jobs

- Durable queue in Supabase (`supabase/v6-queue.sql`, `lib/jobs/queue.ts`).
- Worker: `POST /api/worker/publish` with `x-autoseo-worker-secret`.
- Cron: `GET /api/cron/autoseo` with `Authorization: Bearer ${CRON_SECRET}`; recovers stale jobs; processes a batch of 5.
- Job claim: `POST /api/jobs/claim` (worker secret).
- Worker health: `POST /api/worker/health` (worker secret + `x-workspace-id`, **no membership check** — secret is the gate).
- Calendar “Run Due Items Now” is a user-triggered API, not a substitute for cron.

## 11. AI flows

- Content generation, SEO interpretation, keywords, hashtags, reports, variants: `lib/claude.ts`.
- Deterministic SEO score is authoritative; Claude is interpretation (`app/api/analyze/route.ts`).
- Strategist / OS: deterministic engines over stored workspace evidence; documented guardrail that humans approve publishing.
- Workflow executor runs keyword/competitor/technical/local/architecture steps; it does not call publishers directly.
- Publishing still goes through queue/approval or auto-publish connection flags.
- AI cannot be said to be isolated from privileged operations until auth fail-open is closed: unauthenticated demo mode can still call Claude (`/api/generate`, `/api/analyze`, etc.).

## 12. Rate limiting

In-process `Map` in `lib/security/rate-limit.ts`: 30 requests / 60 seconds, keyed by `x-forwarded-for` or `x-real-ip` or `"unknown"`.

Applied only to: analyze, site-audit, keyword-intelligence, content-intelligence, optimize-content, workspaces list/create.

Not distributed. Multi-instance / serverless bypass is inherent. Most API routes have no limiter.

## 13. Frontend

- Almost the entire product UI is one client component (`app/page.tsx`).
- Additional client islands: AuthScreen, StrategistTab, OperatingSystemTab, AutomationWorkflowPanel.
- No `components/` directory.
- Responsive/accessibility/performance: **NOT VERIFIED** (browser not opened in Phase 0).

## 14. Documentation vs code

README is an appended changelog, not a current source of truth. Direct contradictions:

| README / older docs | Current code |
|---|---|
| “No auth/login” | Supabase Auth + AuthScreen + `requireApiAccess` |
| “No proper OAuth… tokens pasted manually” | OAuth start/callback/refresh/lifecycle exist |
| “Facebook’s 8 tabs are still placeholders” | Also claims “All 12 tabs now fully implemented”; uncommitted `app/api/facebook-tools/*` exists |
| “YouTube Coming Soon placeholders” | Also claims all 13 tabs implemented; uncommitted `app/api/youtube-tools/*` exists |
| “No real background cron” | `/api/cron/autoseo` + worker exist (host must invoke them) |
| Links to `docs/SECURITY-V2.md`, `V3-…`, `V4-…`, `V5-…`, `V8-…`, `V11-…`, `V14-…`, `V18-…`, `V19-…`, `custom-site-receiver-example.md` | Those files are missing. YouTube/Facebook setup now points at existing `docs/INTEGRATIONS.md`. Other historical V3–V19 content was partly folded into `docs/PRODUCTION-SECURITY.md` and `docs/AUTOSEO-VERSION-HISTORY.md`. |
| “Authentication and authorization are not yet implemented” in `docs/PRODUCTION-SECURITY.md` | Auth/RBAC/RLS migrations exist; enforcement is flag-gated |

## 15. Git working tree (uncommitted)

Modified: `README.md`, `app/page.tsx`, `lib/claude.ts`, `lib/publishers/facebook.ts`, `lib/publishers/youtube.ts`, `lib/store.ts`.

Untracked: `app/api/facebook-tools/`, `app/api/youtube-tools/`, `docs/SUPABASE-SETUP-GUIDE.md`, `docs/V35-CHANNEL-API-SECURITY.md`, `lib/auth/channel-api.ts`, `lib/social-competitors-repository.ts`, `supabase/COMBINED-MIGRATION.sql`, `supabase/v35-channel-tools.sql`.

No commit/push was performed (per instructions).

## 16. Concrete defect already visible in source

`app/api/facebook-tools/page-info/route.ts` GET handler references `initialAccess` which is only defined in POST. This is a TypeScript/runtime bug (`ReferenceError` on GET).
