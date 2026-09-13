# AutoSEO Engineering Gap Matrix — Phase 0 working copy

**Date:** 2026-09-12
**Evidence basis:** source inspection only. Runtime, OAuth providers, RLS, browser QA, and production deploy are **NOT VERIFIED**.
**Status values:** OPEN | IN PROGRESS | FIXED | DEFERRED | NOT VERIFIED

Priority: **P0** critical security/data-loss/production blocker · **P1** must fix before professional showcase · **P2** important quality · **P3** optional polish.

| ID | AREA | CURRENT STATE | RISK | PRIORITY | RECOMMENDED FIX | FILES | VERIFICATION METHOD | STATUS |
|---|---|---|---|---|---|---|---|---|
| G-01 | Auth production fail-open | Production (`NODE_ENV=production`) now always requires auth via `isApiAuthRequired()`. Local demo fallback remains for `next dev` unless `AUTOSEO_AUTH_REQUIRED=true`. | Was unauthenticated production APIs | P0 | Done | `lib/auth/policy.ts`, `lib/auth/api-access.ts`, `.env.local.example` | `npm test` (5 policy tests pass). Live anonymous API against `next start` still **NOT VERIFIED** | FIXED (unit) |
| G-02 | Session storage | Access and refresh tokens stored as JSON in `localStorage` (`autoseo.supabase.session`). Any XSS can steal them. No HttpOnly cookie session. | Token theft, account takeover | P1 | Map current login/refresh/logout/recovery, then migrate to Secure HttpOnly cookies incrementally without dropping recovery. Keep Bearer verification until cookie path is proven. | `lib/auth/browser.ts`, `lib/client-api.ts`, `lib/auth/supabase.ts` | Login, refresh, logout, password recovery, protected API still work; tokens not readable from `document` in production | OPEN |
| G-03 | Publisher SSRF | Custom webhook, WordPress, and Shopify now go through `assertSafeUrl` + `safeOutboundFetch`. Shopify host must match `*.myshopify.com`. Receiver error bodies are not forwarded. | SSRF to localhost/metadata via saved destinations | P0 | Done for pre-DNS/IP cases. DNS rebinding without IP pin remains. | `lib/publishers/custom-site.ts`, `wordpress.ts`, `shopify.ts`, `lib/security/url-safety.ts` | `tests/url-safety.test.ts` (unit). Redirect-to-private and live fetch **NOT VERIFIED** | FIXED (unit) |
| G-04 | Crawler SSRF residual | Mapped IPv6 (`::ffff:127.0.0.1`), CGNAT, metadata hosts, and `fetchTextResource` now share the same outbound helper. DNS lookup is still not pinned to the connect address (rebinding TOCTOU). | Residual SSRF via DNS rebind | P1 | Mapped IPv4 classified. IP pinning deferred. | `lib/security/url-safety.ts`, `lib/seo-crawler.ts` | Unit tests for mapped IPv6/private ranges. Rebind **NOT VERIFIED** | PARTIAL |
| G-05 | Toolchain | Next 16.3.4. `next lint` removed; ESLint CLI + `eslint-config-next` in place. `typecheck` script added. | Could not claim lint/typecheck | P1 | Done | `package.json`, `eslint.config.mjs` | `npm ci`, `npm run typecheck`, `npm run lint` (0 errors / 436 warnings), `npm run build` succeeded 2026-09-12 | FIXED |
| G-06 | Stale README | README is a changelog with contradictory claims (no auth vs V4 auth; no OAuth vs implemented OAuth; YouTube/Facebook placeholders vs fully implemented). | False portfolio claims | P1 | Rewrite README to verified current capabilities with IMPLEMENTED / PARTIAL / IN DEVELOPMENT / NOT VERIFIED labels. | `README.md` | Manual review against inventory; no claim without code evidence | OPEN |
| G-07 | Broken doc links | README points at missing `docs/SECURITY-V2.md`, `V3-PRODUCTION-FOUNDATION.md`, `V4-…`, `V5-…`, `V8-…`, `V11-…`, `V14-…`, `V18-…`, `V19-…`, `custom-site-receiver-example.md`, `youtube-facebook-setup.md`. | Broken onboarding | P1 | Point to existing consolidated docs or restore only useful real content. Do not invent files. | `README.md`, `docs/*` | Every README path exists | OPEN |
| G-08 | Tests | Node test runner covers auth policy, URL safety, and secret compare. 14/14 pass. No RBAC/OAuth/browser suite yet. | Security claims still weakly covered | P1 | Expand in later phases | `tests/*.test.ts`, `package.json` | `npm test` 14/14 pass 2026-09-12 | PARTIAL |
| G-09 | CI | No GitHub Actions. | Showcase/quality gate is local-only | P2 | After local commands pass, add a workflow running ci/typecheck/lint/build/tests. | `.github/workflows/` | Workflow file exists and is described; run **NOT VERIFIED** until executed | OPEN |
| G-10 | OAuth E2E | Code implements start/state/callback/encrypt/store/refresh. Docs now describe in-app OAuth, not Playground paste. Live provider test still missing. | Cannot claim production OAuth | P1 | Keep code; E2E only when credentials exist. | `lib/oauth/*`, `app/api/oauth/**`, `docs/INTEGRATIONS.md` | Real Google and Facebook connect/disconnect still **NOT VERIFIED** | PARTIAL |
| G-11 | OAuth state atomicity | `consumeOAuthState` now DELETE+return representation filtered by hash, provider, and expiry. | State reuse window | P2 | Done at PostgREST layer. Concurrent live race **NOT VERIFIED**. | `lib/oauth/state.ts` | Reused/expired state should fail; live race **NOT VERIFIED** | FIXED (code) |
| G-12 | Rate limit | In-memory 30/min, IP-keyed, `"unknown"` fallback. Only a few routes. | Easy bypass on multi-instance; most APIs unlimited | P2 | Keep as best-effort; document limitation; extend to expensive AI/publish routes. Do not claim distributed limiting. | `lib/security/rate-limit.ts` | Burst test on analyze; document uncovered routes | OPEN |
| G-13 | Facebook page-info GET | GET now uses `access.tenant.workspaceId`. Missing YouTube imports added. `unauthorizedResponse` returns `NextResponse`. | Runtime 500; typecheck fail; 401 bypass on `instanceof NextResponse` | P1 | Done | `app/api/facebook-tools/page-info/route.ts`, `app/api/youtube-tools/retention/route.ts`, `app/api/youtube-tools/seo-fix/route.ts`, `lib/auth/api-access.ts` | `npm run typecheck` pass | FIXED |
| G-14 | Demo-mode data path | Unauthenticated `requireApiAccess` success lets generate/analyze/settings/queue/calendar hit `data/db.json` in **development only**. Production no longer takes this path. | Shared-host demo data leak if `next start` was used without the flag | P0 | Coupled to G-01. Production fail-closed. | `lib/auth/policy.ts`, `lib/auth/api-access.ts` | Policy unit tests. Live `next start` anonymous call **NOT VERIFIED** | FIXED (unit) |
| G-15 | RBAC inconsistency | Automation, technical-seo, local-seo, and site-architecture mutations now require `editor`. Other mutating routes may still be membership-only. Live viewer vs editor **NOT VERIFIED**. | Privilege escalation on remaining routes | P1 | Continue route-by-route editor/admin gates; rely on v35 RLS as defense-in-depth. | `lib/auth/rbac.ts`, `app/api/automation/**`, `technical-seo`, `local-seo`, `site-architecture` | Viewer denied editor actions; live User A / Workspace B **NOT VERIFIED** | PARTIAL |
| G-16 | Error leakage | Several Facebook/YouTube/workspace routes return `err.message` to clients. | Internal/provider details to users | P2 | Stable public errors; structured server logs without secrets. | `app/api/facebook-tools/*`, `youtube-tools/*`, `workspaces/route.ts` | Error bodies contain no stack, tokens, or raw provider payloads | OPEN |
| G-17 | `any` usage | Heavy in `app/page.tsx` (~37) and API/repository mappings. | Maintainability, missed defects | P2 | Type external payloads and API boundaries first; do not mechanical-replace. | `app/page.tsx`, repositories, publisher adapters | Targeted typecheck; no behavior change | OPEN |
| G-18 | Frontend monolith | ~3500-line client page owns most UI/state. | Regression risk, a11y/perf hardness | P2 | Incremental extract only where it reduces risk (auth, publish, channel tools). No rewrite. | `app/page.tsx` | Existing tabs still render | OPEN |
| G-19 | Browser / a11y / responsive | Not run in Phase 0. | Cannot claim UI QA | P2 | Real browser pass at 390–1440px; keyboard; labels. | `app/page.tsx`, auth screens | Screenshots + notes. Do not claim WCAG without evidence | OPEN |
| G-20 | Git hygiene | Uncommitted V35 YouTube/Facebook tools + docs + combined migration. Dirty tree. | Accidental incomplete snapshot | P2 | User-driven commit after secrets scan. Provide commands only; do not commit. | git working tree | `git status` clean after user commit | OPEN |
| G-21 | Worker workspace header | `/api/worker/health` trusts `x-workspace-id` given worker secret. | Cross-workspace health if secret leaks | P2 | Bind worker calls to known workspace or signed job payload. | `app/api/worker/health/route.ts` | Request without secret 401; with secret only intended workspace | OPEN |
| G-22 | CSRF / Origin | `sameOriginWrite` allows missing Origin. Bearer is the main CSRF mitigator. | CSRF if cookies are introduced later without updating this | P2 | When moving to cookies, require Origin/CSRF. Until then document Bearer assumption. | `lib/security/request.ts` | Cross-origin POST without bearer rejected; cookie plan tested later | OPEN |
| G-23 | `.gitignore` | Ignores `.env` and `.env.*` except `*.example`. | Accidental secret commit | P1 | Done | `.gitignore` | `git check-ignore` not yet run in this session | FIXED |
| G-24 | RLS runtime | Combined migration now includes `v35-channel-tools` / `social_competitors`. Live apply still **NOT VERIFIED**. | Unknown live policy vs repo SQL | P1 | Apply combined migration on a project; runtime RLS tests later. | `supabase/COMBINED-MIGRATION.sql`, `supabase/v35-channel-tools.sql` | SQL included; live RLS **NOT VERIFIED** | PARTIAL |
| G-25 | Security headers | nosniff, DENY frame, referrer, permissions, HSTS present. No CSP. | XSS impact higher with localStorage tokens (G-02) | P2 | Add a strict CSP compatible with the app; do not break Auth/Supabase. | `next.config.js` | Header inspection on a running server | OPEN |
| G-26 | OAuth callback URL errors | Callback now uses generic `code=` values; details stay in server logs. UI maps codes to stable copy. | Information disclosure | P2 | Done | `app/api/oauth/callback/[provider]/route.ts`, `app/page.tsx` | Failed callback query has no provider exception text | FIXED (code) |
| G-27 | API body limits | No explicit body-size / field-length on many routes. | Abuse, memory pressure | P2 | Limits on generate/publish/settings/webhook URLs. | API routes | Oversized payload 413/400 | OPEN |
| G-28 | Performance | No production build metrics yet. | Unknown bundle cost of 3500-line client page | P2 | Measure after build+runtime stabilize. No blind optimization. | `.next` build output, Lighthouse later | Recorded numbers | OPEN |
| G-29 | Facebook OAuth first page only | `completeOAuth` stores `pages.data[0]`. | Wrong Page connected | P2 | Document as limitation or add page picker. Do not claim full Page selection. | `lib/oauth/provider.ts` | Documented limitation until picker exists | OPEN |
| G-30 | YouTube Analytics scope | Retention tool needs `yt-analytics.readonly`; OAuth config does not request it. | Honest empty/error state — already described in README | P3 | Keep honest error; optionally add scope later. | `lib/oauth/config.ts` | Error path remains clear | DEFERRED |
| G-31 | Image generation / auto A-B winner | README lists as not built. | Fine if labeled roadmap | P3 | Keep as roadmap. Do not implement unless requested. | README | Docs say IN DEVELOPMENT / DEFERRED | DEFERRED |
| G-32 | Package identity | `name: autoseo-phase1` | Confusing for a V35 snapshot | P3 | Rename package when docs are reconciled. | `package.json` | Name matches product | OPEN |
| G-33 | Prettier | None | Inconsistent formatting | P3 | Optional; do not introduce unless needed. | — | — | DEFERRED |
| G-34 | Distributed rate limiting | Not present | Honest limitation | P3 | Document; introduce Redis/KV only when scaling. | `lib/security/rate-limit.ts` | Docs say in-process only | DEFERRED |

## Capability register (not marketing)

| Capability | Label | Evidence |
|---|---|---|
| Website SEO crawl + deterministic score + AI interpretation | IMPLEMENTED | `lib/seo-crawler.ts`, `lib/seo-engine.ts`, `app/api/analyze/route.ts` |
| Keyword / competitor / technical / local / architecture | IMPLEMENTED (code) | corresponding `lib/` + API + SQL. Runtime **NOT VERIFIED** |
| Content generate + approval queue + publishers | IMPLEMENTED (code) | generate/queue/publish-dispatch/adapters |
| YouTube + Facebook channel tools | PARTIALLY IMPLEMENTED | Routes + publishers present; OAuth E2E **NOT VERIFIED** |
| Supabase workspace + RBAC migrations | IMPLEMENTED (SQL + helpers) | Combined includes channel tools. Runtime RLS **NOT VERIFIED** |
| Production auth enforcement | IMPLEMENTED (unit) | Production always requires auth. Live `next start` **NOT VERIFIED** |
| OAuth connect buttons | IMPLEMENTED (code) | Live providers **NOT VERIFIED** |
| Durable publish queue + cron endpoint | IMPLEMENTED (code) | Host cron **NOT VERIFIED** |
| AI Strategist / OS | IMPLEMENTED as planners | Not autonomous publishers |
| Automated test suite | PARTIAL | Auth policy, URL safety, secret compare |
| Production SaaS / enterprise scale | NOT IMPLEMENTED | Do not claim |
| Browser QA / a11y / performance | NOT VERIFIED | — |

## Production environment checklist (draft; unverified)

Required for a production-oriented deploy (not a readiness claim):

- `NODE_ENV=production` (auth is fail-closed in production even if the flag is false)
- `AUTOSEO_AUTH_REQUIRED=true` still recommended so local `next start` without NODE_ENV confusion stays gated
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `AUTOSEO_ENCRYPTION_KEY` (32-byte)
- `AUTOSEO_WORKER_SECRET`, `CRON_SECRET`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_APP_URL` matching real origin
- Google/Facebook OAuth client ids/secrets if those publishers are offered
- Migrations applied (combined or ordered versioned files — **NOT VERIFIED** they are equivalent)
- Host cron hitting `/api/cron/autoseo`
- HTTPS (HSTS header is already set)
