# AIBISORA — Consolidated Production Security & Reliability Notes

Historical AutoSEO version notes remain below. Current launch class: **AIBISORA Free Beta**. See `docs/AIBISORA.md`.

## SECURITY-V2

# AutoSEO V2 Security & Production Foundation

## Implemented in this update

- Server-side AES-256-GCM encryption for connected-account credentials stored in the local development store.
- SSRF protections for SEO crawling: HTTP(S) only, standard ports only, embedded credentials rejected, localhost/private/reserved IPs rejected, redirect targets revalidated, redirect count capped, HTML response required, and response body capped at 2 MB.
- Deterministic SEO scoring engine. Claude remains an interpretation/opportunity layer; the displayed numeric score is reproducible from crawl signals.
- Basic API rate limiting for SEO analysis to reduce accidental or abusive request bursts.
- JSONL audit logging for SEO analyses and security-sensitive workflow events.

## Current Free Beta limitations (code-level)

These replace obsolete claims that the app still used only `data/db.json`.

1. Production (`NODE_ENV=production`) always requires a verified session. Forgetting `AUTOSEO_AUTH_REQUIRED` does not open APIs. Browser sessions prefer HttpOnly cookies; Bearer remains accepted for workers and legacy clients.
2. Workspace membership is checked server-side. `x-workspace-id` is never trusted alone.
3. Rate limiting is in-process. Distributed limiting REQUIRES_PRODUCTION_INFRASTRUCTURE.
4. Publisher and crawler SSRF re-validate redirect Location URLs. DNS-rebinding pinning remains PARTIAL.
5. YouTube uses in-app Google OAuth (`connections.provider = "youtube"`). Manual token paste is legacy/testing-only. Missing Analytics scope requires reconnect. Live Google/Meta OAuth E2E REQUIRES_CONFIGURATION.
6. Facebook OAuth is FIRST_PAGE_ONLY.
7. Billing and paid checkout are OFF for Free Beta. Durable usage metering requires V46 on the live database (owner-applied).
8. Local demo without Supabase is DEVELOPMENT_ONLY.

## Encryption setup

Generate a 32-byte key and put it in `.env.local`:

```bash
openssl rand -hex 32
```

Set the resulting 64-character hex value as `AUTOSEO_ENCRYPTION_KEY`.

Legacy plaintext credentials already present in `data/db.json` remain readable for local compatibility, but the next settings save will rewrite the connected secrets in encrypted form.
