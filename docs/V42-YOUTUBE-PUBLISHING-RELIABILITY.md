# AutoSEO V42 — YouTube Publishing Reliability & Idempotency

## Purpose

V42 hardens YouTube metadata publishing against duplicate/retry scenarios and uncertain provider responses.

## Implemented

- Deterministic YouTube publication fingerprint for a video + desired metadata.
- Idempotent fast path: if YouTube already has the requested title/description/tags, no PUT is issued.
- Provider reconciliation after a failed/uncertain PUT before the job reports failure.
- Post-publish verification of provider state.
- Strict YouTube video ID validation before outbound requests.
- Durable `publication_intents` ledger with workspace-scoped unique fingerprints.
- Publication intent records are server-managed; authenticated clients have read-only visibility.

## Important scope

This phase covers YouTube metadata updates for existing videos. It does not implement raw video-file upload. A successful provider-side update remains the source of truth; the worker may safely retry because the adapter reconciles the provider state first.

## Required migration

Apply `supabase/v42-youtube-publishing-reliability.sql` after the V36–V41 migrations.
