# Nexora Free Beta

Customer-facing product name: **Nexora**  
Internal engineering names, env keys, and some tables may still say AutoSEO.

Current launch class: **Nexora Free Beta** (billing OFF, paid checkout OFF).

## Architecture

USER → WORKSPACE → SUBSCRIPTION/BETA PLAN → ENTITLEMENTS → USAGE → ROLE → ACTION

Workspace is the tenant boundary. APIs derive membership from the verified session plus `x-workspace-id`. The header is never trusted alone.

## Setup

1. Copy `.env.local.example` to `.env.local`.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `AUTOSEO_ENCRYPTION_KEY` (64 hex chars).
4. Production: `NODE_ENV=production` always requires authentication. Forgetting `AUTOSEO_AUTH_REQUIRED` does not open APIs.
5. Apply `supabase/COMBINED-MIGRATION.sql` (includes V46) or `supabase/v46-nexora-saas.sql` on an already-migrated database.
6. Optional replay-hardening: `supabase/v47-oauth-consume.sql` (code already uses atomic DELETE … RETURNING without this file).
7. Set `NEXORA_PLATFORM_ADMIN_EMAILS` for Admin Console access.
8. Google/Meta OAuth: `docs/INTEGRATIONS.md`.
9. Keep `NEXORA_BETA_MODE=true` and `NEXORA_BILLING_PROVIDER=none` for Free Beta.

Do **not** run production SQL from this application automatically. The owner applies migrations in the Supabase SQL editor.

## Authentication

- Production always requires a verified Supabase user.
- Browser sessions prefer **HttpOnly** cookies (`nexora_sb_access`, `nexora_sb_refresh`) set by `/api/auth/session`.
- Bearer tokens remain accepted for workers, recovery, and older clients.
- Local demo without Supabase remains **development-only** and is documented in `.env.local.example`.

## Free Beta entitlements

When `NEXORA_BETA_MODE` is not `false` and billing is `none`, every non-restricted workspace is gated by the **Nexora Free Beta** catalog:

Included: website SEO, keywords, content generate/refresh, YouTube connect/SEO/analytics/publish, Facebook connect/analytics/publish, basic automation, AI strategist.

Not included: YouTube bulk, advanced automation, public API, priority processing.

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

OAuth connects the **first Page only** (`FIRST_PAGE_ONLY`). Multi-page selection is not available in this beta.

Deeper Insights may be **API_LIMITATION** depending on Meta app review.

Live Meta OAuth/API: **REQUIRES_CONFIGURATION** until executed.

## Publisher SSRF

WordPress, custom-site, and Shopify publishers use `safeOutboundFetch` independently of the SEO crawler. Shopify hostnames must be `*.myshopify.com`.

## Rate limiting

In-process per instance. Distributed limiting **REQUIRES_PRODUCTION_INFRASTRUCTURE**.

## Intentional public / non-entitlement routes

| Route | Why it is not feature-gated |
|---|---|
| `/api/auth/*` | Login, signup, session, password |
| `/api/oauth/callback/*` | Provider redirect |
| `/api/worker/*`, `/api/cron/*` | Secret-authenticated jobs |
| `/api/workspaces*`, `/api/settings` | Tenant administration |
| `/api/connections*`, `/api/dashboard`, `/api/jobs`, `/api/audit` | Workspace membership is enough |
| `/api/billing/*` | Read subscription; checkout is disabled |
| `/api/admin/*` | Platform admin authorization |

Publishing queue routes check channel entitlements (`youtube.publish` / `facebook.publish` / website SEO) after the channel is known.

## Known limitations

| Item | Status |
|---|---|
| Live Google OAuth E2E | REQUIRES_CONFIGURATION |
| Live Meta OAuth E2E | REQUIRES_CONFIGURATION |
| V46 applied on live DB | REQUIRES_CONFIGURATION (owner applies SQL) |
| Billing / payments / MRR | OFF for Free Beta |
| Facebook page picker | FIRST_PAGE_ONLY |
| DNS rebinding connect pinning | PARTIAL |
| WCAG certification | NOT VERIFIED |
| Accessibility QA | PARTIAL (labeled controls; mixed Urdu/English UI; no WCAG claim) |
| Distributed rate limit | REQUIRES_PRODUCTION_INFRASTRUCTURE |
| Browser session leftover in localStorage | Legacy Bearer tokens still accepted; new logins use HttpOnly cookies |
| Local demo without Supabase | DEVELOPMENT_ONLY |
