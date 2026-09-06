
**Update:** Website is now also grouped by pillar (SEO: 6 tools, Marketing:
Content Strategy + Content Generator + Publish, Analytics: the shared
Analytics tab), matching YouTube's structure. Facebook now has its own 8
placeholder tabs too, mirroring YouTube's pattern: SEO (Page & Post Discovery
Optimization, Hashtag & Keyword Research), Marketing (Post A/B Testing, Bulk
Post Scheduler, Comment & Engagement Assistant, plus the shared Content
Generator/Publish/Studio), Analytics (Post Performance Analytics, Competitor
Page Tracking, Audience Insights, plus the shared Analytics tab). A bug where
clicking a shared tab (Content Generator, Publish, Studio, Analytics) from
inside YouTube's or Facebook's category would jump you back to Website's
category was fixed — sub-tab clicks no longer re-derive the category.

**Next step in progress:** YouTube's category now lists 10 placeholder tabs
("Coming Soon" cards) organized by pillar — SEO (Keyword Research, Video SEO
Studio, Tag Generator, Channel Audit), Marketing (Thumbnail & Title A/B
Testing, Bulk Video Optimizer, Community Post Generator), and Analytics
(Video Performance Analytics, Competitor Channel Tracking, Watch Time &
Retention Insights) — matching Section 4.8's TubeBuddy/vidIQ-style feature
list. These are UI-only placeholders for now; each will get real
implementation one at a time.

## Navigation: Channel-first (Website / YouTube / Facebook / Overview)

Per a product decision to focus specially on YouTube and Facebook management
(not just website SEO), the UI's 19 tabs are now organized under four
top-level categories instead of one flat row:

- **🌐 Website** (9 tabs) — SEO Analyzer, Keyword Research, Competitor
  Intelligence, Content Strategy, Technical SEO, Internal Linking, Local
  SEO, plus Content Generator and Publish.
- **📺 YouTube** (3 tabs) — Content Generator, Publish, AI Content Studio.
- **📘 Facebook** (3 tabs) — Content Generator, Publish, AI Content Studio.
- **⚙️ Overview & Settings** (9 tabs) — Analytics, Automation, Quality &
  Fact Check, SEO Experiments, Monitoring & Alerts, Advanced Analytics &
  ROI, AI SEO Strategist, AI Operating System, System.

**Honest imbalance, not a bug:** Website has far more tools than YouTube/
Facebook right now because the advanced SEO-suite tools (keyword research,
technical SEO, local SEO, internal linking, competitor intelligence) were
built as website-only tools — there's no "YouTube Keyword Research" or
"Facebook Technical SEO" yet. Content Generator, Publish, and AI Content
Studio already support all three channels internally (via a channel
selector), so they appear under all three category tabs. Building out
channel-specific advanced tools for YouTube/Facebook (the TubeBuddy/vidIQ-
style features from the Master Requirements Document's Section 4.8, and
equivalent Facebook-specific tools) is the natural next step to balance this
out, given the stated focus on YouTube/Facebook management.

## V17 Content & Semantic Intelligence
- Readable page-content extraction
- Actual keyword occurrence/density analysis
- Semantic term and lightweight entity signals
- Search-intent-aware topic gaps
- Internal-link opportunity signals
- Deterministic content intelligence API at `/api/content-intelligence`
# AutoSEO V10

# AutoSEO — Phase 1-5 + Advanced SEO Fixing + Shopify (Full Build)

This is the **complete Phase 1-5** foundation, plus an **advanced SEO
fixing** feature that goes beyond reporting issues to actually generating
and (where the connected site supports it) applying fixes to existing live
pages. Described in `docs/MASTER-REQUIREMENTS.md`.

## Shopify (new — second no-code website connection)

Per Section 4.1's developer vs. non-developer segmentation: WordPress covers
one major no-code platform, **Shopify covers the next-most-common one for
small e-commerce businesses in the target market** — no code, no developer
needed. The user generates credentials entirely from their own Shopify
admin (Settings → Apps and sales channels → Develop apps → create an app →
enable the `write_content` scope → install → copy the Admin API access
token) and pastes it into the Publish tab's new "Shopify" option, alongside
"WordPress" and "Custom Site."

- `lib/publishers/shopify.ts` — new adapter: create/update Shopify **Pages**
  (title, body, and meta description via the `global`/`description_tag`
  metafield — the same field Shopify's own admin SEO fields use).
- Wired into `lib/publish-dispatch.ts`, `lib/store.ts` (new
  `ShopifySettings`, `WebsitePlatformType` extended), and
  `app/api/settings/route.ts`.
- Both new-content publishing and the advanced SEO-fix "update existing
  page" flow work for Shopify, same as WordPress.

## Advanced SEO Fixing (new)

The SEO Analyzer tab now has a **"Fixes Generate کریں"** button after any
analysis. It produces concrete, ready-to-use values for the issues found:
- A corrected title and meta description
- Suggested H2 headings
- A schema.org JSON-LD snippet

These can be sent to the **Publish** tab's approval queue as a special
**"SEO Fix"** draft (distinct from new content — it targets an existing
page's URL). Approving it calls a new `applySeoFixes*` function on the
relevant adapter:

- **Custom Site adapter**: sends an `"update_seo_fields"` action to the
  site's own receiver endpoint (see the updated
  `docs/custom-site-receiver-example.md`) — the site owner's code decides
  exactly how title/meta/headings/schema get applied. This is the
  architecturally right approach for the product: AutoSEO never needs a
  user's source code or database access, only a small endpoint the owner
  builds and fully controls (can revoke the API key anytime).
- **WordPress adapter**: looks up the existing post by URL slug and updates
  its title + excerpt via the REST API. **Honest limitation:** WordPress
  core has no native meta-description or schema-markup field (those come
  from plugins like Yoast/RankMath with their own custom-field names) — so
  suggested headings and schema JSON-LD are shown for the user to paste in
  manually for WordPress sites, rather than guessing at a plugin's field
  names and possibly writing to the wrong place.

This is genuinely different from giving an AI tool direct GitHub/server
access to a site's source code — see the discussion in
`docs/MASTER-REQUIREMENTS.md` (search "endpoint-based" if added there) for
why the endpoint-based design is the right one for a multi-tenant product
where users won't want to expose their whole site.

**Stack (current stable versions, updated Sept 2026):** Next.js 16 (App Router),
React 19, TypeScript, Tailwind CSS v4 (CSS-first config via `@theme` in
`app/globals.css` — there is no `tailwind.config.js` in v4), Anthropic SDK,
cheerio (HTML parsing for the SEO crawler).


## V2 hardening update (September 2026)

This build includes a production-oriented security and SEO foundation update:

- deterministic SEO scoring is now the primary numeric score; Claude is used for interpretation and additional opportunities;
- the SEO crawler blocks localhost/private/reserved targets, validates redirects, limits response size, and only accepts HTML;
- connected publishing credentials are encrypted at rest with AES-256-GCM when `AUTOSEO_ENCRYPTION_KEY` is configured;
- SEO analysis has a basic request rate limit;
- security/workflow events can be recorded in `data/audit.log.jsonl`;
- new security details and remaining production requirements are documented in `docs/SECURITY-V2.md`.

**Still required before public multi-tenant production:** PostgreSQL/Supabase, real authentication/authorization, OAuth token management, shared rate limiting, durable queue/worker scheduling, transaction/idempotency controls, and network-level SSRF isolation.

## What's here (Phase 1 + Phase 2 + Phase 3)

- `app/page.tsx` — the UI, now with three tabs:
  - **Content Generator** (Phase 1): business profile → pick a channel (website /
    YouTube / Facebook, each fully independent) → pick a language → describe a
    topic → generate a draft. For the website channel, a new button sends the
    draft to the approval queue.
  - **SEO Analyzer** (Phase 2): enter any URL → the app crawls the page and asks
    Claude to score it (0-100) and list prioritized, actionable fixes.
  - **Publish** (Phase 3, new): choose "Custom Site" (for KSTS/Next.js or any
    other custom-built site, via a webhook + API key) or "WordPress" (via
    Application Password), then review, approve, or reject queued drafts —
    approving one publishes it live.
- `app/api/generate/route.ts` — content generation API route.
- `app/api/analyze/route.ts` — SEO analysis API route (crawl → Claude scoring).
- `app/api/settings/route.ts` — save/test WordPress connection credentials.
- `app/api/queue/route.ts` — list drafts / add a new draft to the approval queue.
- `app/api/queue/[id]/route.ts` — approve (→ publish) or reject a queued draft.
- `lib/claude.ts` — the Claude API wrapper: `generateContent()` (Phase 1) and
  `analyzeSeo()` (Phase 2).
- `lib/seo-crawler.ts` — fetches a URL and extracts on-page SEO signals.
- `lib/store.ts` — lightweight local JSON-file data store (`data/db.json`) for
  the approval queue and WordPress settings. This is a stand-in for the real
  Postgres database (Section 5.3 of the Master Requirements Document) that
  Phase 4 introduces when the platform becomes multi-tenant — the data shapes
  here (`ContentDraft`, `WordPressSettings`) are designed to carry over
  unchanged when that migration happens.
- `lib/publishers/wordpress.ts` — WordPress publish adapter (Section 5.2):
  tests the WordPress connection and publishes an approved draft as a live
  post via the WordPress REST API.
- `lib/publishers/custom-site.ts` — generic publish adapter for **any other
  site**, including custom-built ones like KSTS (Next.js) that have no
  standard content API. Works via a small webhook endpoint the site owner
  adds to their own project — see `docs/custom-site-receiver-example.md` for
  a ready-to-paste Next.js version. Future adapters (YouTube, Facebook in
  Phase 4) follow this same file-per-platform pattern.
- `docs/custom-site-receiver-example.md` — the code to paste into a user's
  own website (not this project) so it can receive publish requests.
- `docs/youtube-facebook-setup.md` — how to register apps and get access
  tokens for YouTube/Facebook (a one-time setup with Google/Meta directly).
- `docs/MASTER-REQUIREMENTS.md` — the full project plan.

### Phase 4 additions (new)

- `lib/publishers/youtube.ts` — updates title/description/tags on an
  **existing** YouTube video (uploading new videos needs the raw file, which
  this text pipeline doesn't produce — this covers the TubeBuddy/vidIQ
  "SEO Studio" re-optimization use case from Section 4.8).
- `lib/publishers/facebook.ts` — posts to a connected Facebook Page's feed.
- `lib/publish-dispatch.ts` — routes an approved draft to the right adapter
  based on its channel; used by both manual approval and auto-publish.
- **Permission model** (Section 3, simplified to one mode per platform for
  v1): each connection (Website/YouTube/Facebook) has a toggle — "Suggest
  only" (sits in the Approval Queue until manually approved) or "Auto-publish"
  (fires immediately, still logged in the queue as "published").
- The Approval Queue now shows a channel badge and handles all three channels.

### Phase 4.5 additions (new — the Analytics pillar, Section 1a)

- `lib/analytics/youtube.ts` — channel stats (subscribers, total views,
  video count) and per-video stats (views/likes/comments) via YouTube Data
  API v3's `statistics` part (same token as Phase 4, no new OAuth scope
  needed). Full watch-time/CTR via the separate YouTube Analytics API is a
  documented future upgrade, not built here.
- `lib/analytics/facebook.ts` — Page follower count and recent posts'
  engagement (likes/comments/shares) via the Meta Graph API.
- `lib/analytics/audit.ts` — flags content performing well below the
  channel's own average ("channel audit" from Section 4.8).
- `lib/store.ts` now records **SEO score history** (every analysis run in
  the SEO Analyzer tab is saved, not just the latest one), so trends are
  visible instead of a single point-in-time number.
- `app/api/analytics/route.ts` — aggregates all of the above into one
  response for the dashboard.
- New **Analytics** tab (4th tab): website SEO score trend (with ▲/▼ vs. the
  previous check), YouTube channel + video stats with underperforming videos
  flagged, Facebook page + post stats with underperforming posts flagged.

### Phase 5 additions (new — Advanced Automation)

- `generateTrendIdeas()` in `lib/claude.ts` — uses Claude's server-side
  `web_search` tool to find genuinely current trends for a niche (not static
  training knowledge), returns 5 timely content ideas.
- `generateVariants()` in `lib/claude.ts` — two distinct title options for
  A/B testing (compare real performance later via the Analytics tab).
- `generateReport()` in `lib/claude.ts` — turns the Analytics tab's raw data
  into a short, readable digest.
- `lib/store.ts` now has a **Content Calendar** (`CalendarItem`): plan a
  topic + channel + date; a "Run Due Items Now" button processes anything
  due through the same generation → permission-check → publish pipeline as
  manual generation (Section 3's permission model applies here too).
- `app/api/trends`, `app/api/calendar`, `app/api/calendar/run`,
  `app/api/report` — the new routes backing the above.
- New **Automation** tab (5th tab): Trend Ideas, Content Calendar (with
  "Run Due Items Now"), and Performance Report generation.

**Important scope note on "automation":** there is no real background
scheduler/cron in this dev setup — "Run Due Items Now" is a manual trigger
that does what a cron job would do automatically in production. Deploying
this to a host with real cron (e.g., Vercel Cron hitting
`/api/calendar/run` on a schedule) would make it fully automatic without
changing the underlying logic.

## Running it locally

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.local.example` to `.env.local` and add your Claude API key
   (from console.anthropic.com):
   ```
   cp .env.local.example .env.local
   ```
3. Start the dev server:
   ```
   npm run dev
   ```
4. Open http://localhost:3000

## What's intentionally NOT here yet

- Real database: `data/db.json` is a single-file stand-in, fine for one user
  testing locally, but not safe for multiple simultaneous users.
- No auth/login (single-user for now — needed before this becomes multi-tenant).
- No proper OAuth "Connect" button flow for YouTube/Facebook yet — tokens are
  pasted in manually (see `docs/youtube-facebook-setup.md`).
- Keyword research, competitor gap analysis, bulk processing, and full
  channel audit (rest of Section 4.8) are not built yet.
- No image generation yet (Section 4.4).
- Permission model is one mode (Suggest/Auto) per platform, not the full
  per-action-category matrix from Section 3.
- No real background cron/scheduler — "Run Due Items Now" in the Automation
  tab is a manual stand-in (see Phase 5 notes in `docs/MASTER-REQUIREMENTS.md`).
- A/B testing (`generateVariants()`) exists but isn't wired to
  auto-pick a winner from Analytics data yet — comparison is manual.
- No email delivery for performance reports — generated on-demand only.
- Deeper Analytics: YouTube Analytics API (watch time/CTR), Meta Page
  Insights (reach/impressions), Google Search Console — not built (see
  Phase 4.5 notes in `docs/MASTER-REQUIREMENTS.md`).
- No undo/rollback, no full audit-trail UI (the Approval Queue list doubles
  as the audit trail for now).

## Where to go next

All 5 roadmap phases now have working code (Section 6 of the Master
Requirements Document marks each as built, with honest scope notes on what's
simplified). From here, the work is **hardening and depth**, not new
architecture:
1. Move `data/db.json` to Postgres and add auth (multi-tenant readiness) —
   this unblocks actually onboarding subscribers.
2. Build the real OAuth "Connect with Google/Facebook" flow with token
   refresh, replacing manual token paste.
3. Add the remaining Section 4.8 YouTube features and deeper Analytics
   (YouTube Analytics API, Meta Insights, Search Console).
4. Add image generation (Section 4.4).
5. Wire A/B testing to auto-compare via Analytics data, and add real cron
   for the Content Calendar.


## V3 Production Foundation

Added `supabase/schema.sql`, Supabase Auth verification helpers, tenant context, durable job/idempotency types, and production migration documentation. See `docs/V3-PRODUCTION-FOUNDATION.md`. The complete original V2 feature set remains in this package.

## V4 Auth & API Foundation

V4 adds production-facing API authentication enforcement and a Supabase-backed workspace management API. Set `AUTOSEO_AUTH_REQUIRED=true` in production. The local JSON store is still intentionally retained until the next phase replaces it with workspace-scoped PostgreSQL repositories. See `docs/V4-AUTH-API-FOUNDATION.md`.

## V5 — Supabase Data Layer

V5 adds workspace-scoped Supabase/Postgres persistence for drafts, SEO score history, publishing connections and calendar items. Configure Supabase and `AUTOSEO_AUTH_REQUIRED=true` to activate the production path; local JSON remains a development fallback. See `docs/V5-SUPABASE-DATA-LAYER.md`.

## V6 — Durable publishing queue
V6 adds a Supabase-backed durable job queue, atomic job claiming, idempotent publish jobs, retry/backoff handling, and a worker endpoint. Apply `supabase/v6-queue.sql` after the main schema and configure `AUTOSEO_WORKER_SECRET`. A scheduler/cron must invoke the worker endpoint in production.

## V8 — SaaS Dashboard & Workspace Control Plane

V8 adds a workspace-aware control plane: workspace selector/creation, workspace-scoped client requests, System dashboard, job monitoring, connection health, audit history, and admin-only team membership APIs. Secret/token fields include Show/Hide controls.

Production auth remains controlled by `AUTOSEO_AUTH_REQUIRED=true`; authenticated API calls use the selected `x-workspace-id`.

See `docs/V8-SAAS-DASHBOARD.md` for deployment and verification steps.

## V10 — Production Security & RBAC

V10 adds canonical owner/admin/editor/viewer authorization, server-side workspace membership checks, cross-origin write protection, security headers, owner-membership database protection, append-only audit policies, and safer internal API forwarding. Apply `supabase/v10-security.sql` after the existing Supabase schema/queue migrations.

## V11 — Database Migration & Data Integrity

V11 hardens the persistence layer with database-level invariants and operational history. Apply `supabase/v11-data-integrity.sql` after the V10 migration. It adds atomic workspace creation, one-owner-per-workspace protection, immutable audit logs, job lifecycle guards, stale-lock recovery, job attempt history, and duplicate active publish-job protection. See `docs/V11-DATA-INTEGRITY.md` for migration and preflight checks.

## V13 Provider Lifecycle
V13 adds OAuth token refresh for Google/YouTube, provider health-state persistence, worker health checks, admin revoke/reconnect lifecycle, and database protection against duplicate active provider connections.


## V14 — SEO Intelligence Engine

V14 adds a bounded multi-page site audit with robots.txt, XML sitemap, canonical, noindex, hreflang, Open Graph, Twitter/X cards, JSON-LD, broken-link, duplicate metadata, image-source and deterministic site-level SEO checks. Use `POST /api/site-audit` with a URL and optional `maxPages` (1–50). The crawler remains protected by the existing SSRF-safe URL fetcher and only follows same-host URLs. See `docs/V14-SEO-INTELLIGENCE.md`.


## V15 — Keyword & Content Intelligence
- Deterministic target-keyword analysis via `/api/keyword-intelligence`.
- Search-intent signal, title/meta/H1 alignment, heading coverage, URL alignment, content-length and internal-link signals.
- Prioritized keyword issues and recommendations.


## V17

AI-assisted SEO optimization preview: `/api/optimize-content`. The optimizer uses the existing deterministic content intelligence brief and returns a preview only; publishing remains approval/queue based.

## V18 — Optimization Approval & Versioning

V18 adds human-in-the-loop draft versioning, selective field approval/rejection, immutable version history, and approval-to-durable-publish queue integration. See `docs/V18-OPTIMIZATION-VERSIONING.md` and run `supabase/v18-optimization-versioning.sql`.


## V19 — Rollback & Change Management
V19 adds immutable publication snapshots, human-initiated rollback versions, rollback-to-durable-queue flow, and publication history. Apply `supabase/v19-rollback.sql` after V18. See `docs/V19-ROLLBACK-CHANGE-MANAGEMENT.md`.
