# AIBISORA Free Beta

Customer-facing product name: **AIBISORA**  
Official tagline: **From Web to Social, Your Complete Business Solution.**

Internal engineering names, env keys, cookies, SQL filenames, and some routes may still say AutoSEO or Nexora. Those are **legacy internal identifiers**.

Current launch class: **AIBISORA Free Beta** (billing OFF, paid checkout OFF).

## Architecture

USER → WORKSPACE → SUBSCRIPTION/BETA PLAN → ENTITLEMENTS → USAGE → ROLE → ACTION

Workspace is the tenant boundary. APIs derive membership from the verified session plus `x-workspace-id`. The header is never trusted alone.

## Setup

1. Copy `.env.local.example` to `.env.local`.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `AUTOSEO_ENCRYPTION_KEY` (64 hex chars). Internal legacy name; do not rename without a migration plan.
4. Production: `NODE_ENV=production` always requires authentication. Forgetting `AUTOSEO_AUTH_REQUIRED` does not open APIs.
5. Apply `supabase/COMBINED-MIGRATION.sql` (includes V46) or `supabase/v46-nexora-saas.sql` on an already-migrated database. The `nexora` filename is a legacy SQL identifier.
6. Optional replay-hardening: `supabase/v47-oauth-consume.sql` (code already uses atomic DELETE … RETURNING without this file).
7. Set `NEXORA_PLATFORM_ADMIN_EMAILS` for Admin Console access (legacy env name).
8. Google/Meta OAuth: `docs/INTEGRATIONS.md`.
9. Keep `NEXORA_BETA_MODE=true` and `NEXORA_BILLING_PROVIDER=none` for Free Beta (legacy env names).

Do **not** run production SQL from this application automatically. The owner applies migrations in the Supabase SQL editor.

## Authentication

- Production always requires a verified Supabase user.
- Browser sessions prefer **HttpOnly** cookies (`nexora_sb_access`, `nexora_sb_refresh`) set by `/api/auth/session`. Cookie names are internal legacy identifiers.
- Cookies are Secure in production.
- Bearer tokens remain accepted for workers, recovery, and older clients.
- Local demo without Supabase remains **development-only** and is documented in `.env.local.example`.

## Free Beta entitlements

When `NEXORA_BETA_MODE` is not `false` and billing is `none`, every non-restricted workspace is gated by the **AIBISORA Free Beta** catalog:

Included: website SEO, keywords, content generate/refresh, YouTube connect/SEO/analytics/publish, Facebook connect/analytics/publish, basic automation, AI strategist.

Not included: YouTube bulk, advanced automation, public API, priority processing.

Not live: Instagram, WhatsApp, Website Builder.

Admin overrides and workspace suspension still apply. Paid plan assignment is stored but does not change gating until billing is enabled.

Checkout returns `501` with `BILLING_DISABLED_FOR_BETA`. Browser payment status is never trusted.

## Usage

Monthly per-workspace meters. Exceeded limits return HTTP 429.

Durable counters require V46 `usage_counters`. Without V46 the in-memory fallback is **DEVELOPMENT_ONLY** and is not durable across instances.

## Admin Console

Route: `/admin`

Non-admins receive 401/403 from `/api/admin/*` even if they open the URL.

Sections: Overview, Users, Workspaces, Features, Usage, Connections, Audit logs, System settings.

## YouTube

In-app Google OAuth. Database provider remains `youtube`. Analytics requires `yt-analytics.readonly`. Old tokens must reconnect.

Community posts: **GENERATION_ONLY**.  
New video upload: **API_LIMITATION** (metadata update on existing videos only).  
Thumbnail images: **NOT_IMPLEMENTED** (title variants only).

Live Google OAuth/API: **REQUIRES_CONFIGURATION** until executed in a configured environment.

## Facebook

OAuth uses Meta Graph API **v26.0** (`FACEBOOK_GRAPH_VERSION`, default `v26.0`). Graph API v20.0 is removed on 24 September 2026 and is not used in production paths.

OAuth connects the **first Page only** (`FIRST_PAGE_ONLY`). Multi-page selection is not available in this beta.

Deeper Insights may be **API_LIMITATION** depending on Meta app review. Audience Insights attempts `page_fans_gender_age` and surfaces a clear message if Meta does not return demographics. No fabricated data.

Live Meta OAuth/API: **REQUIRES_CONFIGURATION** until executed.

## Publisher SSRF

WordPress, custom-site, and Shopify publishers use `safeOutboundFetch` independently of the SEO crawler. Shopify hostnames must be `*.myshopify.com`.

## Rate limiting

In-process per instance. AI generate, SEO analyze, publish queue, auth session/password, and OAuth start routes are covered. Distributed limiting **REQUIRES_PRODUCTION_INFRASTRUCTURE**.

## Language

Customer-facing UI is **English only**. Default: `en` / `en-US` / LTR.

The language selector reads enabled locales from `lib/i18n/registry.ts`. Future languages (Arabic, German, French, Spanish, and others) are registered as `enabled: false` until a complete catalog exists.

UI language is independent from AI/content-generation language. Tools may still generate Urdu or Roman Urdu content when the user chooses that content language.

Preference fallback: user → workspace → cookie/local store → English.

## Internal legacy identifiers (do not rename casually)

| Identifier | Kind | Why it remains |
|---|---|---|
| `AUTOSEO_*` env keys | Environment | Encryption, worker, auth flags, cron |
| `NEXORA_*` env keys | Environment | Beta mode, billing provider, admin emails |
| `nexora_sb_access` / `nexora_sb_refresh` | Cookies | Changing them would sign everyone out |
| `nexora_theme`, `nexora_ui_lang` | Cookies / storage | Preference continuity |
| `autoseo.workspaceId` | localStorage | Workspace selection |
| `/api/cron/autoseo` | Route | Existing Vercel cron path |
| `x-autoseo-worker-secret` | Header | Existing workers |
| `supabase/v46-nexora-saas.sql` | SQL file | Already-applied migrations |

## Vercel cron

`vercel.json` schedules `GET/POST` compatible path `/api/cron/autoseo` every minute (`* * * * *`).

- **Vercel Pro / Enterprise:** one-minute cron is supported and is kept because calendar/automation due items can be minute-grained.
- **Vercel Hobby:** do not assume one-minute cron. Use an external HTTPS scheduler with `CRON_SECRET`.

## Known limitations

| Item | Status |
|---|---|
| Live Google OAuth E2E | REQUIRES_CONFIGURATION |
| Live Meta OAuth E2E | REQUIRES_CONFIGURATION |
| V46 applied on live DB | REQUIRES_CONFIGURATION (owner applies SQL) |
| Billing / payments / MRR | OFF for Free Beta |
| Facebook page picker | FIRST_PAGE_ONLY |
| Instagram / WhatsApp / Website Builder | COMING SOON |
| DNS rebinding connect pinning | PARTIAL |
| WCAG certification | NOT VERIFIED |
| Accessibility QA | PARTIAL (labeled controls; no WCAG claim) |
| UI language | English only. Architecture is multilingual-ready; additional locales stay disabled until catalogs exist. |
| Distributed rate limit | REQUIRES_PRODUCTION_INFRASTRUCTURE |
| Browser session leftover in localStorage | Legacy Bearer tokens still accepted; new logins use HttpOnly cookies |
| Local demo without Supabase | DEVELOPMENT_ONLY |
