# AIBISORA

**From Web to Social, Your Complete Business Solution.**

Current product status: **Free Beta**

AIBISORA is an AI-powered business growth platform for websites, SEO, content, YouTube, and Facebook. Instagram, WhatsApp, and the in-app Website Builder are on the roadmap and are labeled Coming Soon — they are not live.

This repository is the AIBISORA product. Internal engineering names, environment keys, cookies, SQL files, and worker paths may still say AutoSEO or Nexora. Those are **legacy internal identifiers**, not the current brand.

Billing and paid checkout are **OFF**.

## Capability status

Labels mean what they say. Unfinished work is not marked complete.

### IMPLEMENTED

- Production authentication fail-closed (`NODE_ENV=production` always requires a verified Supabase user)
- HttpOnly access and refresh cookies, with Bearer still accepted for workers and older clients
- Workspace tenancy: membership is derived from the verified session plus `x-workspace-id` (the header is never trusted alone)
- Website SEO crawl, deterministic scoring, AI interpretation
- Keyword, competitor, technical, local, and internal-linking tools (code present)
- Content generation, human approval queue, WordPress / Shopify / custom-site publishers
- YouTube in-app Google OAuth, metadata update on existing videos, analytics reconnect when `yt-analytics.readonly` is missing
- Facebook in-app Meta OAuth (first Page only), Page publishing, comments, hashtags, competitor stats, audience-insights fallback
- Automation workflows and calendar run endpoint
- AI Strategist and AI Operating System as planners (they do not publish on their own)
- Free Beta entitlement catalog (billing off)
- Channel-first navigation: Websites, YouTube, Facebook, Instagram (Coming Soon), WhatsApp (Coming Soon)

### PARTIAL

- Facebook Page picker: **FIRST_PAGE_ONLY**
- Publisher/crawler SSRF: redirect re-validation is in place; DNS-rebinding IP pinning is not
- Rate limiting: in-process per instance, not distributed
- RBAC: editor/admin gates exist on many mutation routes; live User A / Workspace B isolation is owner-applied SQL plus code, runtime **NOT VERIFIED** until a configured Supabase project is tested
- Accessibility: labeled controls and keyboard-focus styles exist; **no WCAG certification**

### COMING SOON

- Instagram
- WhatsApp
- Website Builder

### API LIMITATION

- YouTube Community posts: **GENERATION_ONLY** (YouTube has no public Community posting API)
- New YouTube video upload: metadata update on **existing** videos only
- Deeper Facebook Insights may require Meta app review

### NOT IMPLEMENTED

- Thumbnail **image** generation (title variants only)
- Paid checkout, subscriptions as a live payment product, MRR/revenue dashboards
- Distributed/global rate limiting
- Autonomous publishing without human approval when the connection is in suggest mode

### NOT VERIFIED

- Live Google OAuth round-trip against a production Google Cloud project
- Live Meta OAuth round-trip against a production Meta app
- Live Supabase RLS on a deployed project
- Live auth E2E against a configured Supabase project
- Vercel production deploy of this exact snapshot
- WCAG conformance audit

## Architecture

```
USER → WORKSPACE → BETA ENTITLEMENTS → USAGE → ROLE → ACTION
```

Workspace is the tenant boundary. APIs verify the Supabase user, then membership, then role and feature entitlements.

## Authentication

- Production always requires a verified Supabase user.
- Browser sessions prefer HttpOnly cookies (`nexora_sb_access`, `nexora_sb_refresh` — internal legacy cookie names) set by `/api/auth/session`.
- Cookies are `Secure` in production, `SameSite=Lax`.
- Bearer tokens remain accepted for workers, recovery, and older clients.
- JWT payloads are never trusted locally; the server verifies with Supabase Auth `GET /auth/v1/user`.
- Local demo without Supabase is **DEVELOPMENT_ONLY**.

## Workspace model

Create or select a workspace after sign-in. Connections, queue, analytics, automation, and usage are workspace-scoped. Members cannot access another workspace through `x-workspace-id` alone.

## SEO, YouTube, Facebook, automation, AI, publishing

See `docs/AIBISORA.md` for the detailed capability notes, including YouTube generation-only Community posts and Facebook first-page OAuth.

## Beta limitations

- Billing OFF. Checkout returns `501` with `BILLING_DISABLED_FOR_BETA`.
- No fake metrics, sample traffic, or invented subscription state.
- In-process rate limits only.
- Vercel cron in `vercel.json` is every minute. That schedule requires **Vercel Pro/Enterprise**, or an external HTTPS scheduler posting to `/api/cron/autoseo` with `CRON_SECRET`. Hobby cannot be assumed to support one-minute cron.

## Required environment variables

Copy `.env.local.example` to `.env.local`. Current production-oriented variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTOSEO_ENCRYPTION_KEY` (64 hex chars)
- `AUTOSEO_APP_SECRET`
- `AUTOSEO_WORKER_SECRET`
- `CRON_SECRET`
- `ANTHROPIC_API_KEY`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` if YouTube or Search Console is offered
- `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` if Facebook is offered
- `FACEBOOK_GRAPH_VERSION=v26.0`
- `NEXORA_BETA_MODE=true`
- `NEXORA_BILLING_PROVIDER=none`
- `NEXORA_PLATFORM_ADMIN_EMAILS` for `/admin`

`AUTOSEO_*` and `NEXORA_*` names are internal legacy keys. Do not rename them in a live environment without a migration plan.

## Local setup

```
npm ci
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000

## Verification commands

```
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Do not report these as passing unless the commands actually succeed.

## Deployment

1. Apply `supabase/COMBINED-MIGRATION.sql` (includes V46) in the Supabase SQL editor. Do **not** run production SQL from this application.
2. Set production environment variables on the host.
3. `NODE_ENV=production` (auth is fail-closed even if `AUTOSEO_AUTH_REQUIRED` is omitted).
4. HTTPS origin in `NEXT_PUBLIC_APP_URL`.
5. Register Google and Meta redirect URIs. See `docs/INTEGRATIONS.md`.
6. Cron: Vercel Pro/Enterprise can keep `* * * * *`, otherwise use an external scheduler.

## Historical documents

Engineering history is preserved separately and is not the current product brand:

- `docs/AUTOSEO-VERSION-HISTORY.md`
- `docs/NEXORA.md` (historical Nexora Free Beta notes; current doc is `docs/AIBISORA.md`)
- Versioned `docs/V*.md` files
- `docs/MASTER-REQUIREMENTS.md` (original requirements)
