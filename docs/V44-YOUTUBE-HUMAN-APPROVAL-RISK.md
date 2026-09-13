# V44 — YouTube Human Approval & Risk Engine

V44 adds a workspace-scoped approval ledger and deterministic YouTube action risk classification.

Risk tiers:
- Low: draft generation and suggestions; auto execution is allowed only when explicitly enabled.
- Medium: video metadata updates and new publishing; approval is required by default.
- High: bulk metadata changes; always manual approval in v1.
- Critical: destructive actions such as deleting a video; never auto-executable in v1.

Bulk YouTube optimization now creates an `action_approvals` record and remains pending until an admin reviews it. Approval APIs are authenticated, workspace-scoped, same-origin protected for mutations, and require admin role for review.

Apply `supabase/v44-youtube-approval-risk.sql` after the existing migrations.
