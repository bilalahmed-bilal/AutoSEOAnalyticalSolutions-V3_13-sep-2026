# V38 — YouTube AI Reliability & Guardrails

This phase hardens the YouTube AI generation layer without changing the public API response shapes.

## Implemented
- Central safe JSON parsing with invalid-output classification.
- Strict runtime validation for YouTube keyword, tag, SEO-fix and Community-post responses.
- Tag normalization and duplicate removal.
- Output length and enum bounds.
- Poll-specific validation for Community posts.
- Explicit treatment of user-supplied topic/profile/video metadata as untrusted data in AI prompts.
- Shared AI error classification and a bounded retry helper for transient provider failures.

## Safety rule
AI output is treated as untrusted until validated. Invalid output must fail closed rather than being persisted or published.

## Not included yet
- AI token/cost metering.
- Durable AI job queue integration.
- Persistent AI decision history.
- Human approval workflow.
