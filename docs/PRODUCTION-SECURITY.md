# AutoSEO — Consolidated Production Security & Reliability Notes

## SECURITY-V2

# AutoSEO V2 Security & Production Foundation

## Implemented in this update

- Server-side AES-256-GCM encryption for connected-account credentials stored in the local development store.
- SSRF protections for SEO crawling: HTTP(S) only, standard ports only, embedded credentials rejected, localhost/private/reserved IPs rejected, redirect targets revalidated, redirect count capped, HTML response required, and response body capped at 2 MB.
- Deterministic SEO scoring engine. Claude remains an interpretation/opportunity layer; the displayed numeric score is reproducible from crawl signals.
- Basic API rate limiting for SEO analysis to reduce accidental or abusive request bursts.
- JSONL audit logging for SEO analyses and security-sensitive workflow events.

## Important production limitations still remaining

This project is now safer as a development foundation, but it is **not yet a production multi-tenant SaaS**.

1. `data/db.json` is still a local file store. Replace it with PostgreSQL/Supabase before onboarding multiple users.
2. Authentication and authorization are not yet implemented. Do not expose this build publicly as a multi-user service.
3. The in-memory rate limiter is process-local. Production needs a shared limiter (for example Redis/KV) at the edge/API layer.
4. DNS validation reduces SSRF risk but cannot fully eliminate DNS-rebinding concerns when the application fetches directly. Production should use network egress controls or a dedicated fetch proxy/isolation layer.
5. Connected-platform OAuth flows, token refresh, revocation, and least-privilege scopes still need to replace manually pasted tokens.
6. The content calendar still requires a durable queue/scheduler for unattended execution.
7. Database transactions, idempotency keys, job retries, dead-letter handling, and immutable audit storage should be added with the PostgreSQL/queue migration.

## Encryption setup

Generate a 32-byte key and put it in `.env.local`:

```bash
openssl rand -hex 32
```

Set the resulting 64-character hex value as `AUTOSEO_ENCRYPTION_KEY`.

Legacy plaintext credentials already present in `data/db.json` remain readable for local compatibility, but the next settings save will rewrite the connected secrets in encrypted form.
