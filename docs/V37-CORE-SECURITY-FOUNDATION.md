# AutoSEO V37 — Core Security Foundation

## Goal
Establish a fail-closed production security baseline before completing channel-specific gap closure.

## Implemented
- Production startup/API security configuration validation.
- Production requires Supabase URL, anon key, service-role key, encryption key, application secret, worker secret and cron secret.
- Production requires `AUTOSEO_AUTH_REQUIRED=true`.
- Production application URL must be HTTPS.
- AES-256 encryption key format is validated as 64 hexadecimal characters.
- V37 database migration reasserts secure role-helper functions.
- Tenant `workspace_id` immutability is enforced across all current workspace-owned tables, including YouTube competitors.
- Anonymous PostgREST access is explicitly revoked from tenant tables.
- Sensitive connection/OAuth/job/audit mutation access remains server-side only.

## Verification
Run on the developer machine:

```bash
npm run lint
npm run build
```

Then apply `supabase/v37-core-security.sql` in the target Supabase project and verify authenticated workspace access plus viewer/editor/admin permissions.

## Important
This phase does not replace the remaining production infrastructure work such as isolated SSRF egress and distributed rate limiting. It establishes the common application/database security boundary first.
