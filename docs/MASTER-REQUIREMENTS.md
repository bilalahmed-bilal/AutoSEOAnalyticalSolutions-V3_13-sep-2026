# AI-Powered SEO & Marketing Automation SaaS — Master Requirements Document

**Version:** 2.1
**Purpose:** This document is the single source of truth for building this product. Hand this file to any AI coding assistant (Cursor, Claude Code, etc.) or human developer and they should be able to understand the full scope, architecture, and phased build plan without needing further clarification.

---

## 1. Project Overview

**Product name (working title):** AutoSEO / (to be finalized)

**One-line description:** A multi-tenant SaaS platform that connects to any user's website and social media accounts, uses AI (Claude) to perform advanced SEO analysis and content/marketing generation, and — with explicit owner permission — autonomously publishes optimized content (text posts, images, meta updates) directly to the connected platforms.

**Core differentiator:** Unlike typical SEO tools that only *report* issues, this platform can *take action* — drafting and publishing content, updating meta tags, generating images, and posting to social media — always gated behind a permission and approval system. The go-to-market wedge is an underserved segment (see Section 3a — Language & Market Strategy) rather than competing head-on with established, well-funded global players from day one.

**Target users:** Any business, creator, or website owner (multi-tenant — not built for one specific company). Examples: small business owners, e-commerce stores, content creators, local service businesses, agencies managing multiple clients. **The founder is also the first user** — the tool will be used on the founder's own KSTS project (website + YouTube channel) both as a real production use case and as internal validation before/while onboarding paying subscribers.

**Business model (confirmed direction):** Subscription-based SaaS. The founder will use the platform on their own properties and also offer it to other users/businesses as paid subscription plans. Exact tiers/pricing remain an open decision (Section 8).

---

## 1a. The Three Pillars: SEO, Marketing, Analytics

**Principle:** Every feature in this product belongs to one of three pillars, and the product must perform at an advanced level in all three — not just be strong in one and weak in the others. This is the organizing lens for all future roadmap decisions: before adding or prioritizing a feature, place it in a pillar and ask whether that pillar is falling behind the other two.

### Pillar 1 — SEO (analysis + optimization)
Finding and fixing what stops content from being found. Covers:
- On-page technical SEO analysis (Section 4.2) — the crawler + scoring engine (built, Phase 2).
- Keyword research (Section 4.2) — not yet built.
- Competitor gap analysis (Section 4.2) — not yet built.
- YouTube SEO Studio-style optimization: title/description/tag optimization on existing videos (Section 4.8) — built, Phase 4.
- Website content generation written to be SEO-sound from the start (Section 4.3) — built, Phase 1.

### Pillar 2 — Marketing (content + distribution)
Creating and getting content out into the world. Covers:
- Content generation across channels — website copy, YouTube titles/descriptions, Facebook posts (Section 4.3) — built, Phase 1.
- AI image generation (Section 4.4) — not yet built.
- Publishing/distribution with permission-gated approval or auto-publish (Section 4.5) — built, Phase 3-4, for Website/YouTube/Facebook.
- Content calendar suggestions, A/B testing of titles/thumbnails, bulk content processing (Sections 4.6, 4.8) — not yet built.

### Pillar 3 — Analytics (measurement + insight)
Understanding what's actually working, so SEO and Marketing decisions are evidence-based rather than guesses. Covers:
- Connected-account overview dashboard (Section 4.7) — not yet built.
- Performance tracking pulled from each platform's own analytics API (YouTube Analytics API, Meta Insights API, Google Search Console) — not yet built.
- SEO score history over time per website (currently only a single point-in-time score, no trend) — not yet built.
- Channel audit — flagging underperforming content worth revisiting (Section 4.8) — not yet built.
- Trend/hashtag monitoring via web search (Section 4.6) — not yet built.
- Performance reporting digests (Section 4.6) — not yet built.

### Current build status across the three pillars (honest snapshot)
As of Phase 4.5: **SEO, Marketing, and Analytics all have real, working functionality.** SEO score history now shows trends over time, and YouTube/Facebook stats give a basic performance picture. The Analytics pillar's current depth is intentionally lighter than SEO/Marketing — it covers count-based metrics (views, likes, followers, score history) rather than deeper platform-analytics data (watch time, CTR, Search Console impressions), which needs additional OAuth scopes and is the next increment (see Phase 4.5 in Section 6).

---

## 2. Goals & Non-Goals

### Goals
- Let a user connect their website (CMS) and social accounts once, and let the platform continuously improve SEO and produce marketing content.
- Automate the repetitive parts of SEO/marketing (writing meta descriptions, generating social captions, suggesting keywords, creating images) using Claude.
- Allow graduated autonomy: user starts with "suggest only" mode and can later enable "auto-execute" for specific low-risk action types.
- Support multiple platforms, built in priority order: website CMS/SEO first, YouTube second, Facebook third (see Section 2b); Instagram, LinkedIn, and X deferred to a later phase.
- Provide a clear audit trail of every action the AI takes.

### Non-Goals (at least for v1)
- This tool does not guarantee search-engine rankings — off-page factors (backlinks, domain age, site speed infra) are outside its control.
- It will not act on any account without that account owner's explicit connected authorization (no scraping/posting to accounts the user does not own or manage).
- No fully unsupervised "high-risk" actions (e.g., deleting content, large bulk changes) in v1 — these always require manual approval.

---

## 2a. Language & Market Strategy

**Principle:** The AI generation layer (Claude) is natively multi-language — it can already produce strong content in English, Urdu, Roman Urdu, Spanish, French, German, and most major world languages without extra engineering work. The real barriers to a multi-language, multi-region product are **not** language generation — they are per-market SEO behavior, established competitors, and compliance overhead. The strategy below is designed around that reality: build the architecture multi-language-ready from day one, but launch and prove the product in a focused, underserved market first.

### Why "everywhere at once" is the wrong launch strategy
- Search ranking behavior differs by region (Google.com vs. Google.de vs. Google.fr have different competition, keyword difficulty, and local search patterns) — supporting a language properly means supporting its market, not just translating text.
- The English/European/American SEO-and-marketing-automation space already has large, well-funded, established players (e.g., Surfer SEO, Hootsuite, FlowHunt, Jasper, Albert AI). Competing there directly from day one, as an early-stage product, is a losing position.
- Each new region adds compliance and operational overhead (e.g., GDPR in Europe, region-specific payment/tax handling), which a small/solo team cannot absorb across many markets simultaneously.
- A small team trying to be "good everywhere" from the start typically ends up polished nowhere. Focus produces a better product faster.

### The chosen approach: build multi-language-ready, launch focused, expand later

**Phase A — Architecture (do this now, regardless of launch market):**
- Design the database schema, content-generation prompts, and UI text with i18n (internationalization) in mind from the start — language should be a configuration/data value, never hardcoded into logic.
- Structure Claude prompts so that "target language" and "target region" are parameters, not assumptions baked into the code.
- This means adding a new language later is a config/content task, not a rebuild.

**Phase B — Launch market (v1 target):** English + Urdu/Roman Urdu, focused on Pakistani and South-Asian small businesses and creators. This is the underserved niche identified in Section 1 — large global players are not focused here, pricing expectations are different (affordability matters more), and the founder already has direct market access and understanding (e.g., through the KSTS project and its audience).

**Phase C — Proven traction, then expand:** Once the product has real users, feedback, and revenue in the initial market, expand language/region support in order of clearest opportunity — e.g., other South Asian languages/markets first (lower competition, similar dynamics), then consider European/American markets only once the product is mature enough to compete with established players there, likely as a differentiated offering (e.g., pricing, niche vertical, or specific underserved segment within that market) rather than a head-on generalist competitor.

**What this means concretely for the build:**
- v1 ships with English and Urdu/Roman Urdu content generation and UI.
- Every content-generation tool call includes a language/locale parameter from day one (even though only 2 are offered at launch), so expansion is additive.
- Marketing/positioning for v1 explicitly targets the Pakistani/South Asian market rather than claiming global/universal readiness prematurely.

---

## 2b. Platform Priority Strategy

**Principle:** Rather than spreading effort thinly across every possible integration (Instagram, LinkedIn, X, etc.) at once, v1 concentrates on the three channels with the strongest, most durable marketing impact: **Website SEO, YouTube, and Facebook.** All other platforms are deferred to a later phase.

**Priority order and rationale:**

1. **Website SEO (highest priority — the foundation).** The website is the compounding, owned asset — a well-optimized page keeps generating traffic for years, unlike a social post that fades in days. Traffic driven from YouTube/Facebook converts poorly if the website itself is not SEO-sound (meta tags, content structure, page quality). All other channels ultimately point back here, so this must be solid first.
2. **YouTube (second priority).** YouTube functions as the world's second-largest search engine (after Google), so it behaves more like an extension of SEO than like a typical "social" channel. Video content also surfaces directly in Google search results, meaning website SEO and YouTube reinforce each other. It also provides durable, evergreen discoverability rather than a short content lifespan.
3. **Facebook (third priority).** Facebook remains the most widely used platform in Pakistan and similar markets, especially for local businesses and community groups, and offers stronger organic local reach than Instagram/LinkedIn/X in this market.

**Deferred for later phases:** Instagram, LinkedIn, X (Twitter), and other platforms are not part of the v1 integration set. They can be added in a later phase once the core three channels are proven, without requiring architectural changes (the publish-adapter pattern in Section 5.2 supports adding new platform adapters incrementally).

**Each connection is independent — no "must have all three" requirement.** This priority order determines which adapters get *built first*, not what a user is required to *connect*. The platform must work fully and give advanced-level SEO/marketing value to a user who connects only one channel (e.g., only a YouTube channel, or only a Facebook page, with no website at all) just as well as it does for a user who connects all three. Concretely:
- Onboarding must not force a user to connect a website before they can use YouTube or Facebook features, or vice versa — each connection is optional and independent.
- The SEO Analysis Engine (Section 4.2), Content Generation Engine (Section 4.3), and Publishing Layer (Section 4.5) must all be designed so each platform's features work standalone. A YouTube-only user gets full YouTube SEO/content/publishing support; a Facebook-only user gets full Facebook support; a user with all three gets all three working together (e.g., cross-promotion suggestions) as a bonus, not a requirement.
- The dashboard (Section 4.7) should adapt to show only the relevant sections for whichever accounts a given user has actually connected.

**Concrete impact on the build:**
- Section 4.2 (SEO Analysis Engine) and Section 4.5 (Publishing/Action Layer) should implement the Website SEO adapter first, YouTube Data API adapter second, and Meta Graph API (Facebook) adapter third — this is the build sequence for the engineering team, not a restriction on what end users must connect.
- Phase 3 of the roadmap (Section 6) is updated to reflect this order explicitly (see below) instead of leaving the first integration open-ended.

---

## 3. User Roles & Permission Model

| Role | Description |
|---|---|
| **Owner/Admin** | Connects accounts, sets permission levels, approves/rejects actions, views analytics |
| **Team member** (future) | Can view drafts and suggest edits, cannot approve/publish |
| **The AI Agent** | Operates strictly within the permissions granted; every action is logged |

### Permission granularity (per connected account, per action type)
For each connected platform, the owner sets one of three modes per action category:

1. **Off** — Agent will not perform or suggest this action.
2. **Suggest only** — Agent drafts the action (e.g., a post, a meta tag change) and it sits in a queue for manual approval.
3. **Auto-execute** — Agent performs the action immediately, and logs it (recommended only for low-risk categories, e.g., alt-text updates).

### Action risk tiers
- **Low risk** (safe to auto-execute once trusted): meta description edits, image alt text, hashtag suggestions, draft generation.
- **Medium risk** (suggest-only by default): publishing a new social post, publishing a new blog post, updating a page title.
- **High risk** (always requires manual approval, never auto-execute in v1): deleting content, bulk edits across many pages/posts, changing site structure/navigation, spending ad budget.

---

## 4. Core Feature Modules

### 4.1 Onboarding & Account Connection
- OAuth-based connections, built in priority order (see Section 2b): (1) Website/CMS — WordPress REST API or a generic "custom website" mode via API key for custom-built sites (like Next.js apps), plus Google Search Console; (2) YouTube Data API; (3) Facebook (Meta Graph API). Instagram, LinkedIn, and X are deferred to a later phase. **Each connection is fully optional and independent — a user may connect just one (e.g., only YouTube, with no website) and still get complete, advanced-level SEO/marketing functionality for that one channel; nothing requires connecting all three.**

**Website connection: developer vs. non-developer users (built, with a documented gap).** The website connection has two fundamentally different paths, and the product must serve both:
- **No-code path (for non-developer site owners — the majority of small-business users):** the platform builder's own credential system, requiring zero code on the user's part. **Built:** WordPress (Application Password from `/wp-admin`) and **Shopify** (Admin API access token from a custom app created in the store's own admin, no code) — Shopify was prioritized next after WordPress since it's the dominant no-code platform for small e-commerce businesses in the target market. **Not yet built:** Wix, Squarespace, Webflow, each following the same no-code pattern (that platform's own "Connect"/OAuth screen).
- **Code path (for developer-maintained/custom-built sites, like KSTS):** the generic "custom website" webhook mode (Section 5.2's custom-site adapter) — the site's own developer adds one small receiver endpoint, one time, and the site owner then just pastes a URL + API key into AutoSEO (no ongoing code work). This path is not self-serve for a non-technical owner of a bespoke site; it requires that site's original developer, the same way installing Google Analytics or a payment gateway on a fully custom site requires a developer. This is not an AutoSEO-specific limitation — no third-party tool can safely integrate with arbitrary custom code without either a supported platform API or a developer-added integration point.

**Practical implication:** a non-developer subscriber whose site is *not* on WordPress or a supported no-code platform, and who has no ongoing developer relationship, currently has no self-serve way to connect their website for updates — only for the SEO Analyzer (which just needs the public URL, no connection required) and manual copy-paste of generated fixes. This should be treated as a real product gap to close via more no-code platform adapters, not something to route around with source-code/repo access (which would be a security regression — see Section 4.5's endpoint-based access principle).

- Business profile intake: industry/niche, target audience, brand voice/tone, target languages (e.g., Urdu, English, Roman Urdu), competitor URLs.
- Permission setup wizard (per platform, per action type — see Section 3).

### 4.2 SEO Analysis Engine
- Website crawler: fetches pages, extracts title tags, meta descriptions, heading structure (H1–H6), image alt text, internal linking, page load indicators.
- Keyword research: given a niche/topic, Claude generates a keyword list with search-intent categorization (informational, transactional, navigational).
- Competitor gap analysis: compare user's content coverage vs. competitor URLs provided.
- Technical SEO checklist: broken links, missing meta tags, duplicate titles, missing alt text, sitemap/robots.txt presence.
- Google Search Console integration (optional): pull real ranking/click data if connected, to prioritize which pages need work most.

### 4.3 Content Generation Engine (Claude-powered)
- **Website content:** SEO-optimized blog posts/articles/landing page copy, generated from a topic + target keywords + brand voice.
- **Social captions:** Platform-specific tone and length (e.g., LinkedIn = professional/longer, Instagram = casual/short + hashtags, YouTube = description + timestamps + tags).
- **Meta content:** Title tags, meta descriptions, image alt text — generated and offered as one-click-apply suggestions.
- **Multi-language support:** Content can be generated in English, Urdu, or Roman Urdu depending on the connected business's audience.
- **Content calendar suggestions:** Claude proposes a posting schedule and topic mix based on niche and past performance data (once available).

### 4.4 AI Image Generation
- Integrate an image generation API (e.g., a diffusion-model provider) for social post visuals, blog header images, and thumbnails.
- Claude writes the image prompt based on the content/context; the image API renders it.
- User can regenerate, edit the prompt, or upload their own image instead.

### 4.5 Publishing / Action Layer
- Platform-specific "publish adapters" — one per integration (WordPress adapter, Instagram adapter, YouTube adapter, etc.) that translate an approved draft into the actual API call to publish/update.
- **Approval queue UI:** every "suggest only" item appears here with a preview (before/after for edits, full preview for new posts) and Approve / Edit / Reject buttons.
- **Auto-execute path:** for items marked auto-execute, the action fires immediately but still creates a log entry and appears in a "recent AI actions" feed the owner can review/undo.
- **Undo/rollback:** where the platform API supports it (e.g., meta tag edits, draft posts), store the previous value so an action can be reverted.

**Architecture principle — endpoint-based access, not source-code access (built):** When AutoSEO needs to actually fix an issue on an *existing* live page (not just create new content), the right design for a multi-tenant product is for the connected site to expose a small, owner-controlled update endpoint — never for AutoSEO to have the site's source code, database credentials, or hosting/repo access. Concretely: the custom-site adapter (Section 5.2) sends an `"update_seo_fields"` action (title, meta description, suggested headings, schema.org JSON-LD) to the site's own receiver endpoint; the site owner's own code decides exactly how that gets applied, and the owner can revoke the API key at any time to cut off access instantly. This keeps the product usable by other subscribers who won't want to expose their whole site/codebase to a third-party tool — it also means AutoSEO is never a single point of security failure for a user's entire site. (Separately, using an AI coding agent with direct repo access to hand-implement structural site changes — e.g. Claude Code against a specific user's own GitHub repo — is a legitimate but *different* workflow: it's a one-off development task for that one site, not something the AutoSEO product does at runtime for arbitrary connected users.) For WordPress, the equivalent is the REST API's own update endpoints (post lookup by slug, then a PUT) — title/excerpt update reliably; meta-description/schema fields are plugin-specific (Yoast/RankMath) and are surfaced to the user to apply manually rather than guessed at.

### 4.6 Marketing Automation
- A/B suggestion mode: generate 2 variants of a caption/title, track which performs better once analytics are connected, and bias future generations toward what works.
- Trend monitoring: use web search to surface relevant trending topics/hashtags in the user's niche, and suggest content ideas from them.
- Performance reporting: weekly/monthly digest — what was published, engagement/ranking changes, and recommended next actions.

### 4.7 Dashboard & Analytics
- Overview of connected accounts and their health (SEO score, recent activity).
- Approval queue (pending suggestions).
- Activity log / audit trail (all actions, who/what approved them, timestamps).
- Basic analytics: traffic/engagement trends where the connected platform's API provides this data.

### 4.8 YouTube Advanced Features (TubeBuddy/VidIQ-style)

**Context:** TubeBuddy and vidIQ are the two dominant standalone YouTube SEO/growth tools. Since YouTube is a Phase 4 priority channel (Section 2b), this platform should match and exceed their core feature set — with the added advantage that this platform can also *generate and publish* content directly (via Claude + the YouTube Data API adapter), not just analyze/suggest like TubeBuddy/vidIQ do.

**Features confirmed feasible (build these in Phase 4, alongside the core YouTube adapter):**
- **Keyword research for video topics** — Claude + web search surfaces relevant, realistically-rankable keywords for the channel's niche (not just high-volume terms dominated by large channels).
- **SEO Studio equivalent** — one-click optimization of a video's title, description, and tags for an already-published video (via YouTube Data API update calls), matching TubeBuddy's "SEO Studio."
- **Tag suggestions** — Claude generates relevant tag sets per video/topic.
- **A/B testing for titles and thumbnails** — generate variant titles/thumbnails, publish as a test, track CTR/watch-time via YouTube Analytics API, and surface the winner (matches TubeBuddy's differentiator; vidIQ lacks native A/B testing).
- **Bulk processing** — update descriptions, tags, and CTAs across the whole back catalog in one batch operation (respecting the permission model in Section 3 — bulk changes are a "high risk" action category and require manual approval, per Section 3's risk tiers).
- **Channel audit** — use YouTube Analytics API data to flag underperforming videos worth revisiting/updating.

**Features that are NOT reliably feasible (do not promise these to users):**
- **Exact search-rank tracking** ("your video ranks #3 for keyword X") — YouTube's official public API does not expose search ranking position data. TubeBuddy/vidIQ approximate this through scraping/estimation methods that are unofficial and can break or violate platform terms. This platform should not attempt rank-position scraping; if rank-tracking is offered, it must be clearly labeled as an estimate, not exact data.
- **Deep competitor channel analytics** — only public data (subscriber count, view count, upload frequency) is accessible via the official API; detailed internal analytics of other channels is not obtainable and should not be implied.

**Positioning takeaway:** Market this as "TubeBuddy/vidIQ-level YouTube optimization, plus AI content generation and auto-publishing in one platform" — the differentiation is doing, not just analyzing.

---

## 5. Technical Architecture

### 5.1 High-level flow
```
User Dashboard (Next.js frontend)
        │
        ▼
Backend API (Next.js API routes / Node.js)
        │
        ├──► Claude API (tool-use / function calling) — the "brain":
        │      decides what analysis to run or what content to generate,
        │      and which tool/action to invoke
        │
        ├──► Action Tools Layer (one module per capability):
        │      - Website crawler / SEO analyzer
        │      - Content generator (calls Claude for text)
        │      - Image generator (calls image API)
        │      - Publish adapters (WordPress API, Meta Graph API,
        │        YouTube Data API, LinkedIn API, custom site API)
        │
        ├──► Database (accounts, permissions, content queue,
        │      action logs, analytics cache)
        │
        └──► Queue / Scheduler (cron jobs or a job queue like BullMQ)
               for scheduled posts and rate-limited/batched actions
```

### 5.2 Suggested stack
- **Frontend:** Next.js + React + Tailwind CSS
- **Backend:** Next.js API routes or a separate Node.js/Express service
- **AI:** Claude API with tool-use (function calling) — Claude is given a defined set of "tools" (e.g., `analyze_seo`, `generate_post`, `generate_image`, `publish_to_platform`) and decides when to call them based on the user's goals and permissions
- **Database:** PostgreSQL (relational — good fit for multi-tenant account/permission/log data)
- **Queue:** BullMQ (Redis-backed) for scheduled/rate-limited actions
- **Auth:** OAuth 2.0 for each third-party platform; a standard auth provider (e.g., NextAuth) for the platform's own user accounts
- **Image generation:** any available image-generation API

### 5.3 Data model (key entities)
- `User` (owner/admin account on the platform)
- `ConnectedAccount` (platform type, OAuth tokens, status)
- `PermissionSetting` (per ConnectedAccount, per action category → Off / Suggest / Auto)
- `ContentDraft` (type, platform, content body, image ref, status: pending/approved/rejected/published)
- `ActionLog` (what was done, when, by whom/what, before/after values, reversible flag)
- `BusinessProfile` (niche, tone, audience, languages, competitors)
- `AnalyticsSnapshot` (periodic pulled metrics per connected account)

### 5.4 Security & compliance requirements
- All OAuth tokens encrypted at rest.
- Rate-limiting and API quota handling per platform (respect each platform's API limits — e.g., Meta, YouTube quotas).
- Full audit log retained for all AI-initiated actions (non-deletable, for accountability).
- Clear disclosure to end-users of connected accounts that content may be AI-generated (per platform policies, some require AI-content labeling — this should be checked per platform at build time).
- Data isolation between tenants (one client's data/content must never be visible to another).

---

## 6. Phased Build Roadmap

### Phase 1 — Content Generation Only (no publishing)
- Business profile intake
- Claude-powered content generator: blog posts, social captions, meta tags
- AI image generation
- Output: user can generate and copy/download content — no auto-posting yet
- **Goal:** validate the content quality and prompt/tooling setup before adding platform integrations

### Phase 2 — SEO Analyzer
- Website crawler + technical SEO checklist
- Keyword research module
- Competitor gap analysis
- Dashboard showing SEO score and prioritized fix list

### Phase 3 — First Publishing Integration (Website SEO)
- Build the Website/CMS publish adapter first (WordPress REST API and/or custom site API), per the priority in Section 2b
- Build the approval queue UI
- Implement "suggest only" mode end-to-end (draft → review → approve → publish) for on-page SEO changes and published content

### Phase 4 — YouTube + Facebook Integration + Permission System
- Add the YouTube Data API adapter (titles, descriptions, tags, video metadata)
- Add the Meta Graph API (Facebook) adapter (posts, page content)
- Full permission model (Off / Suggest / Auto per action type) across all three channels
- Activity log / audit trail UI
- Undo/rollback for supported actions
- Instagram, LinkedIn, and X integrations remain deferred beyond this phase (see Section 2b)

### Phase 4.5 — Analytics Pillar (built — closes the gap noted in Section 1a)
- Connected-account dashboard: pulls real performance data — YouTube channel
  and per-video stats (views/likes/comments) via YouTube Data API v3, Facebook
  Page follower count and per-post engagement via the Meta Graph API.
- SEO score history stored per URL (every analyzer run, not just the latest),
  with trend (▲/▼) shown against the previous check.
- Channel audit: flags YouTube videos and Facebook posts performing well
  below the channel's own average, as a starting point for "worth revisiting."
- **Not yet included (documented for a later pass):** deeper YouTube Analytics
  API metrics (watch time, CTR, audience retention — needs an extra OAuth
  scope beyond Phase 4's), Meta Page Insights API metrics (reach/impressions
  beyond raw engagement counts), and Google Search Console integration
  (website impressions/clicks/position — needs its own OAuth scope and site
  verification). These are the next Analytics-pillar increments, not part of
  this pass.

### Phase 5 — Advanced Automation (built)
- **Trend monitoring** (built): Claude's server-side web_search tool surfaces
  5 genuinely current content ideas per niche, rather than relying on static
  training knowledge.
- **A/B testing** (built, partially): `generateVariants()` produces two
  distinct title options per topic. Automatic winner-selection based on
  Phase 4.5 performance data (views/engagement) is not yet wired up — the
  user currently compares manually via the Analytics tab.
- **Content calendar and scheduling** (built, with a scope caveat): plan
  topic + channel + date; a "Run Due Items Now" action processes everything
  due through the existing generation → permission-check → publish pipeline.
  There is **no real background cron/scheduler** in this build — "due" items
  only get processed when that action is triggered (manually, or by a real
  cron job hitting the same API route in a production deployment). True
  automatic, unattended scheduling is a deployment-infrastructure addition,
  not a code change.
- **Performance reports** (built): `generateReport()` turns the Analytics
  tab's raw data into a short, readable digest on demand. Automatic
  weekly/monthly delivery (e.g., via email) is not yet built — reports are
  generated on request, not sent on a schedule.

---

## 7. Success Metrics (for the product itself)
- Time saved per user per week on SEO/content tasks (self-reported or estimated)
- % of AI-suggested actions approved without edits (quality proxy)
- SEO score improvement over time per connected website
- Engagement metrics improvement on connected social accounts
- Platform retention / active connected-account count

---

## 8. Open Decisions (to resolve before/during build)
- Final product name and branding
- Subscription tier structure and pricing (confirmed model: subscription-based; tiers, price points, and free/trial policy still to be defined)
- Which image-generation provider to use
- Which platforms to prioritize for Phase 3 (based on target user research)
- Legal/compliance review for AI-content disclosure requirements per platform and per target market (e.g., Pakistan-specific regulations, if any)
- Timing/trigger for expanding beyond the Phase B launch languages (English + Urdu/Roman Urdu) — see Section 2a

---

*End of document. This is a living document — update it as decisions in Section 8 are resolved and as scope evolves during development.*
