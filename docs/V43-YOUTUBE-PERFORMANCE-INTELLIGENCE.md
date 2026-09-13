# V43 — YouTube Performance Intelligence

V43 adds deeper YouTube Analytics API integration and a deterministic performance decision layer.

## Included

- Google OAuth now requests `yt-analytics.readonly` for YouTube connections.
- Channel-level metrics: views, watch time, average view duration, average viewed percentage, likes, comments, shares, subscribers gained/lost.
- Video-level performance breakdown for the selected period.
- Workspace/auth protected performance-intelligence API.
- Evidence-based deterministic recommendations for retention, engagement, subscriber conversion and repeatable winning patterns.
- Recommendations explicitly avoid financial attribution and unsupported causal claims.

## OAuth action required

Existing YouTube connections that were authorized before V43 may not have the new analytics scope. Reconnect the Google YouTube account and grant the additional scope before using Performance Intelligence.

## Endpoint

`GET /api/youtube-tools/performance-intelligence`

Optional query parameters: `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.
