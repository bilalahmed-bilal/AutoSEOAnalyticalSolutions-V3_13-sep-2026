"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { loadCurrentUser, signOut } from "@/lib/auth/browser";
import AuthScreen from "@/app/auth/AuthScreen";
import AutomationWorkflowPanel from "@/app/automation/AutomationWorkflowPanel";
import StrategistTab from "@/app/StrategistTab";
import OperatingSystemTab from "@/app/os/OperatingSystemTab";
import DashboardPanel from "@/app/dashboard/DashboardPanel";
import ConnectionsPanel from "@/app/connections/ConnectionsPanel";
import SubscriptionPanel from "@/app/billing/SubscriptionPanel";
import WebsiteOverviewPanel from "@/app/website/WebsiteOverviewPanel";
import { productBrand } from "@/lib/product/brand";
import type { BusinessProfile, Channel, GeneratedContent, Language, SeoAnalysis, SeoFixes } from "@/lib/claude";
import type { CrawlResult } from "@/lib/seo-crawler";
import { errorMessage, scheduleMount, type UnknownRecord } from "@/lib/unknown";
import LanguageSelector from "@/app/i18n/LanguageSelector";
import ThemeToggle from "@/app/theme/ThemeToggle";
import AppShell from "@/components/shell/AppShell";
import { Alert, AiBadge, Badge, EmptyState, Skeleton } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, MetricCard, PageHeader, SectionHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ChoiceChip, ScoreMark, Sparkline } from "@/components/ui/Visual";
import { CONTENT_LANGUAGES, DEFAULT_CONTENT_LANGUAGE } from "@/lib/i18n/content-language";
import type { Tab } from "@/lib/ui/nav";

const CHANNELS: { id: Channel; label: string; note: string }[] = [
  { id: "website", label: "Website", note: "Blog/page content + meta description" },
  { id: "youtube", label: "YouTube", note: "Title + description + tags" },
  { id: "facebook", label: "Facebook", note: "Post + hashtags" },
];

const CONTENT_LANGUAGE_OPTIONS = CONTENT_LANGUAGES;

export default function HomePage() {
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const [user, setUser] = useState<UnknownRecord | null>(
    supabaseConfigured ? null : { id: "local-demo-user", email: "local@autoseo.dev" }
  );
  const [ready, setReady] = useState(!supabaseConfigured);

  // Local/demo mode: if Supabase isn't configured (NEXT_PUBLIC_SUPABASE_URL
  // missing), skip the login screen entirely and use a stand-in local user —
  // this restores the "local single-user demo works without auth" behavior
  // documented for AUTOSEO_AUTH_REQUIRED=false. Once Supabase is configured
  // and login is actually set up, this branch stops applying automatically.

  useEffect(() => {
    if (!supabaseConfigured) return;
    let mounted = true;
    loadCurrentUser()
      .then((u) => {
        if (mounted) {
          setUser(u);
          setReady(true);
        }
      })
      .catch(() => {
        if (mounted) setReady(true);
      });
    const onAuth = () =>
      loadCurrentUser().then((u) => {
        if (mounted) setUser(u);
      });
    window.addEventListener("autoseo-auth-change", onAuth);
    return () => {
      mounted = false;
      window.removeEventListener("autoseo-auth-change", onAuth);
    };
  }, [supabaseConfigured]);

  if (!ready)
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-10 text-center text-sm text-muted">
        {productBrand.productName} is loading…
      </main>
    );
  if (supabaseConfigured && !user) {
    return (
      <main className="min-h-screen bg-bg px-6 py-16">
        <AuthScreen onAuthenticated={() => loadCurrentUser().then(setUser)} />
      </main>
    );
  }
  return (
    <AuthenticatedDashboard
      user={user}
      onSignOut={supabaseConfigured ? () => signOut().then(() => setUser(null)) : () => {}}
    />
  );
}

function AuthenticatedDashboard({ user, onSignOut }: { user: UnknownRecord; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const userLabel = user?.id === "local-demo-user" ? "Local demo mode" : String(user?.email || "Signed in");

  return (
    <AppShell
      tab={tab}
      onSelect={setTab}
      userLabel={userLabel}
      onSignOut={user?.id === "local-demo-user" ? undefined : onSignOut}
      showAdmin
    >
      {tab === "dashboard" && <DashboardPanel onNavigate={setTab} />}
      {tab === "websiteOverview" && <WebsiteOverviewPanel onNavigate={setTab} />}
      {tab === "connections" && <ConnectionsPanel />}
      {tab === "subscription" && <SubscriptionPanel />}
      {tab === "generate" && <ContentGeneratorTab />}
      {tab === "analyze" && <SeoAnalyzerTab />}
      {tab === "publish" && <PublishTab />}
      {tab === "analytics" && <AnalyticsTab />}
      {tab === "keywords" && <KeywordResearchTab />}
      {tab === "competitors" && <CompetitorIntelligenceTab />}
      {tab === "strategy" && <ContentStrategyTab />}
      {tab === "studio" && <ContentStudioTab />}
      {tab === "quality" && <ContentQualityTab />}
      {tab === "technical" && <TechnicalSeoTab />}
      {tab === "architecture" && <SiteArchitectureTab />}
      {tab === "local" && <LocalSeoTab />}
      {tab === "experiments" && <ExperimentsTab />}
      {tab === "monitoring" && <MonitoringTab />}
      {tab === "advancedAnalytics" && <AdvancedAnalyticsTab />}
      {tab === "ytPerformanceIntelligence" && <YouTubePerformanceIntelligenceTab />}
      {tab === "strategist" && <StrategistTab />}
      {tab === "operatingSystem" && <OperatingSystemTab />}
      {tab === "automation" && <AutomationTab />}
      {tab === "system" && <SystemTab />}
      {tab === "ytKeywordResearch" && <YtKeywordResearchTab />}
      {tab === "ytSeoStudio" && <YtSeoStudioTab />}
      {tab === "ytTagGenerator" && <YtTagGeneratorTab />}
      {tab === "ytChannelAudit" && <YtChannelAuditTab />}
      {tab === "ytThumbnailAB" && <YtThumbnailABTab />}
      {tab === "ytBulkOptimizer" && <YtBulkOptimizerTab />}
      {tab === "ytCommunityPosts" && <YtCommunityPostsTab />}
      {tab === "ytPerformanceAnalytics" && <YtPerformanceAnalyticsTab />}
      {tab === "ytCompetitorTracking" && <YtCompetitorTrackingTab />}
      {tab === "ytRetentionInsights" && <YtRetentionInsightsTab />}
      {tab === "fbPageSeo" && <FbPageSeoTab />}
      {tab === "fbHashtagResearch" && <FbHashtagResearchTab />}
      {tab === "fbPostAB" && <FbPostABTab />}
      {tab === "fbBulkScheduler" && <FbBulkSchedulerTab />}
      {tab === "fbEngagementAssistant" && <FbEngagementAssistantTab />}
      {tab === "fbPostAnalytics" && <FbPostAnalyticsTab />}
      {tab === "fbCompetitorTracking" && <FbCompetitorTrackingTab />}
      {tab === "fbAudienceInsights" && <FbAudienceInsightsTab />}
      {tab === "websiteBuilder" && (
        <ComingSoonPanel
          icon="globe"
          eyebrow="Website"
          title="Create your own website"
          description="Build a conversion-ready website inside AIBISORA, then connect it to the same SEO and marketing workflow."
          detail="Website creation is on the roadmap. The current release focuses on helping you analyze and grow websites you already manage."
        />
      )}
      {tab === "instagram" && (
        <ComingSoonPanel
          icon="instagram"
          eyebrow="Instagram"
          title="Instagram tools are coming soon"
          description="AIBISORA is preparing a focused Instagram workflow for content, optimization, publishing, and performance."
          detail="This channel is visible now so you can see where Instagram will fit into your AIBISORA workspace. Nothing is claimed as live yet."
        />
      )}
      {tab === "whatsappMarketing" && (
        <ComingSoonPanel
          icon="whatsapp"
          eyebrow="WhatsApp"
          title="WhatsApp marketing is coming soon"
          description="A dedicated WhatsApp marketing and automation workspace is planned for campaigns, broadcasts, AI replies, and measurement."
          detail="Future WhatsApp capabilities will be introduced here as they are implemented and verified."
          bullets={[
            "Marketing campaigns",
            "Campaigns and broadcasts",
            "Automation workflows",
            "AI replies",
            "Analytics",
          ]}
        />
      )}
      {tab === "whatsappCampaigns" && (
        <ComingSoonPanel
          icon="whatsapp"
          eyebrow="WhatsApp"
          title="Campaigns are coming soon"
          description="Plan and manage WhatsApp campaigns from one focused workspace."
        />
      )}
      {tab === "whatsappAutomation" && (
        <ComingSoonPanel
          icon="whatsapp"
          eyebrow="WhatsApp"
          title="Automation is coming soon"
          description="Build approval-aware WhatsApp automation workflows when this channel is ready."
        />
      )}
      {tab === "whatsappAiReplies" && (
        <ComingSoonPanel
          icon="whatsapp"
          eyebrow="WhatsApp"
          title="AI replies are coming soon"
          description="Draft smarter WhatsApp replies with AIBISORA AI when this capability is released."
        />
      )}
      {tab === "whatsappBroadcasts" && (
        <ComingSoonPanel
          icon="whatsapp"
          eyebrow="WhatsApp"
          title="Broadcasts are coming soon"
          description="Manage future WhatsApp broadcasts from the AIBISORA workspace."
        />
      )}
      {tab === "whatsappAnalytics" && (
        <ComingSoonPanel
          icon="whatsapp"
          eyebrow="WhatsApp"
          title="WhatsApp analytics are coming soon"
          description="Measure campaign and messaging performance when the WhatsApp channel is live."
        />
      )}
    </AppShell>
  );
}

function ComingSoonPanel({
  icon,
  eyebrow,
  title,
  description,
  detail,
  bullets,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  eyebrow: string;
  title: string;
  description: string;
  detail?: string;
  bullets?: string[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Card className="overflow-hidden">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[color-mix(in_srgb,var(--nx-primary)_25%,var(--nx-border))] bg-[color-mix(in_srgb,var(--nx-primary)_10%,transparent)] text-primary">
                <Icon name={icon} className="h-5 w-5" />
              </span>
              <Badge tone="warning">Coming Soon</Badge>
            </div>
            {detail ? (
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--nx-text-secondary)]">{detail}</p>
            ) : null}
            {bullets?.length ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {bullets.map((bullet) => (
                  <div
                    key={bullet}
                    className="flex items-center gap-2 rounded-[12px] border border-line bg-elevated px-3 py-2.5 text-sm text-ink"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                    {bullet}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="rounded-[20px] border border-[color-mix(in_srgb,var(--nx-primary)_20%,var(--nx-border))] bg-[color-mix(in_srgb,var(--nx-primary)_6%,var(--nx-surface))] p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--nx-primary)_30%,var(--nx-border))] bg-[color-mix(in_srgb,var(--nx-primary)_12%,transparent)] text-primary">
              <Icon name={icon} className="h-7 w-7" />
            </div>
            <p className="mt-4 text-sm font-semibold text-ink">Built into the roadmap</p>
            <p className="mt-1 text-xs leading-5 text-[var(--nx-text-secondary)]">
              We will enable this channel only after the underlying workflow is implemented and verified.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------
// YouTube advanced tools — full implementations (Section 4.8)
// ---------------------------------------------------------------------

function YtKeywordResearchTab() {
  const [niche, setNiche] = useState("");
  const [language, setLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [ideas, setIdeas] = useState<{ keyword: string; intent: string; competitionNote: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setIdeas([]);
    try {
      const res = await apiFetch("/api/youtube-tools/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIdeas(data.keywords || []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">YouTube Keyword Research</h2>
      <p className="mt-1 text-sm text-ink/60">
        Suggest realistically rankable keywords from current YouTube search trends.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="e.g. bus ticket booking"
          className="focus-ring flex-1 border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
        />
        <button
          onClick={handleSearch}
          disabled={!niche.trim() || loading}
          className="focus-ring border-2 border-ink bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
        >
          {loading ? "…" : "Get keywords"}
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        {CONTENT_LANGUAGE_OPTIONS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLanguage(l.id)}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              language === l.id ? "border-signal bg-signal/20 text-ink" : "border-line bg-white text-ink"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {ideas.length > 0 && (
        <div className="mt-4 space-y-2">
          {ideas.map((idea, i) => (
            <div key={i} className="border border-line bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">{idea.keyword}</p>
                <span className="border border-line px-1.5 py-0.5 text-[10px] uppercase text-ink/50">
                  {idea.intent}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/60">{idea.competitionNote}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function YtSeoStudioTab() {
  const [videoId, setVideoId] = useState("");
  const [niche, setNiche] = useState("");
  const [language, setLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [existing, setExisting] = useState<UnknownRecord | null>(null);
  const [fix, setFix] = useState<{ title: string; description: string; tags: string[]; rationale: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueMsg, setQueueMsg] = useState<string | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setExisting(null);
    setFix(null);
    setQueueMsg(null);
    try {
      const res = await apiFetch("/api/youtube-tools/seo-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, niche, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExisting(data.existing);
      setFix(data.fix);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  async function sendForApproval() {
    if (!fix) return;
    setQueueLoading(true);
    setQueueMsg(null);
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "youtube",
          kind: "new_content",
          title: fix.title,
          body: fix.description,
          metaDescription: fix.tags.join(", "),
          videoId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQueueMsg(data.autoPublished ? "Auto-published. Check the Publish tab." : "Sent to the approval queue.");
    } catch (e: unknown) {
      setQueueMsg(errorMessage(e, "Something went wrong."));
    } finally {
      setQueueLoading(false);
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Video SEO Studio</h2>
      <p className="mt-1 text-sm text-ink/60">
        Generate a stronger title, description, and tags from the current video metadata.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Video ID" value={videoId} onChange={setVideoId} placeholder="dQw4w9WgXcQ" />
        <Field label="Niche" value={niche} onChange={setNiche} placeholder="Bus ticket booking" />
      </div>
      <div className="mt-3 flex gap-2">
        {CONTENT_LANGUAGE_OPTIONS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLanguage(l.id)}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              language === l.id ? "border-signal bg-signal/20 text-ink" : "border-line bg-white text-ink"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button
        onClick={handleGenerate}
        disabled={!videoId.trim() || !niche.trim() || loading}
        className="focus-ring mt-4 w-full border-2 border-ink bg-signal py-2.5 font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate fixes"}
      </button>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}

      {existing && fix && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="border border-line bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-ink/40">Current</p>
            <p className="mt-1 font-medium text-ink">{existing.title}</p>
            <p className="mt-2 text-sm text-ink/60">{existing.viewCount} views</p>
          </div>
          <div className="border-2 border-ink bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-clay">Improved</p>
            <p className="mt-1 font-medium text-ink">{fix.title}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink/70">{fix.description}</p>
            <p className="mt-2 text-xs text-ink/50">Tags: {fix.tags.join(", ")}</p>
          </div>
          <p className="text-sm text-ink/60 sm:col-span-2">{fix.rationale}</p>
          <button
            onClick={sendForApproval}
            disabled={queueLoading}
            className="focus-ring border-2 border-ink bg-paper py-2.5 font-medium text-ink transition hover:bg-ink hover:text-paper disabled:opacity-50 sm:col-span-2"
          >
            {queueLoading ? "…" : "Send for approval"}
          </button>
          {queueMsg && <p className="text-sm text-ink/70 sm:col-span-2">{queueMsg}</p>}
        </div>
      )}
    </section>
  );
}

function YtTagGeneratorTab() {
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setTags([]);
    try {
      const res = await apiFetch("/api/youtube-tools/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTags(data.tags || []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Tag Generator</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Video topic"
          className="focus-ring flex-1 border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
        />
        <button
          onClick={handleGenerate}
          disabled={!topic.trim() || loading}
          className="focus-ring border-2 border-ink bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
        >
          {loading ? "…" : "Generate tags"}
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        {CONTENT_LANGUAGE_OPTIONS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLanguage(l.id)}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              language === l.id ? "border-signal bg-signal/20 text-ink" : "border-line bg-white text-ink"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {tags.length > 0 && (
        <div className="mt-4 border border-line bg-white p-4">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, i) => (
              <span key={i} className="border border-line bg-paper px-2 py-1 text-xs text-ink">
                {t}
              </span>
            ))}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(tags.join(", "))}
            className="focus-ring mt-3 border border-line bg-white px-3 py-1.5 text-xs text-ink/70 hover:border-ink"
          >
            Copy All
          </button>
        </div>
      )}
    </section>
  );
}

function YtChannelAuditTab() {
  const [videos, setVideos] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/youtube-tools/videos")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setVideos(data.videos || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const underperforming = videos.filter((v) => v.underperforming);

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Channel Audit</h2>
      <p className="mt-1 text-sm text-ink/60">
        Videos performing well below the channel average — consider optimizing them in Video SEO Studio.
      </p>
      {loading && <p className="mt-4 text-sm text-ink/50">Loading…</p>}
      {error && <p className="mt-4 text-sm text-clay">{error}</p>}
      {!loading && !error && underperforming.length === 0 && videos.length > 0 && (
        <p className="mt-4 text-sm text-ink/50">No videos are significantly below the channel average — a good sign.</p>
      )}
      {underperforming.length > 0 && (
        <div className="mt-4 space-y-2">
          {underperforming.map((v) => (
            <div key={v.videoId} className="border border-clay bg-clay/5 p-3">
              <p className="text-sm font-medium text-ink">{v.title}</p>
              <p className="mt-1 text-xs text-ink/60">
                {v.viewCount} views · {v.likeCount} likes
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function YtThumbnailABTab() {
  const [topic, setTopic] = useState("");
  const [videoId, setVideoId] = useState("");
  const [profile, setProfile] = useState<BusinessProfile>({ businessName: "", niche: "", audience: "", tone: "" });
  const [language, setLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [variants, setVariants] = useState<{ variantA: { title: string }; variantB: { title: string } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setVariants(null);
    try {
      const res = await apiFetch("/api/youtube-tools/thumbnail-ab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, profile, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVariants(data.variants);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  async function applyVariant(title: string) {
    if (!videoId.trim()) {
      setMsg("Enter a Video ID to apply this change.");
      return;
    }
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "youtube", kind: "new_content", title, body: title, videoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg("Sent to the approval queue.");
    } catch (e: unknown) {
      setMsg(errorMessage(e, "Something went wrong."));
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Thumbnail & Title A/B Testing</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label="Business Name"
          value={profile.businessName}
          onChange={(v) => setProfile({ ...profile, businessName: v })}
        />
        <Field label="Niche" value={profile.niche} onChange={(v) => setProfile({ ...profile, niche: v })} />
        <Field label="Topic" value={topic} onChange={setTopic} />
        <Field label="Video ID (optional, required to apply)" value={videoId} onChange={setVideoId} />
      </div>
      <div className="mt-3 flex gap-2">
        {CONTENT_LANGUAGE_OPTIONS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLanguage(l.id)}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              language === l.id ? "border-signal bg-signal/20 text-ink" : "border-line bg-white text-ink"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button
        onClick={handleGenerate}
        disabled={!topic.trim() || !profile.businessName.trim() || loading}
        className="focus-ring mt-4 w-full border-2 border-ink bg-signal py-2.5 font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
      >
        {loading ? "…" : "Generate 2 variants"}
      </button>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {variants && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border border-line bg-white p-4">
            <p className="text-xs uppercase text-ink/40">Variant A</p>
            <p className="mt-1 font-medium text-ink">{variants.variantA.title}</p>
            <button
              onClick={() => applyVariant(variants.variantA.title)}
              className="focus-ring mt-2 border border-line px-3 py-1 text-xs text-ink/70 hover:border-ink"
            >
              Apply
            </button>
          </div>
          <div className="border border-line bg-white p-4">
            <p className="text-xs uppercase text-ink/40">Variant B</p>
            <p className="mt-1 font-medium text-ink">{variants.variantB.title}</p>
            <button
              onClick={() => applyVariant(variants.variantB.title)}
              className="focus-ring mt-2 border border-line px-3 py-1 text-xs text-ink/70 hover:border-ink"
            >
              Apply
            </button>
          </div>
          {msg && <p className="text-sm text-ink/70 sm:col-span-2">{msg}</p>}
        </div>
      )}
    </section>
  );
}

function YtBulkOptimizerTab() {
  const [videos, setVideos] = useState<UnknownRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UnknownRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/youtube-tools/videos")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setVideos(data.videos || []);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleOptimize() {
    setBusy(true);
    setResults([]);
    try {
      const res = await apiFetch("/api/youtube-tools/bulk-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds: Array.from(selected), niche }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results || []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Bulk Video Optimizer</h2>
      <p className="mt-1 text-sm text-ink/60">
        Select multiple videos to generate titles, descriptions, and tags together. They will be sent to the Approval
        Queue (bulk changes always require manual approval).
      </p>
      <div className="mt-3">
        <Field label="Niche" value={niche} onChange={setNiche} placeholder="Bus ticket booking" />
      </div>
      {loading && <p className="mt-3 text-sm text-ink/50">Loading videos…</p>}
      {error && <p className="mt-3 text-sm text-clay">{error}</p>}
      {videos.length > 0 && (
        <div className="mt-4 max-h-72 space-y-1.5 overflow-y-auto border border-line bg-white p-2">
          {videos.map((v) => (
            <label key={v.videoId} className="flex items-center gap-2 border-b border-line/50 px-2 py-1.5 text-sm">
              <input type="checkbox" checked={selected.has(v.videoId)} onChange={() => toggle(v.videoId)} />
              <span className="flex-1 text-ink">{v.title}</span>
              <span className="text-xs text-ink/40">{v.viewCount} views</span>
            </label>
          ))}
        </div>
      )}
      <button
        onClick={handleOptimize}
        disabled={selected.size === 0 || !niche.trim() || busy}
        className="focus-ring mt-4 w-full border-2 border-ink bg-signal py-2.5 font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
      >
        {busy ? "…" : `${selected.size} videos to optimize`}
      </button>
      {results.length > 0 && (
        <div className="mt-4 space-y-1">
          {results.map((r, i) => (
            <p key={i} className={`text-sm ${r.status === "queued" ? "text-ink/70" : "text-clay"}`}>
              {r.videoId}: {r.status === "queued" ? "Queued" : r.error}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function YtCommunityPostsTab() {
  const [topic, setTopic] = useState("");
  const [profile, setProfile] = useState<BusinessProfile>({ businessName: "", niche: "", audience: "", tone: "" });
  const [language, setLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [post, setPost] = useState<{ text: string; postType: string; pollOptions?: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setPost(null);
    try {
      const res = await apiFetch("/api/youtube-tools/community-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, profile, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPost(data.post);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Community Post Generator</h2>
      <p className="mt-1 text-sm text-ink/60">
        YouTube has no public API for Community posts. This generates text only — copy it into YouTube Studio to
        publish.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label="Channel Name"
          value={profile.businessName}
          onChange={(v) => setProfile({ ...profile, businessName: v })}
        />
        <Field label="Niche" value={profile.niche} onChange={(v) => setProfile({ ...profile, niche: v })} />
        <Field label="Topic" value={topic} onChange={setTopic} />
      </div>
      <div className="mt-3 flex gap-2">
        {CONTENT_LANGUAGE_OPTIONS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLanguage(l.id)}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              language === l.id ? "border-signal bg-signal/20 text-ink" : "border-line bg-white text-ink"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button
        onClick={handleGenerate}
        disabled={!topic.trim() || !profile.businessName.trim() || loading}
        className="focus-ring mt-4 w-full border-2 border-ink bg-signal py-2.5 font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
      >
        {loading ? "…" : "Create post"}
      </button>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {post && (
        <div className="mt-4 border border-line bg-white p-4">
          <span className="border border-line px-1.5 py-0.5 text-[10px] uppercase text-ink/50">{post.postType}</span>
          <p className="mt-2 text-ink">{post.text}</p>
          {post.pollOptions && (
            <ul className="mt-2 list-inside list-disc text-sm text-ink/70">
              {post.pollOptions.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function YtPerformanceAnalyticsTab() {
  const [videos, setVideos] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/youtube-tools/videos")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setVideos((data.videos || []).sort((a: UnknownRecord, b: UnknownRecord) => b.viewCount - a.viewCount));
      })
      .finally(() => setLoading(false));
  }, []);

  const totalViews = videos.reduce((s, v) => s + v.viewCount, 0);
  const avgViews = videos.length ? Math.round(totalViews / videos.length) : 0;

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Video Performance Analytics</h2>
      {loading && <p className="mt-3 text-sm text-ink/50">Loading…</p>}
      {error && <p className="mt-3 text-sm text-clay">{error}</p>}
      {videos.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatBox label="Total Views (top 25)" value={totalViews} />
            <StatBox label="Average Views" value={avgViews} />
          </div>
          <div className="mt-4 space-y-1.5">
            {videos.map((v) => (
              <div
                key={v.videoId}
                className={`flex items-center justify-between border p-2.5 text-sm ${
                  v.underperforming ? "border-clay bg-clay/5" : "border-line bg-white"
                }`}
              >
                <span className="flex-1 truncate text-ink">{v.title}</span>
                <span className="text-xs text-ink/50">
                  {v.viewCount} views · {v.likeCount} likes · {v.commentCount} comments
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function YtCompetitorTrackingTab() {
  const [input, setInput] = useState("");
  const [channels, setChannels] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/youtube-tools/competitors");
      const data = await res.json();
      if (data.error) setError(data.error);
      else setChannels(data.channels || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(
    () =>
      scheduleMount(() => {
        void load();
      }),
    []
  );

  async function handleAdd() {
    if (!input.trim()) return;
    setBusy(true);
    try {
      await apiFetch("/api/youtube-tools/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelIdOrHandle: input.trim() }),
      });
      setInput("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    await apiFetch("/api/youtube-tools/competitors", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Competitor Channel Tracking</h2>
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="@channelhandle ya Channel ID (UC...)"
          className="focus-ring flex-1 border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim() || busy}
          className="focus-ring border-2 border-ink bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {loading && <p className="mt-3 text-sm text-ink/50">Loading…</p>}
      {channels.length > 0 && (
        <div className="mt-4 space-y-2">
          {channels.map((c) => (
            <div key={c.id} className="flex items-center justify-between border border-line bg-white p-3">
              {c.error ? (
                <p className="text-sm text-clay">
                  {c.channelId}: {c.error}
                </p>
              ) : (
                <div>
                  <p className="font-medium text-ink">{c.title}</p>
                  <p className="text-xs text-ink/50">
                    {c.subscriberCount.toLocaleString()} subs · {c.videoCount} videos · {c.viewCount.toLocaleString()}{" "}
                    views
                  </p>
                </div>
              )}
              <button onClick={() => handleRemove(c.id)} className="text-xs text-clay hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function YtRetentionInsightsTab() {
  const [videoId, setVideoId] = useState("");
  const [insights, setInsights] = useState<{
    averageViewDurationSeconds: number;
    averageViewPercentage: number;
    estimatedMinutesWatched: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setLoading(true);
    setError(null);
    setInsights(null);
    try {
      const res = await apiFetch("/api/youtube-tools/retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInsights(data.insights);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Watch Time & Retention Insights</h2>
      <p className="mt-1 text-sm text-ink/60">
        Uses the YouTube Analytics API. If the connection was authorized without Analytics read permission, reconnect is
        required. AIBISORA does not invent watch-time data.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          placeholder="Video ID"
          className="focus-ring flex-1 border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
        />
        <button
          onClick={handleFetch}
          disabled={!videoId.trim() || loading}
          className="focus-ring border-2 border-ink bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
        >
          {loading ? "…" : "Fetch"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {insights && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatBox label="Avg View Duration (sec)" value={Math.round(insights.averageViewDurationSeconds)} />
          <StatBox label="Avg View %" value={Math.round(insights.averageViewPercentage)} />
          <StatBox label="Minutes Watched" value={Math.round(insights.estimatedMinutesWatched)} />
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Facebook advanced tools — full implementations (mirrors YouTube's pattern)
// ---------------------------------------------------------------------

function FbPageSeoTab() {
  const [niche, setNiche] = useState("");
  const [language, setLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [info, setInfo] = useState<UnknownRecord | null>(null);
  const [fix, setFix] = useState<{ about: string; rationale: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setFix(null);
    setMsg(null);
    try {
      const res = await fetch("/api/facebook-tools/page-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInfo(data.info);
      setFix(data.fix);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  async function applyFix() {
    if (!fix) return;
    setApplying(true);
    setMsg(null);
    try {
      const res = await fetch("/api/facebook-tools/page-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, about: fix.about }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg("Page About info updated.");
    } catch (e: unknown) {
      setMsg(errorMessage(e, "Something went wrong."));
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Page & Post Discovery Optimization</h2>
      <p className="mt-1 text-sm text-ink/60">
        Fetches the Page&apos;s current About info and generates a stronger version for Facebook and Google discovery.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="Niche"
          className="focus-ring flex-1 border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
        />
        <button
          onClick={handleGenerate}
          disabled={!niche.trim() || loading}
          className="focus-ring border-2 border-ink bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
        >
          {loading ? "…" : "Generate fixes"}
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        {CONTENT_LANGUAGE_OPTIONS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLanguage(l.id)}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              language === l.id ? "border-signal bg-signal/20 text-ink" : "border-line bg-white text-ink"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {info && fix && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border border-line bg-white p-4">
            <p className="text-xs uppercase text-ink/40">Current About</p>
            <p className="mt-1 text-sm text-ink">{info.about || "(khali)"}</p>
          </div>
          <div className="border-2 border-ink bg-white p-4">
            <p className="text-xs uppercase text-clay">Improved About</p>
            <p className="mt-1 text-sm text-ink">{fix.about}</p>
          </div>
          <p className="text-sm text-ink/60 sm:col-span-2">{fix.rationale}</p>
          <button
            onClick={applyFix}
            disabled={applying}
            className="focus-ring border-2 border-ink bg-paper py-2.5 font-medium text-ink transition hover:bg-ink hover:text-paper disabled:opacity-50 sm:col-span-2"
          >
            {applying ? "…" : "Apply to page"}
          </button>
          {msg && <p className="text-sm text-ink/70 sm:col-span-2">{msg}</p>}
        </div>
      )}
    </section>
  );
}

function FbHashtagResearchTab() {
  const [niche, setNiche] = useState("");
  const [language, setLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [ideas, setIdeas] = useState<{ hashtag: string; whyRelevant: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setIdeas([]);
    try {
      const res = await fetch("/api/facebook-tools/hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIdeas(data.hashtags || []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Hashtag & Keyword Research</h2>
      <div className="mt-4 flex gap-2">
        <input
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="Niche"
          className="focus-ring flex-1 border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
        />
        <button
          onClick={handleSearch}
          disabled={!niche.trim() || loading}
          className="focus-ring border-2 border-ink bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
        >
          {loading ? "…" : "Get hashtags"}
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        {CONTENT_LANGUAGE_OPTIONS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLanguage(l.id)}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              language === l.id ? "border-signal bg-signal/20 text-ink" : "border-line bg-white text-ink"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {ideas.length > 0 && (
        <div className="mt-4 space-y-2">
          {ideas.map((idea, i) => (
            <div key={i} className="border border-line bg-white p-3">
              <p className="font-medium text-ink">#{idea.hashtag.replace(/^#/, "")}</p>
              <p className="mt-1 text-sm text-ink/60">{idea.whyRelevant}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FbPostABTab() {
  const [topic, setTopic] = useState("");
  const [profile, setProfile] = useState<BusinessProfile>({ businessName: "", niche: "", audience: "", tone: "" });
  const [language, setLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [variants, setVariants] = useState<{ variantA: { title: string }; variantB: { title: string } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setVariants(null);
    try {
      const res = await fetch("/api/facebook-tools/post-ab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, profile, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVariants(data.variants);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  async function sendVariant(text: string) {
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "facebook", kind: "new_content", title: text, body: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(data.autoPublished ? "Auto-published." : "Sent to the approval queue.");
    } catch (e: unknown) {
      setMsg(errorMessage(e, "Something went wrong."));
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Post A/B Testing</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label="Business Name"
          value={profile.businessName}
          onChange={(v) => setProfile({ ...profile, businessName: v })}
        />
        <Field label="Niche" value={profile.niche} onChange={(v) => setProfile({ ...profile, niche: v })} />
        <Field label="Topic" value={topic} onChange={setTopic} />
      </div>
      <div className="mt-3 flex gap-2">
        {CONTENT_LANGUAGE_OPTIONS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLanguage(l.id)}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              language === l.id ? "border-signal bg-signal/20 text-ink" : "border-line bg-white text-ink"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button
        onClick={handleGenerate}
        disabled={!topic.trim() || !profile.businessName.trim() || loading}
        className="focus-ring mt-4 w-full border-2 border-ink bg-signal py-2.5 font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
      >
        {loading ? "…" : "Generate 2 variants"}
      </button>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {variants && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border border-line bg-white p-4">
            <p className="text-xs uppercase text-ink/40">Variant A</p>
            <p className="mt-1 text-ink">{variants.variantA.title}</p>
            <button
              onClick={() => sendVariant(variants.variantA.title)}
              className="focus-ring mt-2 border border-line px-3 py-1 text-xs text-ink/70 hover:border-ink"
            >
              Send
            </button>
          </div>
          <div className="border border-line bg-white p-4">
            <p className="text-xs uppercase text-ink/40">Variant B</p>
            <p className="mt-1 text-ink">{variants.variantB.title}</p>
            <button
              onClick={() => sendVariant(variants.variantB.title)}
              className="focus-ring mt-2 border border-line px-3 py-1 text-xs text-ink/70 hover:border-ink"
            >
              Send
            </button>
          </div>
          {msg && <p className="text-sm text-ink/70 sm:col-span-2">{msg}</p>}
        </div>
      )}
    </section>
  );
}

function FbBulkSchedulerTab() {
  const [topicsText, setTopicsText] = useState("");
  const [profile, setProfile] = useState<BusinessProfile>({ businessName: "", niche: "", audience: "", tone: "" });
  const [language, setLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UnknownRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    const topics = topicsText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    if (topics.length === 0) return;
    setBusy(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch("/api/facebook-tools/bulk-scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics, profile, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results || []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Bulk Post Scheduler</h2>
      <p className="mt-1 text-sm text-ink/60">
        Enter one topic per line (max 10). Posts will be generated and sent to the Approval Queue (bulk changes always
        require manual approval).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label="Business Name"
          value={profile.businessName}
          onChange={(v) => setProfile({ ...profile, businessName: v })}
        />
        <Field label="Niche" value={profile.niche} onChange={(v) => setProfile({ ...profile, niche: v })} />
      </div>
      <textarea
        value={topicsText}
        onChange={(e) => setTopicsText(e.target.value)}
        placeholder={"Topic 1\nTopic 2\nTopic 3"}
        rows={5}
        className="focus-ring mt-3 w-full border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
      />
      <div className="mt-3 flex gap-2">
        {CONTENT_LANGUAGE_OPTIONS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLanguage(l.id)}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              language === l.id ? "border-signal bg-signal/20 text-ink" : "border-line bg-white text-ink"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button
        onClick={handleGenerate}
        disabled={!topicsText.trim() || !profile.businessName.trim() || busy}
        className="focus-ring mt-4 w-full border-2 border-ink bg-signal py-2.5 font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
      >
        {busy ? "…" : "Generate all"}
      </button>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {results.length > 0 && (
        <div className="mt-4 space-y-1">
          {results.map((r, i) => (
            <p key={i} className={`text-sm ${r.status === "queued" ? "text-ink/70" : "text-clay"}`}>
              {r.topic}: {r.status === "queued" ? "Queued" : r.error}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function FbEngagementAssistantTab() {
  const [postId, setPostId] = useState("");
  const [profile, setProfile] = useState<BusinessProfile>({ businessName: "", niche: "", audience: "", tone: "" });
  const [language] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [comments, setComments] = useState<UnknownRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  async function fetchComments() {
    setLoading(true);
    setError(null);
    setComments([]);
    try {
      const res = await fetch("/api/facebook-tools/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch", postId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setComments(data.comments || []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  async function draftReply(commentId: string, message: string) {
    try {
      const res = await fetch("/api/facebook-tools/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft", message, profile, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDrafts({ ...drafts, [commentId]: data.reply });
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    }
  }

  async function sendReply(commentId: string) {
    try {
      const res = await fetch("/api/facebook-tools/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", commentId, message: drafts[commentId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSentIds(new Set([...sentIds, commentId]));
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Comment & Engagement Assistant</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Post ID" value={postId} onChange={setPostId} />
        <Field
          label="Business Name"
          value={profile.businessName}
          onChange={(v) => setProfile({ ...profile, businessName: v })}
        />
        <Field label="Niche" value={profile.niche} onChange={(v) => setProfile({ ...profile, niche: v })} />
        <Field label="Tone" value={profile.tone} onChange={(v) => setProfile({ ...profile, tone: v })} />
      </div>
      <button
        onClick={fetchComments}
        disabled={!postId.trim() || loading}
        className="focus-ring mt-4 w-full border-2 border-ink bg-signal py-2.5 font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
      >
        {loading ? "…" : "Load comments"}
      </button>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {comments.length > 0 && (
        <div className="mt-4 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="border border-line bg-white p-3">
              <p className="text-xs text-ink/50">{c.from}</p>
              <p className="mt-1 text-sm text-ink">{c.message}</p>
              {drafts[c.id] ? (
                <div className="mt-2 border-t border-line pt-2">
                  <p className="text-xs uppercase text-clay">Suggested Reply</p>
                  <p className="mt-1 text-sm text-ink">{drafts[c.id]}</p>
                  {!sentIds.has(c.id) ? (
                    <button
                      onClick={() => sendReply(c.id)}
                      className="focus-ring mt-2 border border-line px-3 py-1 text-xs text-ink/70 hover:border-ink"
                    >
                      Send reply
                    </button>
                  ) : (
                    <p className="mt-2 text-xs text-ink/50">✓ Bhej diya</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => draftReply(c.id, c.message)}
                  className="focus-ring mt-2 border border-line px-3 py-1 text-xs text-ink/70 hover:border-ink"
                >
                  Draft reply
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FbPostAnalyticsTab() {
  const [pageStats, setPageStats] = useState<UnknownRecord | null>(null);
  const [posts, setPosts] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/facebook-tools/posts")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setPageStats(data.pageStats);
          setPosts(data.posts || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Post Performance Analytics</h2>
      {loading && <p className="mt-3 text-sm text-ink/50">Loading…</p>}
      {error && <p className="mt-3 text-sm text-clay">{error}</p>}
      {pageStats && (
        <div className="mt-4">
          <StatBox label="Page Followers" value={pageStats.fanCount} />
        </div>
      )}
      {posts.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {posts.map((p) => (
            <div
              key={p.postId}
              className={`border p-2.5 text-sm ${p.underperforming ? "border-clay bg-clay/5" : "border-line bg-white"}`}
            >
              <p className="line-clamp-1 text-ink">{p.message}</p>
              <p className="mt-1 text-xs text-ink/50">
                {p.likeCount} likes · {p.commentCount} comments · {p.shareCount} shares
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FbCompetitorTrackingTab() {
  const [input, setInput] = useState("");
  const [pages, setPages] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/facebook-tools/competitors");
      const data = await res.json();
      if (data.error) setError(data.error);
      else setPages(data.pages || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(
    () =>
      scheduleMount(() => {
        void load();
      }),
    []
  );

  async function handleAdd() {
    if (!input.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/facebook-tools/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageIdOrUsername: input.trim() }),
      });
      setInput("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    await fetch("/api/facebook-tools/competitors", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Competitor Page Tracking</h2>
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Page ID ya username"
          className="focus-ring flex-1 border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim() || busy}
          className="focus-ring border-2 border-ink bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      {loading && <p className="mt-3 text-sm text-ink/50">Loading…</p>}
      {pages.length > 0 && (
        <div className="mt-4 space-y-2">
          {pages.map((p) => (
            <div key={p.id} className="flex items-center justify-between border border-line bg-white p-3">
              {p.error ? (
                <p className="text-sm text-clay">
                  {p.pageId}: {p.error}
                </p>
              ) : (
                <div>
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-ink/50">{p.fanCount.toLocaleString()} followers</p>
                </div>
              )}
              <button onClick={() => handleRemove(p.id)} className="text-xs text-clay hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FbAudienceInsightsTab() {
  const [insights, setInsights] = useState<{ breakdown: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  async function handleFetch() {
    setLoading(true);
    setError(null);
    setInsights(null);
    try {
      const res = await fetch("/api/facebook-tools/audience-insights");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInsights(data.insights);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong."));
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }

  return (
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Audience Insights</h2>
      <p className="mt-1 text-sm text-ink/60">
        Meta has heavily restricted or deprecated classic Audience Insights — this will show whatever demographic data
        is still available for this Page.
      </p>
      <button
        onClick={handleFetch}
        disabled={loading}
        className="focus-ring mt-4 w-full border-2 border-ink bg-signal py-2.5 font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
      >
        {loading ? "…" : "Fetch insights"}
      </button>
      {fetched && error && <p className="mt-3 text-sm text-clay">{error}</p>}
      {insights && (
        <div className="mt-4 border border-line bg-white p-4">
          {Object.entries(insights.breakdown).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between border-b border-line/50 py-1.5 text-sm">
              <span className="text-ink/70">{key}</span>
              <span className="font-medium text-ink">{value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Tab 1: Content Generator (Phase 1) + send-to-approval (Phase 3/4)
// ---------------------------------------------------------------------

function ContentGeneratorTab() {
  const [profile, setProfile] = useState<BusinessProfile>({
    businessName: "",
    niche: "",
    audience: "",
    tone: "",
  });
  const [channel, setChannel] = useState<Channel>("website");
  const [language, setLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [videoId, setVideoId] = useState("");
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  const profileReady = profile.businessName.trim() && profile.niche.trim() && profile.audience.trim();

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setQueueMessage(null);
    try {
      const res = await apiFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, language, topic, profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setResult(data.content);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function sendForApproval() {
    if (!result) return;
    if (channel === "youtube" && !videoId.trim()) {
      setQueueMessage("A Video ID is required for YouTube (the video you want to optimize).");
      return;
    }
    setQueueLoading(true);
    setQueueMessage(null);
    try {
      const res = await apiFetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          title: result.title,
          body: result.body,
          metaDescription: result.metaDescription || (result.hashtags ? result.hashtags.join(", ") : undefined),
          videoId: channel === "youtube" ? videoId.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add to the queue.");
      setQueueMessage(
        data.queued
          ? "Auto-publish is enabled — the draft was added to the durable queue. A worker will publish it automatically."
          : "Sent to the approval queue — open the Publish tab to approve it."
      );
    } catch (e: unknown) {
      setQueueMessage(errorMessage(e, "Something went wrong."));
    } finally {
      setQueueLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Brief, generate, review, then send for approval. Content language is separate from the English product UI."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_minmax(0,18rem)]">
        <div className="space-y-4">
          <Card>
            <SectionHeader
              title="Business / brand"
              description="Ground generation in a real profile. Facts are not invented."
            />
            <div className="grid gap-3">
              <Field
                label="Business name"
                value={profile.businessName}
                onChange={(v) => setProfile({ ...profile, businessName: v })}
                placeholder="e.g. Acme Travel Services"
              />
              <Field
                label="Industry / niche"
                value={profile.niche}
                onChange={(v) => setProfile({ ...profile, niche: v })}
                placeholder="e.g. bus ticket booking"
              />
              <Field
                label="Audience"
                value={profile.audience}
                onChange={(v) => setProfile({ ...profile, audience: v })}
                placeholder="e.g. travelers nationwide"
              />
              <Field
                label="Tone"
                value={profile.tone}
                onChange={(v) => setProfile({ ...profile, tone: v })}
                placeholder="e.g. friendly and trustworthy"
              />
            </div>
          </Card>
          <Card>
            <SectionHeader title="Output" />
            <p className="nx-label mb-2">Channel</p>
            <div className="flex flex-col gap-2">
              {CHANNELS.map((c) => (
                <ChoiceChip
                  key={c.id}
                  selected={channel === c.id}
                  onClick={() => {
                    setChannel(c.id);
                    setResult(null);
                    setQueueMessage(null);
                  }}
                >
                  <span className="font-medium">{c.label}</span>
                  <span className="mt-0.5 block text-xs opacity-70">{c.note}</span>
                </ChoiceChip>
              ))}
            </div>
            <p className="nx-label mb-2 mt-4">Content language</p>
            <div className="flex flex-wrap gap-2">
              {CONTENT_LANGUAGE_OPTIONS.map((l) => (
                <ChoiceChip key={l.id} selected={language === l.id} onClick={() => setLanguage(l.id)}>
                  {l.label}
                </ChoiceChip>
              ))}
            </div>
            <div className="mt-4">
              <Field label="Topic" value={topic} onChange={setTopic} placeholder="e.g. Weekend getaways under 100" />
            </div>
            <Button
              variant="primary"
              className="mt-5 w-full"
              onClick={handleGenerate}
              disabled={!profileReady || !topic.trim() || loading}
              loading={loading}
            >
              {loading ? "Generating…" : "Generate Content"}
            </Button>
            {error ? <Alert className="mt-3">{error}</Alert> : null}
          </Card>
        </div>

        <div className="space-y-4">
          {loading ? (
            <Card aria-busy="true" aria-label="Generating content">
              <SectionHeader title="Workspace" description="AIBISORA AI is drafting from your brief." />
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="mt-4 h-40 w-full" />
            </Card>
          ) : error && !result ? (
            <EmptyState title="Generation failed" description={error} />
          ) : result ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeader
                  title="Generated draft"
                  description={`${CHANNELS.find((c) => c.id === channel)?.label} · ${CONTENT_LANGUAGE_OPTIONS.find((l) => l.id === language)?.label}`}
                />
                <AiBadge />
              </div>
              <p className="nx-label">Title</p>
              <h3 className="nx-section-title mt-1 text-ink">{result.title}</h3>
              {result.metaDescription ? (
                <>
                  <p className="nx-label mt-4">Meta description</p>
                  <p className="mt-1 text-sm text-[var(--nx-text-secondary)]">{result.metaDescription}</p>
                </>
              ) : null}
              <p className="nx-label mt-4">Body</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{result.body}</p>
              {result.hashtags && result.hashtags.length > 0 ? (
                <>
                  <p className="nx-label mt-4">Hashtags</p>
                  <p className="mt-1 text-sm text-ink">{result.hashtags.join("  ")}</p>
                </>
              ) : null}
              <div className="mt-6 border-t border-line pt-4">
                {channel === "youtube" && (
                  <div className="mb-3">
                    <Field
                      label="Video ID (the existing video to optimize)"
                      value={videoId}
                      onChange={setVideoId}
                      placeholder="e.g. dQw4w9WgXcQ"
                    />
                    <p className="mt-1 text-xs text-muted">
                      YouTube can update title, description, and tags on an existing video. It cannot upload a new video
                      from text.
                    </p>
                  </div>
                )}
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={sendForApproval}
                  disabled={queueLoading}
                  loading={queueLoading}
                >
                  {queueLoading ? "Sending…" : "Send for approval"}
                </Button>
                {queueMessage ? <p className="mt-2 text-sm text-[var(--nx-text-secondary)]">{queueMessage}</p> : null}
              </div>
            </Card>
          ) : (
            <EmptyState
              title="No draft yet"
              description="Complete the brief, choose a channel and content language, then generate. Output stays here for review before anything is published."
            />
          )}
        </div>
        <Card className="nx-ai h-fit xl:sticky xl:top-20">
          <div className="flex items-center gap-2">
            <AiBadge />
            <h3 className="nx-card-title text-ink">Guidance</h3>
          </div>
          <p className="mt-2 text-sm text-[var(--nx-text-secondary)]">
            Generated copy is a suggestion. Send it to Publishing to approve before it goes live. Auto-publish only runs
            if that setting is already enabled.
          </p>
          <p className="mt-3 text-sm text-[var(--nx-text-secondary)]">
            Content language affects generated output only. The AIBISORA product UI stays in English.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Tab 2: SEO Analyzer (Phase 2)
// ---------------------------------------------------------------------

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-[var(--nx-danger-border)] bg-[var(--nx-danger-bg)]",
  medium: "border-[var(--nx-warning-border)] bg-[var(--nx-warning-bg)]",
  low: "border-line bg-elevated",
};

const SEVERITY_LABEL: Record<string, string> = {
  high: "Critical",
  medium: "High",
  low: "Low",
};

const SEVERITY_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

function SeoAnalyzerTab() {
  const [url, setUrl] = useState("");
  const [crawl, setCrawl] = useState<CrawlResult | null>(null);
  const [analysis, setAnalysis] = useState<SeoAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fixes, setFixes] = useState<SeoFixes | null>(null);
  const [fixesLoading, setFixesLoading] = useState(false);
  const [fixesError, setFixesError] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setCrawl(null);
    setAnalysis(null);
    setFixes(null);
    setApplyMessage(null);
    try {
      const res = await apiFetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      setCrawl(data.crawl);
      setAnalysis(data.analysis);
    } catch (e: unknown) {
      setError(errorMessage(e, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateFixes() {
    if (!crawl || !analysis) return;
    setFixesLoading(true);
    setFixesError(null);
    setFixes(null);
    try {
      const res = await apiFetch("/api/seo-fixes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crawl, analysis }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFixes(data.fixes);
    } catch (e: unknown) {
      setFixesError(errorMessage(e, "Could not generate fixes."));
    } finally {
      setFixesLoading(false);
    }
  }

  async function handleSendFixForApproval() {
    if (!fixes || !crawl) return;
    setApplyLoading(true);
    setApplyMessage(null);
    try {
      const res = await apiFetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "website",
          kind: "seo_fix",
          targetUrl: crawl.url,
          title: fixes.title,
          body: fixes.rationale,
          metaDescription: fixes.metaDescription,
          suggestedHeadings: fixes.suggestedHeadings,
          schemaJsonLd: fixes.schemaJsonLd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApplyMessage(
        data.queued
          ? "Auto-publish is enabled — the SEO fix was added to the durable queue. A worker will apply it automatically."
          : "The fix was sent to the approval queue — open the Publish tab to approve it."
      );
    } catch (e: unknown) {
      setApplyMessage(errorMessage(e, "Something went wrong."));
    } finally {
      setApplyLoading(false);
    }
  }

  const issueCounts = analysis
    ? {
        high: analysis.issues.filter((issue) => issue.severity === "high").length,
        medium: analysis.issues.filter((issue) => issue.severity === "medium").length,
        low: analysis.issues.filter((issue) => issue.severity === "low").length,
      }
    : { high: 0, medium: 0, low: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={crawl?.url}
        title="SEO"
        description="Audit a page, review prioritized issues, then generate AI suggestions. Applying changes still requires approval unless auto-publish is already enabled."
      />
      <Card>
        <SectionHeader title="Website" description="Analyze a public URL. Scoring logic is unchanged." />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. example.com"
              aria-label="Website URL"
            />
          </div>
          <Button
            variant="primary"
            className="w-full shrink-0 sm:w-auto"
            onClick={handleAnalyze}
            disabled={!url.trim() || loading}
            loading={loading}
          >
            {loading ? "Checking…" : "Run SEO Audit"}
          </Button>
        </div>
        {error ? (
          <Alert className="mt-3">
            SEO analysis couldn't be completed. {error}{" "}
            <button type="button" className="underline" onClick={handleAnalyze}>
              Retry
            </button>
          </Alert>
        ) : null}
      </Card>

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Running SEO audit">
          <Skeleton className="h-32" />
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      ) : null}

      {!loading && !analysis && !error ? (
        <EmptyState
          title="Run your first SEO audit"
          description="Enter a website URL to score on-page health and list prioritized issues. AIBISORA does not invent sample findings."
        />
      ) : null}

      {analysis ? (
        <>
          <Card>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <ScoreMark value={analysis.score} label="SEO health" />
              <p className="max-w-xl text-sm text-[var(--nx-text-secondary)]">{analysis.summary}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="danger">{issueCounts.high} critical</Badge>
              <Badge tone="warning">{issueCounts.medium} high</Badge>
              <Badge tone="neutral">{issueCounts.low} low</Badge>
              {analysis.issues.length === 0 ? <Badge tone="success">No detected issues</Badge> : null}
            </div>
          </Card>

          <div>
            <SectionHeader title="Priority issues" description="Severity is labeled in text as well as color." />
            {analysis.issues.length ? (
              <div className="space-y-3">
                {analysis.issues.map((issue, i) => (
                  <article
                    key={i}
                    className={`rounded-[var(--nx-radius-md)] border p-4 ${SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.low}`}
                  >
                    <Badge tone={SEVERITY_TONE[issue.severity] || "neutral"}>
                      {SEVERITY_LABEL[issue.severity] || issue.severity}
                    </Badge>
                    <h3 className="mt-2 text-sm font-medium text-ink">{issue.issue}</h3>
                    <p className="mt-1 text-sm text-[var(--nx-text-secondary)]">
                      <span className="font-medium text-ink">Recommended next step. </span>
                      {issue.fix}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Your current audit has no detected issues."
                description="You can still generate AI title and meta suggestions for review."
              />
            )}
          </div>

          <Card className="nx-ai">
            <div className="flex flex-wrap items-center gap-2">
              <AiBadge />
              <h2 className="nx-card-title text-ink">AI suggestions</h2>
            </div>
            <p className="mt-2 text-sm text-[var(--nx-text-secondary)]">
              Suggestions are not applied automatically. Use “Review AI suggestion”, then send for approval.
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={handleGenerateFixes}
              disabled={fixesLoading}
              loading={fixesLoading}
            >
              {fixesLoading ? "Generating…" : fixes ? "Review AI suggestion" : "Fix with AI"}
            </Button>
            {fixesError ? <Alert className="mt-3">{fixesError}</Alert> : null}

            {fixes ? (
              <div className="mt-5 space-y-3 border-t border-[var(--nx-ai-border)] pt-4">
                <p className="nx-label">Corrected title</p>
                <p className="text-sm font-medium text-ink">{fixes.title}</p>
                <p className="nx-label">Corrected meta description</p>
                <p className="text-sm text-ink">{fixes.metaDescription}</p>
                {fixes.suggestedHeadings.length > 0 ? (
                  <>
                    <p className="nx-label">Suggested H2 headings</p>
                    <ul className="list-inside list-disc text-sm text-ink">
                      {fixes.suggestedHeadings.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <p className="nx-label">Schema markup (JSON-LD)</p>
                <pre className="overflow-x-auto rounded-[var(--nx-radius-sm)] bg-elevated p-3 text-xs text-[var(--nx-text-secondary)]">
                  {fixes.schemaJsonLd}
                </pre>
                <p className="text-sm text-[var(--nx-text-secondary)]">{fixes.rationale}</p>
                <Button
                  variant="primary"
                  onClick={handleSendFixForApproval}
                  disabled={applyLoading}
                  loading={applyLoading}
                >
                  {applyLoading ? "Sending…" : "Apply after approval"}
                </Button>
                {applyMessage ? <p className="text-sm text-[var(--nx-text-secondary)]">{applyMessage}</p> : null}
                <p className="text-xs text-muted">
                  Custom sites: title, meta, headings, and schema can be applied if the receiver supports them.
                  WordPress: only title and meta are applied — copy schema and headings manually.
                </p>
              </div>
            ) : null}
          </Card>

          {crawl ? (
            <details className="text-sm text-muted">
              <summary className="cursor-pointer">View crawl details</summary>
              <pre className="mt-2 overflow-x-auto rounded-[var(--nx-radius-sm)] bg-elevated p-3 text-xs">
                {JSON.stringify(crawl, null, 2)}
              </pre>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
// Tab 3: Publish — connections (Website/YouTube/Facebook) + Approval Queue
// ---------------------------------------------------------------------

interface QueueDraft {
  id: string;
  channel: "website" | "youtube" | "facebook";
  kind?: "new_content" | "seo_fix";
  targetUrl?: string;
  title: string;
  body: string;
  metaDescription?: string;
  videoId?: string;
  status: "pending" | "approved" | "published" | "rejected" | "failed";
  createdAt: string;
  publishedUrl?: string;
  errorMessage?: string;
}

const STATUS_LABEL: Record<QueueDraft["status"], string> = {
  pending: "Pending approval",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
  failed: "Failed",
};

const STATUS_STYLE: Record<QueueDraft["status"], string> = {
  pending: "border-[var(--nx-warning-border)] bg-[var(--nx-warning-bg)] text-warning",
  approved: "border-[var(--nx-success-border)] bg-[var(--nx-success-bg)] text-success",
  published: "border-[var(--nx-success-border)] bg-[var(--nx-success-bg)] text-success",
  rejected: "border-[var(--nx-danger-border)] bg-[var(--nx-danger-bg)] text-danger",
  failed: "border-[var(--nx-danger-border)] bg-[var(--nx-danger-bg)] text-danger",
};

const CHANNEL_LABEL: Record<QueueDraft["channel"], string> = {
  website: "Website",
  youtube: "YouTube",
  facebook: "Facebook",
};

function PermissionToggle({
  value,
  onChange,
}: {
  value: "suggest" | "auto";
  onChange: (v: "suggest" | "auto") => void;
}) {
  return (
    <div className="mt-3 flex gap-2">
      <button
        onClick={() => onChange("suggest")}
        className={`focus-ring border px-3 py-1.5 text-xs transition ${
          value === "suggest" ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink/70 hover:border-ink"
        }`}
      >
        Suggest only (approval required)
      </button>
      <button
        onClick={() => onChange("auto")}
        className={`focus-ring border px-3 py-1.5 text-xs transition ${
          value === "auto" ? "border-signal bg-signal text-ink" : "border-line bg-white text-ink/70 hover:border-signal"
        }`}
      >
        Auto-publish (no approval)
      </button>
    </div>
  );
}

function PublishTab() {
  // Website
  const [websitePlatformType, setWebsitePlatformType] = useState<"wordpress" | "shopify" | "custom">("custom");
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [shopifyToken, setShopifyToken] = useState("");
  const [websiteConnected, setWebsiteConnected] = useState(false);
  const [websitePermission, setWebsitePermission] = useState<"suggest" | "auto">("suggest");
  const [websiteMsg, setWebsiteMsg] = useState<string | null>(null);
  const [websiteBusy, setWebsiteBusy] = useState(false);

  // YouTube
  const [ytAccessToken, setYtAccessToken] = useState("");
  const [ytConnected, setYtConnected] = useState(false);
  const [ytPermission, setYtPermission] = useState<"suggest" | "auto">("suggest");
  const [ytMsg, setYtMsg] = useState<string | null>(null);
  const [ytBusy, setYtBusy] = useState(false);

  // Facebook
  const [fbPageId, setFbPageId] = useState("");
  const [fbPageToken, setFbPageToken] = useState("");
  const [fbConnected, setFbConnected] = useState(false);
  const [fbPermission, setFbPermission] = useState<"suggest" | "auto">("suggest");
  const [fbMsg, setFbMsg] = useState<string | null>(null);
  const [fbBusy, setFbBusy] = useState(false);
  const [gscMsg, setGscMsg] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<QueueDraft[]>([]);
  const [actingOn, setActingOn] = useState<string | null>(null);

  async function loadSettings() {
    const res = await apiFetch("/api/settings");
    const data = await res.json();
    if (data.website?.connected) {
      setWebsiteConnected(true);
      setWebsitePlatformType(data.website.platformType);
      setWebsitePermission(data.website.permission);
      if (data.website.siteUrl) setSiteUrl(data.website.siteUrl);
      if (data.website.username) setUsername(data.website.username);
      if (data.website.webhookUrl) setWebhookUrl(data.website.webhookUrl);
      if (data.website.shopDomain) setShopDomain(data.website.shopDomain);
    }
    if (data.youtube?.connected) {
      setYtConnected(true);
      setYtPermission(data.youtube.permission);
    }
    if (data.facebook?.connected) {
      setFbConnected(true);
      setFbPermission(data.facebook.permission);
      if (data.facebook.pageId) setFbPageId(data.facebook.pageId);
    }
  }

  async function loadDrafts() {
    const res = await apiFetch("/api/queue");
    const data = await res.json();
    setDrafts(data.drafts || []);
  }

  useEffect(
    () =>
      scheduleMount(() => {
        void loadSettings();
        void loadDrafts();
        const params = new URLSearchParams(window.location.search);
        if (params.get("oauth") === "success") {
          const provider = params.get("provider") || "platform";
          setYtMsg(provider === "google-youtube" ? "YouTube OAuth connected successfully." : null);
          setFbMsg(provider === "facebook" ? "Facebook OAuth connected successfully." : null);
          setGscMsg(provider === "google-search-console" ? "Google Search Console connected successfully." : null);
          window.history.replaceState({}, "", window.location.pathname);
        } else if (params.get("oauth") === "error") {
          const message = params.get("message") || "OAuth connection failed.";
          setYtMsg(message);
          setFbMsg(message);
          setGscMsg(message);
          window.history.replaceState({}, "", window.location.pathname);
        }
      }),
    []
  );

  async function connectWebsite() {
    setWebsiteBusy(true);
    setWebsiteMsg(null);
    try {
      const payload =
        websitePlatformType === "wordpress"
          ? {
              platform: "website",
              platformType: "wordpress",
              siteUrl,
              username,
              applicationPassword,
              permission: websitePermission,
            }
          : websitePlatformType === "shopify"
            ? {
                platform: "website",
                platformType: "shopify",
                shopDomain,
                accessToken: shopifyToken,
                permission: websitePermission,
              }
            : { platform: "website", platformType: "custom", webhookUrl, apiKey, permission: websitePermission };
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWebsiteConnected(true);
      setWebsiteMsg(data.message);
    } catch (e: unknown) {
      setWebsiteConnected(false);
      setWebsiteMsg(errorMessage(e, "Could not connect."));
    } finally {
      setWebsiteBusy(false);
    }
  }

  async function connectYouTube() {
    setYtBusy(true);
    setYtMsg(null);
    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "youtube", accessToken: ytAccessToken, permission: ytPermission }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setYtConnected(true);
      setYtMsg(data.message);
    } catch (e: unknown) {
      setYtConnected(false);
      setYtMsg(errorMessage(e, "Could not connect."));
    } finally {
      setYtBusy(false);
    }
  }

  async function connectFacebook() {
    setFbBusy(true);
    setFbMsg(null);
    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "facebook",
          pageId: fbPageId,
          pageAccessToken: fbPageToken,
          permission: fbPermission,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFbConnected(true);
      setFbMsg(data.message);
    } catch (e: unknown) {
      setFbConnected(false);
      setFbMsg(errorMessage(e, "Could not connect."));
    } finally {
      setFbBusy(false);
    }
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    setActingOn(id);
    try {
      await apiFetch(`/api/queue/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await loadDrafts();
    } finally {
      setActingOn(null);
    }
  }

  return (
    <>
      {/* Website connection */}
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Website</h2>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setWebsitePlatformType("custom")}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              websitePlatformType === "custom" ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink"
            }`}
          >
            Custom site (for example Next.js)
          </button>
          <button
            onClick={() => setWebsitePlatformType("wordpress")}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              websitePlatformType === "wordpress" ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink"
            }`}
          >
            WordPress
          </button>
          <button
            onClick={() => setWebsitePlatformType("shopify")}
            className={`focus-ring border px-3 py-1.5 text-sm transition ${
              websitePlatformType === "shopify" ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink"
            }`}
          >
            Shopify
          </button>
        </div>

        {websitePlatformType === "custom" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Webhook URL"
              value={webhookUrl}
              onChange={setWebhookUrl}
              placeholder="https://example.com/api/aibisora-publish"
            />
            <SecretField label="API Key" value={apiKey} onChange={setApiKey} />
          </div>
        ) : websitePlatformType === "shopify" ? (
          <>
            <p className="mt-3 text-sm text-ink/60">
              Shopify Admin → Settings → Apps and sales channels → Develop apps → create a new app. In Admin API, enable
              the &quot;write_content&quot; scope, install it, and paste the Admin API access token here — no code
              required.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field
                label="Store Domain"
                value={shopDomain}
                onChange={setShopDomain}
                placeholder="mystore.myshopify.com"
              />
              <SecretField label="Admin API Access Token" value={shopifyToken} onChange={setShopifyToken} />
            </div>
          </>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Site URL" value={siteUrl} onChange={setSiteUrl} placeholder="example.com" />
            <Field label="Username" value={username} onChange={setUsername} placeholder="admin" />
            <div className="sm:col-span-2">
              <SecretField label="Application Password" value={applicationPassword} onChange={setApplicationPassword} />
            </div>
          </div>
        )}

        <PermissionToggle value={websitePermission} onChange={setWebsitePermission} />

        <button
          onClick={connectWebsite}
          disabled={websiteBusy}
          className="focus-ring mt-4 border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
        >
          {websiteBusy ? "Connecting…" : "Connect / Update"}
        </button>
        {websiteMsg && <p className={`mt-2 text-sm ${websiteConnected ? "text-ink/70" : "text-clay"}`}>{websiteMsg}</p>}
        {websiteConnected && !websiteMsg && <p className="mt-2 text-sm text-ink/70">✓ Connected.</p>}
      </section>

      {/* YouTube connection */}
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">YouTube</h2>
        <p className="mt-1 text-sm text-ink/60">
          Connect YouTube with the in-app Google OAuth button. AIBISORA requests YouTube Data API access (update
          metadata on existing videos) and YouTube Analytics read access (watch time and retention). Existing
          connections created before Analytics access was added must reconnect. Setup notes:{" "}
          <code className="bg-paper px-1">docs/INTEGRATIONS.md</code>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              const r = await apiFetch("/api/oauth/google-youtube");
              const d = await r.json();
              if (r.ok && d.url) window.location.href = d.url;
              else setYtMsg(d.error || "Could not start OAuth.");
            }}
            className="focus-ring border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink"
          >
            Connect with Google OAuth
          </button>
          <span className="self-center text-xs text-ink/50">Legacy/testing-only token paste:</span>
        </div>
        <div className="mt-3">
          <SecretField
            label="Access Token (legacy/testing-only — does not refresh, may lack Analytics access)"
            value={ytAccessToken}
            onChange={setYtAccessToken}
          />
        </div>
        <PermissionToggle value={ytPermission} onChange={setYtPermission} />
        <button
          onClick={connectYouTube}
          disabled={!ytAccessToken || ytBusy}
          className="focus-ring mt-4 border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ytBusy ? "Connecting…" : "Connect / Update"}
        </button>
        {ytMsg && <p className={`mt-2 text-sm ${ytConnected ? "text-ink/70" : "text-clay"}`}>{ytMsg}</p>}
        {ytConnected && !ytMsg && <p className="mt-2 text-sm text-ink/70">✓ Connected.</p>}
      </section>

      {/* Facebook connection */}
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Facebook</h2>
        <p className="mt-1 text-sm text-ink/60">
          A Page Access Token with the pages_manage_posts permission is required. You can create one in a Meta for
          Developers app — see <code className="bg-paper px-1">docs/INTEGRATIONS.md</code>.
        </p>
        <div className="mt-3">
          <button
            onClick={async () => {
              const r = await apiFetch("/api/oauth/facebook");
              const d = await r.json();
              if (r.ok && d.url) window.location.href = d.url;
              else setFbMsg(d.error || "Could not start OAuth.");
            }}
            className="focus-ring border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink"
          >
            Connect with Facebook OAuth
          </button>
          <p className="mt-2 text-xs text-ink/50">
            OAuth connects the first available Page (FIRST_PAGE_ONLY). Or use a legacy Page ID and token manually.
          </p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Page ID" value={fbPageId} onChange={setFbPageId} placeholder="1234567890" />
          <SecretField label="Page Access Token" value={fbPageToken} onChange={setFbPageToken} />
        </div>
        <PermissionToggle value={fbPermission} onChange={setFbPermission} />
        <button
          onClick={connectFacebook}
          disabled={!fbPageId || !fbPageToken || fbBusy}
          className="focus-ring mt-4 border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fbBusy ? "Connecting…" : "Connect / Update"}
        </button>
        {fbMsg && <p className={`mt-2 text-sm ${fbConnected ? "text-ink/70" : "text-clay"}`}>{fbMsg}</p>}
        {fbConnected && !fbMsg && <p className="mt-2 text-sm text-ink/70">✓ Connected.</p>}
      </section>

      {/* Google Search Console connection */}
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Google Search Console</h2>
        <p className="mt-1 text-sm text-ink/60">
          A read-only Google OAuth connection for organic clicks, impressions, CTR, and average position.
        </p>
        <button
          onClick={async () => {
            const r = await apiFetch("/api/oauth/google-search-console");
            const d = await r.json();
            if (r.ok && d.url) window.location.href = d.url;
            else setGscMsg(d.error || "Could not start OAuth.");
          }}
          className="focus-ring mt-3 border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink"
        >
          Connect with Google Search Console
        </button>
        {gscMsg && <p className="mt-2 text-sm text-ink/70">{gscMsg}</p>}
      </section>

      {/* Approval queue */}
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Approval Queue</h2>
        <p className="mt-1 text-sm text-ink/60">
          Content for channels in &quot;Suggest only&quot; mode waits here for approval. Channels with auto-publish
          enabled publish immediately (this list shows a log only).
        </p>

        {drafts.length === 0 ? (
          <p className="mt-4 text-sm text-ink/50">No drafts are in the queue yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {drafts.map((d) => (
              <div key={d.id} className="border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="mb-1 inline-block border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink/50">
                      {CHANNEL_LABEL[d.channel]}
                    </span>
                    {d.kind === "seo_fix" && (
                      <span className="mb-1 ml-2 inline-block border border-signal bg-signal/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink/70">
                        SEO Fix
                      </span>
                    )}
                    <p className="font-medium text-ink">{d.title}</p>
                    {d.kind === "seo_fix" && d.targetUrl ? (
                      <p className="mt-1 text-xs text-ink/50">Target: {d.targetUrl}</p>
                    ) : (
                      <p className="mt-1 line-clamp-2 text-sm text-ink/60">{d.body}</p>
                    )}
                  </div>
                  <span className={`shrink-0 border px-2 py-1 text-xs ${STATUS_STYLE[d.status]}`}>
                    {STATUS_LABEL[d.status]}
                  </span>
                </div>

                {d.status === "published" && d.publishedUrl && (
                  <a
                    href={d.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-clay underline"
                  >
                    View live →
                  </a>
                )}

                {d.status === "failed" && d.errorMessage && <p className="mt-2 text-sm text-clay">{d.errorMessage}</p>}

                {d.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleAction(d.id, "approve")}
                      disabled={actingOn === d.id}
                      className="focus-ring border-2 border-ink bg-signal px-4 py-1.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
                    >
                      {actingOn === d.id ? "…" : "Approve and publish"}
                    </button>
                    <button
                      onClick={() => handleAction(d.id, "reject")}
                      disabled={actingOn === d.id}
                      className="focus-ring border border-line bg-white px-4 py-1.5 text-sm text-ink/70 transition hover:border-clay hover:text-clay disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------
// Tab 4: Analytics — the third pillar (Section 1a, Phase 4.5)
// ---------------------------------------------------------------------

interface ScoreHistoryEntry {
  url: string;
  latestScore: number;
  previousScore: number | null;
  trend: number | null;
  history: { url: string; score: number; date: string }[];
}

interface YouTubeVideoAudit {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  underperforming: boolean;
}

interface FacebookPostAudit {
  postId: string;
  message: string;
  createdTime: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  underperforming: boolean;
}

interface AnalyticsData {
  website: { scoreHistory: ScoreHistoryEntry[] };
  youtube: {
    channelStats: { channelTitle: string; subscriberCount: number; viewCount: number; videoCount: number } | null;
    videos: YouTubeVideoAudit[];
  } | null;
  facebook: {
    pageStats: { pageName: string; fanCount: number } | null;
    posts: FacebookPostAudit[];
  } | null;
  searchConsole: {
    siteUrl?: string;
    clicks?: number;
    impressions?: number;
    ctr?: number;
    averagePosition?: number | null;
    rows?: number;
    periodStart?: string;
    periodEnd?: string;
    error?: string;
  } | null;
  snapshots: Array<{
    provider: string;
    period_start: string;
    period_end: string;
    metrics: { clicks?: number; impressions?: number; ctr?: number; averagePosition?: number | null };
  }>;
}

function KeywordResearchTab() {
  const [seedKeyword, setSeedKeyword] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [name, setName] = useState("");
  const [projects, setProjects] = useState<UnknownRecord[]>([]);
  const [selected, setSelected] = useState<UnknownRecord | null>(null);
  const [opportunities, setOpportunities] = useState<UnknownRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadProjects() {
    const r = await apiFetch("/api/keyword-research");
    if (r.ok) setProjects((await r.json()).projects || []);
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void loadProjects().catch(() => undefined);
      }),
    []
  );

  async function research() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch("/api/keyword-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedKeyword, targetUrl, name }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Keyword research failed.");
      setSelected(d.project);
      setOpportunities(d.opportunities || []);
      setMessage(`${d.opportunities?.length || 0} keyword opportunities generated.`);
      await loadProjects();
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Keyword research error."));
    } finally {
      setBusy(false);
    }
  }
  async function openProject(id: string) {
    const r = await apiFetch(`/api/keyword-research/${id}`);
    if (!r.ok) return;
    const d = await r.json();
    setSelected(d.project);
    setOpportunities(d.opportunities || []);
  }
  const tierClass = (tier: string) =>
    tier === "priority" ? "border-2 border-signal" : tier === "strong" ? "border border-ink" : "border border-line";
  return (
    <>
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Advanced Keyword Research</h2>
        <p className="mt-2 text-sm text-ink/60">
          Discover related, question, modifier, page, and optional Search Console queries from a seed keyword.
          Opportunity score is based on deterministic signals; fake search-volume numbers are not generated.
        </p>
        <div className="mt-5 grid gap-3">
          <input
            value={seedKeyword}
            onChange={(e) => setSeedKeyword(e.target.value)}
            placeholder="Seed keyword — e.g. bus ticket booking"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Optional target URL for on-page opportunity signals"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Research project name (optional)"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <button
            disabled={busy || !seedKeyword.trim()}
            onClick={research}
            className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
          >
            {busy ? "Researching…" : "Research keywords"}
          </button>
          {message && <p className="text-xs text-ink/60">{message}</p>}
        </div>
      </section>
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h3 className="font-head text-base font-semibold text-ink">Saved research</h3>
        <div className="mt-3 space-y-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => openProject(p.id)}
              className="block w-full border border-line bg-white px-3 py-3 text-left text-sm hover:border-ink"
            >
              <span className="font-medium">{p.name}</span>
              <span className="ml-2 text-xs text-ink/50">{p.seedKeyword}</span>
            </button>
          ))}
          {!projects.length && <p className="text-sm text-ink/50">No keyword research projects yet.</p>}
        </div>
      </section>
      {selected && (
        <section className="mt-6">
          <div className="border border-line bg-white/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-head text-base font-semibold">{selected.name}</h3>
                <p className="mt-1 text-xs text-ink/50">
                  Seed: {selected.seedKeyword} · {selected.summary?.total || opportunities.length} candidates · GSC:{" "}
                  {selected.summary?.gscConnected ? "connected" : "not connected"}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                <span className="border border-signal px-2 py-1">Priority {selected.summary?.priority ?? 0}</span>
                <span className="border border-line px-2 py-1">Strong {selected.summary?.strong ?? 0}</span>
                <span className="border border-line px-2 py-1">Watch {selected.summary?.watch ?? 0}</span>
                <span className="border border-line px-2 py-1">Low {selected.summary?.low ?? 0}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {opportunities.map((o: UnknownRecord) => (
              <div key={o.id} className={`${tierClass(o.tier)} bg-white/60 p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{o.keyword}</p>
                    <p className="mt-1 text-xs text-ink/50">
                      {o.intent} · {o.recommendedContentType} · source: {o.source}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{o.opportunityScore}</p>
                    <p className="text-[10px] uppercase text-ink/40">opportunity</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-ink/60 sm:grid-cols-4">
                  <span>Relevance {o.relevanceScore}</span>
                  <span>Difficulty {o.difficultyScore}</span>
                  <span>Content fit {o.contentFitScore}</span>
                  <span>Current signal {o.currentSignalScore}</span>
                </div>
                <p className="mt-3 text-xs text-ink/70">{o.recommendation}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function CompetitorIntelligenceTab() {
  const [targetUrl, setTargetUrl] = useState("");
  const [competitorUrls, setCompetitorUrls] = useState(["", ""]);
  const [name, setName] = useState("");
  const [projects, setProjects] = useState<UnknownRecord[]>([]);
  const [keywordProjectId, setKeywordProjectId] = useState("");
  const [selected, setSelected] = useState<UnknownRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await apiFetch("/api/keyword-research");
    if (r.ok) setProjects((await r.json()).projects || []);
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void load().catch(() => undefined);
      }),
    []
  );
  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const urls = competitorUrls.map((x) => x.trim()).filter(Boolean);
      const r = await apiFetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          targetUrl,
          competitorUrls: urls,
          keywordProjectId: keywordProjectId || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Competitor analysis failed.");
      setSelected(d.project);
      setMessage("Competitor analysis complete.");
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Competitor analysis error."));
    } finally {
      setBusy(false);
    }
  }
  const gaps = selected?.analysis?.gaps || [];
  const by = (t: string) => gaps.filter((g: UnknownRecord) => g.gapType === t);
  return (
    <>
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold">Competitor Intelligence</h2>
        <p className="mt-2 text-sm text-ink/60">
          Compare the target website against public competitor sites: keyword gaps, content gaps, and technical SEO
          opportunities. Analysis is based on bounded, SSRF-safe public crawling.
        </p>
        <div className="mt-5 grid gap-3">
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Your target URL — https://example.com"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          {competitorUrls.map((u, i) => (
            <input
              key={i}
              value={u}
              onChange={(e) => setCompetitorUrls((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Competitor URL ${i + 1} — https://competitor.com`}
              className="border border-line bg-white px-3 py-2 text-sm"
            />
          ))}
          <button
            onClick={() => setCompetitorUrls((a) => (a.length < 5 ? [...a, ""] : a))}
            disabled={competitorUrls.length >= 5}
            className="border border-line px-3 py-2 text-xs text-left disabled:opacity-40"
          >
            + Add another competitor
          </button>
          <select
            value={keywordProjectId}
            onChange={(e) => setKeywordProjectId(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Optional: V23 keyword project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.seedKeyword}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Analysis name (optional)"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <button
            disabled={busy || !targetUrl.trim() || competitorUrls.every((x) => !x.trim())}
            onClick={run}
            className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Analyzing…" : "Run competitor analysis"}
          </button>
          {message && <p className="text-xs text-ink/60">{message}</p>}
        </div>
      </section>
      {selected && (
        <section className="mt-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            {[
              ["Competitors", selected.summary.competitors],
              ["Target pages", selected.summary.targetPages],
              ["Comp pages", selected.summary.competitorPages],
              ["Keyword gaps", selected.summary.keywordGaps],
              ["Content gaps", selected.summary.contentGaps],
              ["Technical", selected.summary.technicalGaps],
            ].map(([k, v]) => (
              <div key={String(k)} className="border border-line bg-white/60 p-3 text-center">
                <div className="text-lg font-semibold">{v}</div>
                <div className="text-[10px] uppercase text-ink/40">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 border border-signal bg-white/60 p-5">
            <p className="text-xs uppercase text-ink/40">Opportunity score</p>
            <p className="text-3xl font-semibold">{selected.summary.opportunityScore}/100</p>
            <div className="mt-3 space-y-1 text-xs text-ink/70">
              {(selected.analysis.recommendations || []).map((r: string, i: number) => (
                <p key={i}>• {r}</p>
              ))}
            </div>
          </div>
          {[
            ["Keyword gaps", by("keyword")],
            ["Content gaps", by("content")],
            ["Technical gaps", by("technical")],
          ].map(([title, list]: UnknownRecord) => (
            <div key={title} className="mt-5">
              <h3 className="font-head text-base font-semibold">{title}</h3>
              <div className="mt-2 space-y-2">
                {list.slice(0, 20).map((g: UnknownRecord, i: number) => (
                  <div key={i} className="border border-line bg-white/60 p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-medium">{g.keyword || g.recommendation}</p>
                        <p className="mt-1 text-xs text-ink/50">
                          {g.severity} · competitor: {g.competitorUrl}
                        </p>
                      </div>
                      <span className="text-lg font-semibold">{g.score}</span>
                    </div>
                    <p className="mt-2 text-xs text-ink/70">{g.recommendation}</p>
                    {g.evidenceUrls?.length > 0 && (
                      <p className="mt-2 break-all text-[10px] text-ink/40">Evidence: {g.evidenceUrls.join(" · ")}</p>
                    )}
                  </div>
                ))}
                {!list.length && <p className="text-sm text-ink/50">No gaps found in this category.</p>}
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function ContentStrategyTab() {
  const [keywordProjects, setKeywordProjects] = useState<UnknownRecord[]>([]);
  const [competitorProjects, setCompetitorProjects] = useState<UnknownRecord[]>([]);
  const [keywordProjectId, setKeywordProjectId] = useState("");
  const [competitorProjectId, setCompetitorProjectId] = useState("");
  const [name, setName] = useState("");
  const [projects, setProjects] = useState<UnknownRecord[]>([]);
  const [selected, setSelected] = useState<UnknownRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const [k, c, s] = await Promise.all([
      apiFetch("/api/keyword-research"),
      apiFetch("/api/competitors"),
      apiFetch("/api/content-strategy"),
    ]);
    if (k.ok) setKeywordProjects((await k.json()).projects || []);
    if (c.ok) setCompetitorProjects((await c.json()).projects || []);
    if (s.ok) setProjects((await s.json()).projects || []);
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void load().catch(() => undefined);
      }),
    []
  );
  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch("/api/content-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, keywordProjectId, competitorProjectId: competitorProjectId || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Strategy generation failed.");
      setSelected(d.project);
      setMessage("Content strategy complete.");
      await load();
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Content strategy error."));
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    const r = await apiFetch(`/api/content-strategy/${id}`);
    if (r.ok) setSelected((await r.json()).project);
  }
  const strategy = selected?.strategy || {};
  return (
    <>
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold">Topic & Content Strategy</h2>
        <p className="mt-2 text-sm text-ink/60">
          Convert V23 keyword opportunities into structured topic clusters, pillar pages, and a supporting content plan.
          Optional V24 competitor gaps reinforce priority.
        </p>
        <div className="mt-5 grid gap-3">
          <select
            value={keywordProjectId}
            onChange={(e) => setKeywordProjectId(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select V23 keyword project</option>
            {keywordProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.seedKeyword}
              </option>
            ))}
          </select>
          <select
            value={competitorProjectId}
            onChange={(e) => setCompetitorProjectId(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Optional: V24 competitor project</option>
            {competitorProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Strategy name (optional)"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <button
            disabled={busy || !keywordProjectId}
            onClick={run}
            className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Building strategy…" : "Build content strategy"}
          </button>
          {message && <p className="text-xs text-ink/60">{message}</p>}
        </div>
      </section>
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h3 className="font-head text-base font-semibold">Saved strategies</h3>
        <div className="mt-3 space-y-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => open(p.id)}
              className="block w-full border border-line bg-white px-3 py-3 text-left text-sm hover:border-ink"
            >
              <span className="font-medium">{p.name}</span>
              <span className="ml-2 text-xs text-ink/50">
                {p.summary?.clusters || 0} clusters · {p.summary?.items || 0} items
              </span>
            </button>
          ))}
          {!projects.length && <p className="text-sm text-ink/50">No content strategy projects yet.</p>}
        </div>
      </section>
      {selected && (
        <section className="mt-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            {[
              ["Items", strategy.summary?.items],
              ["Clusters", strategy.summary?.clusters],
              ["Critical", strategy.summary?.priority],
              ["High", strategy.summary?.high],
              ["Pillars", strategy.summary?.pillarPages],
              ["Supporting", strategy.summary?.supportingPages],
            ].map(([k, v]) => (
              <div key={String(k)} className="border border-line bg-white/60 p-3 text-center">
                <div className="text-lg font-semibold">{v}</div>
                <div className="text-[10px] uppercase text-ink/40">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 border border-signal bg-white/60 p-5">
            <h3 className="font-head text-base font-semibold">Top topic clusters</h3>
            <div className="mt-3 space-y-2">
              {(strategy.clusters || []).slice(0, 10).map((c: UnknownRecord, i: number) => (
                <div key={i} className="border border-line bg-white p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="mt-1 text-xs text-ink/50">
                        Primary: {c.primaryKeyword} · {c.contentType}
                      </p>
                    </div>
                    <span className="text-lg font-semibold">{c.score}</span>
                  </div>
                  <p className="mt-2 text-xs text-ink/60">Keywords: {c.keywords.join(" · ")}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <h3 className="font-head text-base font-semibold">Recommended content plan</h3>
            <div className="mt-2 space-y-2">
              {(strategy.items || []).slice(0, 30).map((i: UnknownRecord, n: number) => (
                <div key={n} className="border border-line bg-white/60 p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium">{i.suggestedTitle}</p>
                      <p className="mt-1 text-xs text-ink/50">
                        {i.keyword} · {i.intent} · {i.contentType} · {i.priority}
                      </p>
                    </div>
                    <span className="text-lg font-semibold">{i.score}</span>
                  </div>
                  <p className="mt-2 text-xs text-ink/70">{i.rationale}</p>
                  {i.internalLinkTargets?.length > 0 && (
                    <p className="mt-2 text-[10px] text-ink/40">Link with: {i.internalLinkTargets.join(" · ")}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          {(strategy.cannibalization || []).length > 0 && (
            <div className="mt-5 border border-line bg-white/60 p-5">
              <h3 className="font-head text-base font-semibold">Cannibalization safeguards</h3>
              {strategy.cannibalization.map((x: string, i: number) => (
                <p key={i} className="mt-2 text-xs text-ink/70">
                  • {x}
                </p>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function ContentStudioTab() {
  const [strategies, setStrategies] = useState<UnknownRecord[]>([]);
  const [projects, setProjects] = useState<UnknownRecord[]>([]);
  const [strategyId, setStrategyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("AI Content Studio");
  const [businessName, setBusinessName] = useState("");
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Helpful, clear and professional");
  const [language, setLanguage] = useState<Language>("en");
  const [channel, setChannel] = useState<Channel>("website");
  const [item, setItem] = useState<UnknownRecord | null>(null);
  const [assets, setAssets] = useState<UnknownRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const [s, p] = await Promise.all([apiFetch("/api/content-strategy"), apiFetch("/api/content-studio")]);
    if (s.ok) setStrategies((await s.json()).projects || []);
    if (p.ok) setProjects((await p.json()).projects || []);
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void load().catch(() => undefined);
      }),
    []
  );
  async function openProject(id: string) {
    if (!id) return;
    const r = await apiFetch(`/api/content-studio/${id}`);
    if (r.ok) {
      const d = await r.json();
      setProjectId(id);
      setAssets(d.assets || []);
    }
  }
  async function createProject() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch("/api/content-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, strategyProjectId: strategyId || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Project create failed.");
      setProjectId(d.project.id);
      setAssets([]);
      await load();
      setMessage("Studio project is ready.");
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Project error."));
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (!projectId) {
      setMessage("Create or select a Studio project first.");
      return;
    }
    if (!item) {
      setMessage("Select a content item from Content Strategy.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch(`/api/content-studio/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          niche,
          audience,
          tone,
          language,
          channel,
          keyword: item.keyword,
          intent: item.intent,
          contentType: item.contentType,
          topic: item.topic || item.keyword,
          suggestedTitle: item.suggestedTitle,
          supportingKeywords: [item.keyword],
          internalLinkTargets: item.internalLinkTargets || [],
          strategyItem: item,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Generation failed.");
      setAssets((old) => [d.asset, ...old]);
      setMessage("AI content generated.");
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Generation error."));
    } finally {
      setBusy(false);
    }
  }
  async function queue(asset: UnknownRecord) {
    if (!asset?.result) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          title: asset.result.title,
          body: asset.result.body,
          metaDescription: asset.result.metaDescription,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Queue failed.");
      setMessage("Content sent to the approval queue.");
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Queue error."));
    } finally {
      setBusy(false);
    }
  }
  const strategy = strategies.find((x) => x.id === strategyId)?.strategy;
  const items = strategy?.items || [];
  return (
    <>
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold">AI Content Production Studio</h2>
        <p className="mt-2 text-sm text-ink/60">
          Convert a V25 strategy into production-ready content. The AI will not invent factual claims; it will flag
          missing facts.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <select
            value={strategyId}
            onChange={(e) => setStrategyId(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select V25 content strategy</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={item?.keyword || ""}
            onChange={(e) => setItem(items.find((x: UnknownRecord) => x.keyword === e.target.value) || null)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select content item</option>
            {items.map((x: UnknownRecord, i: number) => (
              <option key={i} value={x.keyword}>
                {x.suggestedTitle} — {x.priority}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Studio project name"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <select
            value={projectId}
            onChange={(e) => openProject(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select Studio project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Business name"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Industry / niche"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="Target audience"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Brand tone"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            {CONTENT_LANGUAGE_OPTIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={busy || !name.trim()}
            onClick={createProject}
            className="border border-ink px-4 py-2 text-sm"
          >
            Create Studio Project
          </button>
          <button
            disabled={busy || !projectId || !item || !businessName || !niche || !audience}
            onClick={generate}
            className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Producing…" : "Generate Production Content"}
          </button>
        </div>
        {message && <p className="mt-3 text-xs text-ink/60">{message}</p>}
      </section>
      {item && (
        <section className="mt-6 border border-signal bg-white/60 p-5">
          <p className="text-xs uppercase text-ink/40">Selected strategy item</p>
          <h3 className="mt-1 font-head text-lg font-semibold">{item.suggestedTitle}</h3>
          <p className="mt-1 text-xs text-ink/50">
            {item.keyword} · {item.intent} · {item.contentType} · score {item.score}
          </p>
          <p className="mt-3 text-sm text-ink/70">{item.rationale}</p>
        </section>
      )}
      <section className="mt-6">
        <h3 className="font-head text-base font-semibold">Generated assets</h3>
        <div className="mt-3 space-y-4">
          {assets.map((a: UnknownRecord) => (
            <div key={a.id} className="border border-line bg-white/60 p-5">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-medium">{a.result?.title || a.strategyItem?.suggestedTitle}</p>
                  <p className="mt-1 text-xs text-ink/50">
                    {a.status} · {a.strategyItem?.keyword || a.brief?.keyword}
                  </p>
                </div>
                {a.result && (
                  <button disabled={busy} onClick={() => queue(a)} className="border border-ink px-3 py-1.5 text-xs">
                    Send to Approval
                  </button>
                )}
              </div>
              {a.result && (
                <>
                  <p className="mt-3 text-xs text-ink/60">Meta: {a.result.metaDescription}</p>
                  <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap border border-line bg-white p-4 text-xs leading-5 text-ink/80">
                    {a.result.body}
                  </pre>
                  {a.result.qualityNotes?.length > 0 && (
                    <div className="mt-3 text-xs text-ink/60">Quality notes: {a.result.qualityNotes.join(" · ")}</div>
                  )}
                </>
              )}
            </div>
          ))}
          {!assets.length && (
            <p className="border border-line bg-white/60 p-5 text-sm text-ink/50">No generated assets yet.</p>
          )}
        </div>
      </section>
    </>
  );
}

function ContentQualityTab() {
  const [projects, setProjects] = useState<UnknownRecord[]>([]);
  const [projectId, setProjectId] = useState("");
  const [assets, setAssets] = useState<UnknownRecord[]>([]);
  const [assetId, setAssetId] = useState("");
  const [report, setReport] = useState<UnknownRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await apiFetch("/api/content-studio");
    if (r.ok) setProjects((await r.json()).projects || []);
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void load().catch(() => undefined);
      }),
    []
  );
  async function open(id: string) {
    setProjectId(id);
    setAssetId("");
    setReport(null);
    if (!id) {
      setAssets([]);
      return;
    }
    const r = await apiFetch(`/api/content-studio/${id}`);
    if (r.ok) setAssets((await r.json()).assets || []);
  }
  async function evaluate() {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset?.result) {
      setMessage("Select a generated asset.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const refs = assets
        .filter((a) => a.id !== assetId && a.result?.body)
        .slice(0, 5)
        .map((a) => String(a.result.body));
      const r = await apiFetch("/api/content-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          title: asset.result.title,
          body: asset.result.body,
          metaDescription: asset.result.metaDescription,
          keyword: asset.brief?.keyword || asset.strategyItem?.keyword,
          channel: asset.brief?.channel,
          language: asset.brief?.language,
          referenceTexts: refs,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Quality evaluation failed.");
      setReport(d.report);
      setMessage("Quality and factual-risk review complete.");
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Quality evaluation error."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold">Content Quality & Fact Intelligence</h2>
        <p className="mt-2 text-sm text-ink/60">
          Check V26 AI content against SEO, readability, structure, originality, and factual-risk signals before
          publishing. This is a risk detector, not a truth verifier.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <select
            value={projectId}
            onChange={(e) => open(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select AI Content Studio project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select generated asset</option>
            {assets
              .filter((a) => a.result)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.result?.title || a.strategyItem?.keyword}
                </option>
              ))}
          </select>
        </div>
        <button
          onClick={evaluate}
          disabled={busy || !assetId}
          className="mt-3 border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {busy ? "Checking…" : "Run Quality & Fact Review"}
        </button>
        {message && <p className="mt-3 text-xs text-ink/60">{message}</p>}
      </section>
      {report && (
        <section className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="border border-line bg-white/60 p-4 text-center">
              <div className="font-head text-3xl">{report.score}</div>
              <div className="text-[10px] uppercase text-ink/40">Quality score</div>
            </div>
            <div className="border border-line bg-white/60 p-4 text-center">
              <div className="font-head text-lg">{report.verdict}</div>
              <div className="text-[10px] uppercase text-ink/40">Verdict</div>
            </div>
            <div className="border border-line bg-white/60 p-4 text-center">
              <div className="font-head text-2xl">{report.metrics.words}</div>
              <div className="text-[10px] uppercase text-ink/40">Words</div>
            </div>
            <div className="border border-line bg-white/60 p-4 text-center">
              <div className="font-head text-2xl">{report.metrics.riskClaims}</div>
              <div className="text-[10px] uppercase text-ink/40">Risk claims</div>
            </div>
          </div>
          <div className="border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Factual Risk</h3>
            <p className="mt-2 text-sm">{report.factualReview.status}</p>
            <p className="mt-1 text-xs text-ink/60">{report.factualReview.note}</p>
            {report.factualReview.claims?.length > 0 && (
              <p className="mt-3 text-xs text-ink/70">Review: {report.factualReview.claims.join(" · ")}</p>
            )}
          </div>
          <div className="border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Metrics</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink/60 sm:grid-cols-4">
              <span>Avg sentence {report.metrics.avgWordsPerSentence}</span>
              <span>Headings {report.metrics.headings}</span>
              <span>Links {report.metrics.links}</span>
              <span>Keyword density {report.metrics.keywordDensity}%</span>
              <span>Keyword occurrences {report.metrics.keywordOccurrences}</span>
              <span>Reference overlap {Math.round(report.metrics.duplicateSimilarity * 100)}%</span>
            </div>
          </div>
          <div className="border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Issues</h3>
            <div className="mt-3 space-y-3">
              {report.issues?.map((x: UnknownRecord, i: number) => (
                <div key={i} className="border border-line bg-white p-3">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{x.issue}</span>
                    <span className="text-xs uppercase text-ink/50">{x.severity}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink/60">
                    {x.category} · {x.fix}
                  </p>
                  {x.evidence && <p className="mt-1 text-[10px] text-ink/40">Evidence: {x.evidence}</p>}
                </div>
              ))}
              {!report.issues?.length && <p className="text-sm text-ink/50">No issues detected.</p>}
            </div>
          </div>
          <div className="border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Strengths</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink/70">
              {report.strengths?.map((x: string, i: number) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

function TechnicalSeoTab() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState("25");
  const [audit, setAudit] = useState<UnknownRecord | null>(null);
  const [history, setHistory] = useState<UnknownRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await apiFetch("/api/technical-seo");
    if (r.ok) setHistory((await r.json()).audits || []);
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void load().catch(() => undefined);
      }),
    []
  );
  async function run() {
    if (!url.trim()) {
      setMessage("Enter a website URL.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch("/api/technical-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, maxPages: Number(maxPages) || 25 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Technical audit failed.");
      setAudit(d.audit);
      setMessage("Technical SEO audit complete.");
      load().catch(() => undefined);
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Technical SEO error."));
    } finally {
      setBusy(false);
    }
  }
  const fixes = audit?.report?.fixes || [];
  return (
    <>
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold">Technical SEO Automation</h2>
        <p className="mt-2 text-sm text-ink/60">
          Crawl a public website to identify technical SEO issues and get a prioritized, safe remediation plan. AIBISORA
          does not mutate production website files without approval.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <select
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="10">10 pages</option>
            <option value="25">25 pages</option>
            <option value="50">50 pages</option>
          </select>
          <button
            onClick={run}
            disabled={busy}
            className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Auditing…" : "Run Technical Audit"}
          </button>
        </div>
        {message && <p className="mt-3 text-xs text-ink/60">{message}</p>}
      </section>
      {audit && (
        <section className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
            {[
              ["Score", audit.score],
              ["Pages", audit.summary?.pages],
              ["Fixes", audit.summary?.fixes],
              ["Critical", audit.summary?.critical],
              ["High", audit.summary?.high],
              ["Medium", audit.summary?.medium],
              ["Broken links", audit.summary?.brokenLinks],
            ].map(([k, v]) => (
              <div key={String(k)} className="border border-line bg-white/60 p-3 text-center">
                <div className="font-head text-xl">{v}</div>
                <div className="text-[9px] uppercase text-ink/40">{k}</div>
              </div>
            ))}
          </div>
          <div className="border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Prioritized Fix Plan</h3>
            <div className="mt-3 space-y-3">
              {fixes.map((x: UnknownRecord) => (
                <div key={x.id} className="border border-line bg-white p-3">
                  <div className="flex justify-between gap-3">
                    <div>
                      <span className="font-medium">{x.issue}</span>
                      <span className="ml-2 text-[10px] uppercase text-ink/40">{x.kind}</span>
                    </div>
                    <span className="text-xs uppercase text-ink/50">{x.severity}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink/60">{x.url}</p>
                  <p className="mt-2 text-xs text-ink/70">{x.recommendation}</p>
                  <p className="mt-2 text-[10px] uppercase text-ink/40">
                    {x.autoApplicable ? "Safe candidate for assisted auto-fix" : "Manual review required"}
                  </p>
                </div>
              ))}
              {!fixes.length && <p className="text-sm text-ink/50">No technical issues detected by current rules.</p>}
            </div>
          </div>
          <div className="border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Crawl Summary</h3>
            <div className="mt-3 grid gap-2 text-xs text-ink/60 sm:grid-cols-2">
              <span>Robots.txt: {audit.report?.site?.robots?.found ? "Found" : "Not found"}</span>
              <span>Sitemap: {audit.report?.site?.sitemap?.found ? "Found" : "Not found"}</span>
              <span>Noindex pages: {audit.summary?.noindexPages}</span>
              <span>Discovered URLs: {audit.summary?.discovered}</span>
            </div>
          </div>
        </section>
      )}
      {history.length > 0 && (
        <section className="mt-6 border border-line bg-white/60 p-5">
          <h3 className="font-head font-semibold">Recent Technical Audits</h3>
          <div className="mt-3 space-y-2">
            {history.slice(0, 8).map((x: UnknownRecord) => (
              <div key={x.id} className="flex justify-between gap-3 border-b border-line py-2 text-xs">
                <span className="truncate">{x.target_url}</span>
                <span>{x.score}/100</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function LocalSeoTab() {
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [maxPages, setMaxPages] = useState("25");
  const [keywordProjectId, setKeywordProjectId] = useState("");
  const [projects, setProjects] = useState<UnknownRecord[]>([]);
  const [selected, setSelected] = useState<UnknownRecord | null>(null);
  const [keywordProjects, setKeywordProjects] = useState<UnknownRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function load() {
    const [a, b] = await Promise.all([apiFetch("/api/local-seo"), apiFetch("/api/keyword-research")]);
    if (a.ok) {
      const d = await a.json();
      setProjects(d.projects || []);
    }
    if (b.ok) {
      const d = await b.json();
      setKeywordProjects(d.projects || []);
    }
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void load().catch(() => undefined);
      }),
    []
  );
  async function open(id: string) {
    if (!id) return;
    const r = await apiFetch(`/api/local-seo/${id}`);
    if (r.ok) {
      const d = await r.json();
      setSelected(d.project);
    }
  }
  async function run() {
    if (!url.trim() || !location.trim()) {
      setMessage("Enter a website URL and target location.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch("/api/local-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          location,
          businessName,
          name,
          keywordProjectId: keywordProjectId || undefined,
          maxPages: Number(maxPages) || 25,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Local SEO analysis failed.");
      setSelected(d.project);
      setMessage("Local SEO analysis complete.");
      await load();
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Local SEO error."));
    } finally {
      setBusy(false);
    }
  }
  const a = selected?.analysis || {};
  const sum = selected?.summary || {};
  return (
    <section>
      <div className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold">Local SEO Intelligence</h2>
        <p className="mt-2 text-sm text-ink/60">
          Analyze a public website against a target location to identify local search opportunities, location signals,
          schema, and local SEO issues.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="London, United Kingdom"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Business name (optional)"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name (optional)"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <select
            value={keywordProjectId}
            onChange={(e) => setKeywordProjectId(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">No keyword project</option>
            {keywordProjects.map((p: UnknownRecord) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
            type="number"
            min="5"
            max="50"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={run}
            disabled={busy}
            className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Analyzing…" : "Analyze Local SEO"}
          </button>
          <select onChange={(e) => open(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm">
            <option value="">Open saved project</option>
            {projects.map((p: UnknownRecord) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {message && <p className="mt-3 text-xs text-ink/60">{message}</p>}
      </div>
      {selected && (
        <section className="mt-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            {[
              ["Score", sum.score + "/100"],
              ["Pages", sum.pages],
              ["Issues", sum.issues],
              ["Local keywords", sum.localKeywords],
              ["Location signals", sum.locationSignals],
              ["Schema signals", sum.schemaSignals],
            ].map(([k, v]) => (
              <div key={String(k)} className="border border-line bg-white/60 p-3 text-center">
                <div className="text-lg font-semibold">{v}</div>
                <div className="text-[10px] uppercase text-ink/40">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Local SEO Issues</h3>
            <div className="mt-3 space-y-2">
              {(a.issues || []).map((i: UnknownRecord) => (
                <div key={i.key} className="border-b border-line py-3">
                  <div className="flex justify-between gap-3">
                    <p className="text-sm font-medium">{i.title}</p>
                    <span className="text-xs font-semibold uppercase">
                      {i.severity} · {i.score}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink/60">{i.reason}</p>
                  <p className="mt-1 text-xs">Fix: {i.recommendation}</p>
                </div>
              ))}
              {!(a.issues || []).length && <p className="text-sm text-ink/50">No major local SEO issues found.</p>}
            </div>
          </div>
          <div className="mt-5 border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Local Keyword Opportunities</h3>
            <div className="mt-3 space-y-2">
              {(a.keywordOpportunities || []).slice(0, 30).map((k: UnknownRecord, i: number) => (
                <div key={i} className="flex justify-between gap-3 border-b border-line py-2">
                  <div>
                    <p className="text-sm font-medium">{k.keyword}</p>
                    <p className="text-xs text-ink/50">
                      {k.intent} · {k.reason}
                    </p>
                  </div>
                  <span className="font-semibold">{k.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="border border-line bg-white/60 p-5">
              <h3 className="font-head font-semibold">Detected Location Signals</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink/70">
                {(a.locationSignals || []).map((x: string, i: number) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="border border-line bg-white/60 p-5">
              <h3 className="font-head font-semibold">Schema Types</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink/70">
                {(a.schemaSignals || []).map((x: string, i: number) => (
                  <li key={i}>{x}</li>
                ))}
                {!(a.schemaSignals || []).length && <li>No JSON-LD types detected.</li>}
              </ul>
            </div>
          </div>
          <div className="mt-5 border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Recommendations</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink/70">
              {(a.recommendations || []).map((x: string, i: number) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </section>
  );
}

function SiteArchitectureTab() {
  const [projects, setProjects] = useState<UnknownRecord[]>([]);
  const [keywords, setKeywords] = useState<UnknownRecord[]>([]);
  const [projectId, setProjectId] = useState("");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [keywordProjectId, setKeywordProjectId] = useState("");
  const [maxPages, setMaxPages] = useState("30");
  const [selected, setSelected] = useState<UnknownRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function load() {
    const [a, b] = await Promise.all([apiFetch("/api/site-architecture"), apiFetch("/api/keyword-research")]);
    if (a.ok) {
      const d = await a.json();
      setProjects(d.projects || []);
    }
    if (b.ok) {
      const d = await b.json();
      setKeywords(d.projects || []);
    }
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void load().catch(() => undefined);
      }),
    []
  );
  async function run() {
    if (!url.trim()) {
      setMessage("Enter a website URL.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch("/api/site-architecture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          name,
          keywordProjectId: keywordProjectId || undefined,
          maxPages: Number(maxPages) || 30,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Architecture analysis failed.");
      setSelected(d.project);
      setMessage("Internal linking and site architecture analysis complete.");
      await load();
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Architecture analysis error."));
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    if (!id) return;
    const r = await apiFetch(`/api/site-architecture/${id}`);
    if (r.ok) setSelected((await r.json()).project);
  }
  const a = selected?.analysis || {};
  return (
    <>
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold">Internal Linking & Site Architecture</h2>
        <p className="mt-2 text-sm text-ink/60">
          Crawl a public website to identify orphan or weak pages, hub candidates, and contextual internal-link
          opportunities. Suggestions are reviewable; AIBISORA does not automatically mutate the live site.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name (optional)"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <select
            value={keywordProjectId}
            onChange={(e) => setKeywordProjectId(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Optional V23 keyword project</option>
            {keywords.map((k: UnknownRecord) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          <select
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="15">15 pages</option>
            <option value="30">30 pages</option>
            <option value="60">60 pages</option>
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={run}
            disabled={busy}
            className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Analyzing…" : "Analyze Architecture"}
          </button>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              open(e.target.value);
            }}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Open saved project</option>
            {projects.map((p: UnknownRecord) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {message && <p className="mt-3 text-xs text-ink/60">{message}</p>}
      </section>
      {selected && (
        <section className="mt-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
            {[
              ["Pages", selected.summary.pages],
              ["Internal links", selected.summary.internalLinks],
              ["Orphans", selected.summary.orphanPages],
              ["Opportunities", selected.summary.linkOpportunities],
              ["Hubs", selected.summary.hubPages],
              ["Weak pages", selected.summary.weakPages],
              ["Score", selected.summary.architectureScore + "/100"],
            ].map(([k, v]) => (
              <div key={String(k)} className="border border-line bg-white/60 p-3 text-center">
                <div className="text-lg font-semibold">{v}</div>
                <div className="text-[10px] uppercase text-ink/40">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Recommended Internal Links</h3>
            <div className="mt-3 space-y-2">
              {(a.opportunities || []).slice(0, 30).map((o: UnknownRecord, i: number) => (
                <div key={i} className="border-b border-line py-3">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{o.anchorSuggestion}</p>
                      <p className="mt-1 break-all text-[10px] text-ink/50">
                        {o.sourceUrl} → {o.targetUrl}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">{o.score}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink/60">
                    {o.severity} · {o.reason}
                  </p>
                </div>
              ))}
              {!(a.opportunities || []).length && (
                <p className="text-sm text-ink/50">No strong linking opportunities found.</p>
              )}
            </div>
          </div>
          <div className="mt-5 border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Architecture Recommendations</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink/70">
              {(a.recommendations || []).map((r: string, i: number) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
          {(a.orphanPages || []).length > 0 && (
            <div className="mt-5 border border-line bg-white/60 p-5">
              <h3 className="font-head font-semibold">Weakly Connected / Orphan Candidates</h3>
              <div className="mt-2 space-y-1 text-xs text-ink/60">
                {a.orphanPages.slice(0, 30).map((u: string) => (
                  <div key={u} className="break-all">
                    {u}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function ExperimentsTab() {
  const [drafts, setDrafts] = useState<UnknownRecord[]>([]);
  const [draftId, setDraftId] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [versions, setVersions] = useState<UnknownRecord[]>([]);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [experiments, setExperiments] = useState<UnknownRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [dRes, eRes] = await Promise.all([apiFetch("/api/queue"), apiFetch("/api/experiments")]);
    if (dRes.ok) setDrafts((await dRes.json()).drafts || []);
    if (eRes.ok) setExperiments((await eRes.json()).experiments || []);
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void load().catch(() => undefined);
      }),
    []
  );
  useEffect(
    () =>
      scheduleMount(() => {
        if (!draftId) {
          setVersions([]);
          return;
        }
        const draft = drafts.find((d) => d.id === draftId);
        if (draft?.targetUrl) setTargetUrl(draft.targetUrl);
        apiFetch(`/api/optimization-versions?draftId=${encodeURIComponent(draftId)}`)
          .then(async (r) => setVersions(r.ok ? (await r.json()).versions || [] : []))
          .catch(() => setVersions([]));
      }),
    [draftId, drafts]
  );

  async function create() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, targetUrl, variantAVersionId: aId, variantBVersionId: bId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Experiment create failed.");
      setMessage("Experiment created. Start Variant A now.");
      await load();
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Experiment error."));
    } finally {
      setBusy(false);
    }
  }
  async function action(id: string, action: string, body?: UnknownRecord) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch(`/api/experiments/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `${action} failed.`);
      setMessage(`${action} successful.`);
      await load();
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Action failed."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">SEO Experimentation</h2>
        <p className="mt-2 text-sm text-ink/60">
          Sequentially compare two approved optimization versions on the same URL. This is not a randomized traffic A/B
          test; measurement is based on Search Console.
        </p>
        <div className="mt-5 grid gap-3">
          <select
            value={draftId}
            onChange={(e) => setDraftId(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select a draft</option>
            {drafts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} · {d.status}
              </option>
            ))}
          </select>
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Target URL"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={aId}
              onChange={(e) => setAId(e.target.value)}
              className="border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">Variant A version</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} · {v.source} · {v.status}
                </option>
              ))}
            </select>
            <select
              value={bId}
              onChange={(e) => setBId(e.target.value)}
              className="border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">Variant B version</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} · {v.source} · {v.status}
                </option>
              ))}
            </select>
          </div>
          <button
            disabled={busy || !draftId || !targetUrl || !aId || !bId || aId === bId}
            onClick={create}
            className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
          >
            {busy ? "Working…" : "Create experiment"}
          </button>
          {message && <p className="text-xs text-ink/60">{message}</p>}
        </div>
      </section>
      <section className="mt-6 space-y-3">
        {experiments.map((e: UnknownRecord) => (
          <div key={e.id} className="border border-line bg-white/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">{e.targetUrl}</p>
                <p className="mt-1 text-xs text-ink/50">
                  Status: {e.status} · metric: {e.metric}
                </p>
              </div>
              <span className="border border-line px-2 py-1 text-xs">{e.id.slice(0, 8)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {e.status === "draft" && (
                <button
                  disabled={busy}
                  onClick={() => action(e.id, "start-a")}
                  className="border border-ink px-3 py-1.5 text-xs"
                >
                  Start Variant A
                </button>
              )}
              {e.status === "running_a" && (
                <button
                  disabled={busy}
                  onClick={() => {
                    const end = window.prompt("Variant A end date (YYYY-MM-DD)");
                    if (end) action(e.id, "start-b", { aEndDate: end });
                  }}
                  className="border border-ink px-3 py-1.5 text-xs"
                >
                  Finish A / Start B
                </button>
              )}
              {e.status === "running_b" && (
                <button
                  disabled={busy}
                  onClick={() => {
                    const start = window.prompt("Observation start date (YYYY-MM-DD)");
                    const end = window.prompt("Observation end date (YYYY-MM-DD)");
                    if (start && end) action(e.id, "observe", { variant: "b", startDate: start, endDate: end });
                  }}
                  className="border border-ink px-3 py-1.5 text-xs"
                >
                  Observe B
                </button>
              )}
              {e.status !== "draft" && (
                <button
                  disabled={busy}
                  onClick={() => action(e.id, "evaluate")}
                  className="border border-ink px-3 py-1.5 text-xs"
                >
                  Evaluate
                </button>
              )}
              {(e.status === "winner_a" || e.status === "winner_b") && (
                <button
                  disabled={busy}
                  onClick={() => action(e.id, "promote")}
                  className="border-2 border-signal bg-signal px-3 py-1.5 text-xs"
                >
                  Promote winner
                </button>
              )}
            </div>
            {e.result && (
              <pre className="mt-4 overflow-auto border border-line bg-white p-3 text-[11px] text-ink/70">
                {JSON.stringify(e.result, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {!experiments.length && (
          <p className="border border-line bg-white/60 p-5 text-sm text-ink/50">No SEO experiments yet.</p>
        )}
      </section>
    </>
  );
}

function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    apiFetch("/api/analytics")
      .then(async (res) => {
        const text = await res.text();
        const json = (text ? JSON.parse(text) : {}) as AnalyticsData & { error?: string };
        if (!res.ok) throw new Error(json.error || "Analytics data could not be loaded.");
        setData(json);
      })
      .catch((err: unknown) => {
        const message = errorMessage(err, "Analytics data could not be loaded.");
        setError(
          /JSON|Unexpected end|Unexpected token/i.test(message)
            ? "Sign in and select a workspace to load analytics. Sample graphs are never invented."
            : message
        );
      })
      .finally(() => setLoading(false));
  }

  useEffect(
    () =>
      scheduleMount(() => {
        load();
      }),
    []
  );

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
        <PageHeader
          title="Analytics"
          description="Live performance from connected sources. Charts and metrics appear only when real data exists."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description="Live performance from connected sources. Charts and metrics appear only when real data exists."
        />
        <EmptyState
          title="Analytics couldn't be loaded"
          description={error || "Analytics data could not be loaded."}
          action={
            <Button variant="primary" onClick={load}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const hasAnyData =
    data.website.scoreHistory.length > 0 ||
    Boolean(data.youtube) ||
    Boolean(data.facebook) ||
    Boolean(data.searchConsole) ||
    data.snapshots.length > 0;
  const gsc = data.searchConsole && !data.searchConsole.error ? data.searchConsole : null;
  const latestSeo = data.website.scoreHistory[0];
  const showKpis = Boolean(latestSeo || gsc || data.youtube?.channelStats || data.facebook?.pageStats);
  const period =
    gsc?.periodStart && gsc.periodEnd ? `${gsc.periodStart} → ${gsc.periodEnd}` : gsc?.siteUrl || undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={gsc?.siteUrl}
        title="Analytics"
        description={
          period
            ? `Live performance from connected sources. Period ${period}. Charts and metrics appear only when real data exists.`
            : "Live performance from connected sources. Charts and metrics appear only when real data exists."
        }
      />

      {!hasAnyData ? (
        <EmptyState
          title="No analytics data yet."
          description="Connect your website or channel to start collecting performance data. Run an SEO audit, or connect Search Console, YouTube, or Facebook. Sample graphs are never invented."
        />
      ) : (
        <>
          {showKpis ? (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Performance overview">
              {latestSeo ? (
                <MetricCard
                  label="SEO health"
                  value={`${latestSeo.latestScore}/100`}
                  hint={latestSeo.url}
                  trend={latestSeo.trend}
                />
              ) : null}
              {gsc ? (
                <>
                  <MetricCard label="Organic clicks" value={(gsc.clicks || 0).toLocaleString()} hint="Search Console" />
                  <MetricCard
                    label="Impressions"
                    value={(gsc.impressions || 0).toLocaleString()}
                    hint="Search Console"
                  />
                  <MetricCard
                    label="CTR"
                    value={`${((gsc.ctr || 0) * 100).toFixed(2)}%`}
                    hint={
                      gsc.averagePosition != null ? `Avg position ${Number(gsc.averagePosition).toFixed(1)}` : undefined
                    }
                  />
                </>
              ) : null}
              {data.youtube?.channelStats ? (
                <MetricCard
                  label="YouTube views"
                  value={data.youtube.channelStats.viewCount.toLocaleString()}
                  hint={data.youtube.channelStats.channelTitle}
                />
              ) : null}
              {data.facebook?.pageStats ? (
                <MetricCard
                  label="Facebook followers"
                  value={data.facebook.pageStats.fanCount.toLocaleString()}
                  hint={data.facebook.pageStats.pageName}
                />
              ) : null}
            </section>
          ) : null}

          {data.website.scoreHistory.length > 0 ? (
            <div>
              <SectionHeader title="How is SEO health changing?" description="Scores from completed website audits." />
              <div className="space-y-3">
                {data.website.scoreHistory.map((entry) => {
                  const scores = entry.history.map((point) => point.score).filter((value) => Number.isFinite(value));
                  return (
                    <Card key={entry.url}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">{entry.url}</p>
                          <p className="mt-1 text-xs text-muted">
                            {entry.history.length} check{entry.history.length > 1 ? "s" : ""} recorded
                          </p>
                        </div>
                        <ScoreMark value={entry.latestScore} label="Latest score" />
                      </div>
                      {scores.length >= 2 ? (
                        <div className="mt-4">
                          <Sparkline values={scores} label={`SEO score trend for ${entry.url}`} />
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-muted">Run another audit to see this URL trend.</p>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}

          {data.searchConsole?.error ? <Alert>{data.searchConsole.error}</Alert> : null}

          {data.youtube ? (
            <Card>
              <SectionHeader
                title="Which YouTube content is performing?"
                description="Channel stats and videos published or optimized through AIBISORA."
              />
              {data.youtube.channelStats ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricCard
                    flush
                    label="Subscribers"
                    value={data.youtube.channelStats.subscriberCount.toLocaleString()}
                  />
                  <MetricCard flush label="Total views" value={data.youtube.channelStats.viewCount.toLocaleString()} />
                  <MetricCard flush label="Videos" value={data.youtube.channelStats.videoCount.toLocaleString()} />
                </div>
              ) : null}
              {data.youtube.videos.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {data.youtube.videos.map((v) => (
                    <li key={v.videoId} className="rounded-[var(--nx-radius-sm)] border border-line bg-elevated p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium text-ink">{v.title}</p>
                        {v.underperforming ? <Badge tone="warning">Below average</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {v.viewCount.toLocaleString()} views · {v.likeCount.toLocaleString()} likes ·{" "}
                        {v.commentCount.toLocaleString()} comments
                      </p>
                      {v.underperforming ? (
                        <p className="mt-1 text-xs text-[var(--nx-text-secondary)]">
                          Significantly below the channel average — consider re-optimizing the title and description.
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  No videos have been published or optimized through AIBISORA yet.
                </p>
              )}
            </Card>
          ) : null}

          {data.facebook ? (
            <Card>
              <SectionHeader title="How is Facebook performing?" />
              {data.facebook.pageStats ? (
                <MetricCard
                  flush
                  label="Page followers"
                  value={data.facebook.pageStats.fanCount.toLocaleString()}
                  hint={data.facebook.pageStats.pageName}
                />
              ) : null}
              {data.facebook.posts.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {data.facebook.posts.map((p) => (
                    <li key={p.postId} className="rounded-[var(--nx-radius-sm)] border border-line bg-elevated p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm text-ink">{p.message}</p>
                        {p.underperforming ? <Badge tone="warning">Below average</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {p.likeCount.toLocaleString()} likes · {p.commentCount.toLocaleString()} comments ·{" "}
                        {p.shareCount.toLocaleString()} shares
                      </p>
                      {p.underperforming ? (
                        <p className="mt-1 text-xs text-[var(--nx-text-secondary)]">
                          Engagement is significantly below the page average.
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">No recent posts found yet.</p>
              )}
            </Card>
          ) : null}

          {data.snapshots.length > 0 ? (
            <div>
              <SectionHeader
                title="Saved snapshots"
                description="Historical metrics already stored for this workspace."
              />
              <ul className="divide-y divide-[var(--nx-border)] rounded-[var(--nx-radius-md)] border border-line">
                {data.snapshots.map((snap, index) => (
                  <li
                    key={`${snap.provider}-${snap.period_start}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-ink">{snap.provider.replace(/-/g, " ")}</p>
                      <p className="text-xs text-muted">
                        {snap.period_start} → {snap.period_end}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--nx-text-secondary)]">
                      {snap.metrics.clicks != null
                        ? `${snap.metrics.clicks.toLocaleString()} clicks`
                        : "Recorded snapshot"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line bg-white p-3">
      <p className="font-head text-2xl text-ink">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-ink/50">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Tab 5: Automation — trend ideas, content calendar, performance reports (Phase 5)
// ---------------------------------------------------------------------

interface TrendIdea {
  topic: string;
  angle: string;
  whyTrending: string;
}

interface CalendarItem {
  id: string;
  channel: Channel;
  topic: string;
  scheduledDate: string;
  status: "planned" | "generated" | "failed";
  errorMessage?: string;
}

function YouTubePerformanceIntelligenceTab() {
  const [data, setData] = useState<UnknownRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiFetch("/api/youtube-tools/performance-intelligence")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "YouTube performance intelligence failed.");
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <p className="text-sm text-ink/60">Loading YouTube performance intelligence…</p>;
  if (error)
    return (
      <section className="border border-clay bg-white/60 p-6">
        <p className="text-sm text-clay">{error}</p>
      </section>
    );
  if (!data) return null;
  const m = data.metrics;
  return (
    <div className="space-y-6">
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">YouTube Performance Intelligence</h2>
        <p className="mt-1 text-xs text-ink/50">
          {data.periodStart} → {data.periodEnd}. Requires YouTube Analytics access on the connected Google account.
          Reconnect YouTube if this report cannot load.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Views" value={m.views} />
          <StatBox label="Minutes Watched" value={Math.round(m.estimatedMinutesWatched)} />
          <StatBox label="Viewed %" value={Number(m.averageViewPercentage.toFixed(1))} />
          <StatBox label="Net Subscribers" value={m.subscribersGained - m.subscribersLost} />
        </div>
      </section>
      <section className="border border-line bg-white/60 p-6">
        <h3 className="font-head font-semibold">AI-ready decision signals</h3>
        <p className="mt-1 text-xs text-ink/50">Rule-based recommendations grounded in YouTube Analytics evidence.</p>
        <div className="mt-4 space-y-3">
          {data.recommendations.map((r: UnknownRecord) => (
            <div key={r.id} className="border border-line bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{r.title}</p>
                <span className="text-xs uppercase text-ink/50">{r.priority}</span>
              </div>
              <p className="mt-1 text-sm text-ink/70">{r.reason}</p>
              <p className="mt-2 text-xs text-ink/50">Evidence: {r.evidence.join(" · ")}</p>
              <p className="mt-2 text-sm text-ink/70">
                <b>Action:</b> {r.action}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdvancedAnalyticsTab() {
  const [data, setData] = useState<UnknownRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiFetch("/api/analytics/advanced")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Advanced analytics failed.");
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <p className="text-sm text-ink/60">Loading advanced analytics…</p>;
  if (error)
    return (
      <section className="border border-clay bg-white/60 p-6">
        <p className="text-sm text-clay">{error}</p>
      </section>
    );
  if (!data) return null;
  const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(2)}%`);
  const delta = data.traffic.delta;
  return (
    <>
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold">Advanced SEO Analytics & ROI</h2>
        <p className="mt-1 text-xs text-ink/50">
          {data.periodStart} → {data.periodEnd} · previous: {data.previousPeriodStart} → {data.previousPeriodEnd}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Organic Clicks" value={data.traffic.current.clicks} />
          <StatBox label="Impressions" value={data.traffic.current.impressions} />
          <StatBox label="CTR %" value={Number((data.traffic.current.ctr * 100).toFixed(2))} />
          <StatBox label="Published Content" value={data.content.published} />
        </div>
        {delta && (
          <div className="mt-4 grid gap-2 sm:grid-cols-4 text-sm">
            <div className="border border-line p-3">
              Clicks:{" "}
              <b>
                {delta.clicks >= 0 ? "+" : ""}
                {delta.clicks}
              </b>
            </div>
            <div className="border border-line p-3">
              Impressions:{" "}
              <b>
                {delta.impressions >= 0 ? "+" : ""}
                {delta.impressions}
              </b>
            </div>
            <div className="border border-line p-3">
              CTR: <b>{pct(delta.ctr)}</b>
            </div>
            <div className="border border-line p-3">
              Position: <b>{delta.averagePosition == null ? "—" : delta.averagePosition.toFixed(2)}</b>
            </div>
          </div>
        )}
      </section>
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h3 className="font-head font-semibold">SEO & Content Efficiency</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="SEO Score Avg" value={Math.round(data.seo.currentAverage ?? 0)} />
          <StatBox label="Previous SEO Avg" value={Math.round(data.seo.previousAverage ?? 0)} />
          <StatBox label="URLs Tracked" value={data.seo.urls} />
          <StatBox label="Clicks / Content" value={Number((data.roi.clicksPerPublishedContent ?? 0).toFixed(1))} />
        </div>
        <p className="mt-4 text-xs text-ink/50">
          ROI here is directional: organic clicks are not revenue. Attribution is correlation-only.
        </p>
      </section>
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h3 className="font-head font-semibold">Recommended Actions</h3>
        <ul className="mt-3 space-y-2">
          {data.recommendations.map((r: string, i: number) => (
            <li key={i} className="border border-line bg-white p-3 text-sm">
              {r}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function MonitoringTab() {
  const [profiles, setProfiles] = useState<UnknownRecord[]>([]);
  const [snapshots, setSnapshots] = useState<UnknownRecord[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function load() {
    const r = await apiFetch("/api/monitoring");
    const d = await r.json();
    setProfiles(d.profiles || []);
    setSnapshots(d.snapshots || []);
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void load();
      }),
    []
  );
  async function create() {
    if (!name.trim() || !url.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch("/api/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetUrl: url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setName("");
      setUrl("");
      await load();
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Could not create the monitoring profile."));
    } finally {
      setBusy(false);
    }
  }
  async function run(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch("/api/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", profileId: id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(`${d.result.alerts?.length || 0} alert(s) detected.`);
      await load();
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Monitoring run failed."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5">
      <div className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold">SEO Monitoring & Alerts</h2>
        <p className="mt-1 text-sm text-ink/60">
          Compare technical SEO and Search Console signals across snapshots. This does not mutate the website.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Monitor name"
            className="border border-line bg-white px-3 py-2"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="border border-line bg-white px-3 py-2 md:col-span-2"
          />
          <button disabled={busy} onClick={create} className="border border-ink bg-ink px-4 py-2 text-white">
            Create monitor
          </button>
        </div>
        {message && <p className="mt-3 text-sm">{message}</p>}
      </div>
      <div className="border border-line bg-white/60 p-6">
        <h3 className="font-head font-semibold">Monitoring profiles</h3>
        <div className="mt-3 space-y-2">
          {profiles.length ? (
            profiles.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border border-line p-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-ink/60">
                    {p.target_url} · {p.frequency}
                  </div>
                </div>
                <button disabled={busy} onClick={() => run(p.id)} className="border border-line px-3 py-1 text-sm">
                  Run check
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink/60">No monitoring profiles yet.</p>
          )}
        </div>
      </div>
      <div className="border border-line bg-white/60 p-6">
        <h3 className="font-head font-semibold">Recent snapshots</h3>
        <div className="mt-3 space-y-2">
          {snapshots.slice(0, 10).map((s: UnknownRecord) => (
            <div key={s.id} className="border border-line p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span>{s.target_url}</span>
                <span>Score: {s.technical_score ?? "—"}</span>
              </div>
              <div className="mt-1 text-xs text-ink/60">
                Issues: {s.issue_count} · Alerts: {Array.isArray(s.alerts) ? s.alerts.length : 0} ·{" "}
                {new Date(s.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AutomationTab() {
  // Trend ideas
  const [niche, setNiche] = useState("");
  const [trendLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [ideas, setIdeas] = useState<TrendIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  // Calendar
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [newChannel, setNewChannel] = useState<Channel>("website");
  const [newTopic, setNewTopic] = useState("");
  const [newDate, setNewDate] = useState("");
  const [calendarBusy, setCalendarBusy] = useState(false);

  // For running due items, we need a minimal business profile
  const [runProfile, setRunProfile] = useState<BusinessProfile>({
    businessName: "",
    niche: "",
    audience: "",
    tone: "",
  });
  const [runLanguage] = useState<Language>(DEFAULT_CONTENT_LANGUAGE);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Report
  const [report, setReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(
    () =>
      scheduleMount(() => {
        void loadCalendar();
      }),
    []
  );

  async function loadCalendar() {
    const res = await apiFetch("/api/calendar");
    const data = await res.json();
    setItems(data.items || []);
  }

  async function fetchIdeas() {
    setIdeasLoading(true);
    setIdeasError(null);
    setIdeas([]);
    try {
      const res = await apiFetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, language: trendLanguage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIdeas(data.ideas || []);
    } catch (e: unknown) {
      setIdeasError(errorMessage(e, "Something went wrong."));
    } finally {
      setIdeasLoading(false);
    }
  }

  async function addCalendarItem() {
    if (!newTopic.trim() || !newDate) return;
    setCalendarBusy(true);
    try {
      await apiFetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: newChannel, topic: newTopic, scheduledDate: newDate }),
      });
      setNewTopic("");
      setNewDate("");
      await loadCalendar();
    } finally {
      setCalendarBusy(false);
    }
  }

  async function runDueItems() {
    if (!runProfile.businessName.trim()) {
      setRunMessage("Fill in the business profile below first.");
      return;
    }
    setRunning(true);
    setRunMessage(null);
    try {
      const res = await apiFetch("/api/calendar/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: runProfile, language: runLanguage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRunMessage(
        data.processed === 0
          ? "No items were due today."
          : `${data.processed} item(s) processed — check the Publish tab.`
      );
      await loadCalendar();
    } catch (e: unknown) {
      setRunMessage(errorMessage(e, "Something went wrong."));
    } finally {
      setRunning(false);
    }
  }

  async function fetchReport() {
    setReportLoading(true);
    setReport(null);
    try {
      const res = await apiFetch("/api/report");
      const data = await res.json();
      setReport(data.report || data.error || "Report not found.");
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <>
      <AutomationWorkflowPanel />
      {/* Trend ideas */}
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Trend Ideas</h2>
        <p className="mt-1 text-sm text-ink/60">Looks up current web trends and suggests 5 content ideas.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. bus ticket booking"
            className="focus-ring flex-1 border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
          />
          <button
            onClick={fetchIdeas}
            disabled={!niche.trim() || ideasLoading}
            className="focus-ring border-2 border-ink bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ideasLoading ? "…" : "Get ideas"}
          </button>
        </div>
        {ideasError && <p className="mt-2 text-sm text-clay">{ideasError}</p>}
        {ideas.length > 0 && (
          <div className="mt-4 space-y-2">
            {ideas.map((idea, i) => (
              <div key={i} className="border border-line bg-white p-3">
                <p className="font-medium text-ink">{idea.topic}</p>
                <p className="mt-1 text-sm text-ink/70">{idea.angle}</p>
                <p className="mt-1 text-xs text-ink/50">{idea.whyTrending}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Content calendar */}
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Content Calendar</h2>
        <p className="mt-1 text-sm text-ink/60">
          Plan topics and schedule them — &quot;Run Due Items&quot; generates items dated today or earlier (in
          production this will run automatically via cron).
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              onClick={() => setNewChannel(c.id)}
              className={`focus-ring border px-3 py-1.5 text-sm transition ${
                newChannel === c.id ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Topic"
            aria-label="Calendar topic"
            className="focus-ring border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            aria-label="Calendar date"
            className="focus-ring border border-line bg-white px-3 py-2 text-ink"
          />
          <button
            onClick={addCalendarItem}
            disabled={!newTopic.trim() || !newDate || calendarBusy}
            className="focus-ring border-2 border-ink bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {items.length > 0 && (
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between border border-line bg-white px-3 py-2">
                <div>
                  <span className="mr-2 border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink/50">
                    {item.channel}
                  </span>
                  <span className="text-sm text-ink">{item.topic}</span>
                  <span className="ml-2 text-xs text-ink/40">{item.scheduledDate}</span>
                </div>
                <span
                  className={`text-xs ${
                    item.status === "planned" ? "text-ink/50" : item.status === "generated" ? "text-ink" : "text-clay"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-sm text-ink/70">Business profile for generating due items:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label="Business name"
              value={runProfile.businessName}
              onChange={(v) => setRunProfile({ ...runProfile, businessName: v })}
            />
            <Field
              label="Industry / niche"
              value={runProfile.niche}
              onChange={(v) => setRunProfile({ ...runProfile, niche: v })}
            />
            <Field
              label="Target audience"
              value={runProfile.audience}
              onChange={(v) => setRunProfile({ ...runProfile, audience: v })}
            />
            <Field
              label="Brand tone"
              value={runProfile.tone}
              onChange={(v) => setRunProfile({ ...runProfile, tone: v })}
            />
          </div>
          <button
            onClick={runDueItems}
            disabled={running}
            className="focus-ring mt-3 border-2 border-ink bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {running ? "Running…" : "Run Due Items Now"}
          </button>
          {runMessage && <p className="mt-2 text-sm text-ink/70">{runMessage}</p>}
        </div>
      </section>

      {/* Performance report */}
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Performance Report</h2>
        <p className="mt-1 text-sm text-ink/60">Builds a plain-language summary from Analytics tab data.</p>
        <button
          onClick={fetchReport}
          disabled={reportLoading}
          className="focus-ring mt-3 border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
        >
          {reportLoading ? "Generating…" : "Create report"}
        </button>
        {report && (
          <div className="mt-4 border border-line bg-white p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{report}</p>
          </div>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------
// Shared field component
// ---------------------------------------------------------------------

function SystemTab() {
  const [jobs, setJobs] = useState<UnknownRecord[]>([]);
  const [health, setHealth] = useState<UnknownRecord[]>([]);
  const [logs, setLogs] = useState<UnknownRecord[]>([]);
  const [members, setMembers] = useState<UnknownRecord[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [j, h, a, m] = await Promise.all([
      apiFetch("/api/jobs"),
      apiFetch("/api/connections/health", { method: "POST" }),
      apiFetch("/api/audit"),
      apiFetch("/api/workspaces/members"),
    ]);
    if (j.ok) setJobs((await j.json()).jobs || []);
    if (h.ok) setHealth((await h.json()).results || []);
    if (a.ok) setLogs((await a.json()).logs || []);
    if (m.ok) setMembers((await m.json()).members || []);
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void load().catch(() => undefined);
      }),
    []
  );

  async function invite() {
    setBusy(true);
    setMessage("");
    try {
      const res = await apiFetch("/api/workspaces/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invite failed.");
      setEmail("");
      setMessage("Invite/member add request successful.");
      await load();
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Member error."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="nx-card p-6">
        <h2 className="nx-section-title text-ink">Appearance</h2>
        <p className="mt-1 text-sm text-[var(--nx-text-secondary)]">
          Dark, light, or match the operating system. The choice is saved for this browser and, when signed in, your
          account.
        </p>
        <div className="mt-4">
          <ThemeToggle compact={false} />
        </div>
      </section>
      <section className="nx-card p-6">
        <h2 className="nx-section-title text-ink">Language</h2>
        <p className="mt-1 text-sm text-[var(--nx-text-secondary)]">
          Interface language is independent from AI content-generation language.
        </p>
        <div className="mt-4 max-w-sm">
          <LanguageSelector id="settings-ui-language" />
        </div>
      </section>
      <section className="nx-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-head text-xl font-semibold text-ink">System Health</h2>
            <p className="text-sm text-ink/60">Publishing connections, durable jobs, and recent audit activity.</p>
          </div>
          <button onClick={() => load()} className="border border-line px-3 py-2 text-sm text-ink hover:border-ink">
            Refresh
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Queued / Running"
            value={jobs.filter((j) => j.status === "queued" || j.status === "running").length}
          />
          <Metric label="Failed Jobs" value={jobs.filter((j) => j.status === "failed").length} />
          <Metric label="Healthy Connections" value={health.filter((h) => h.ok).length} />
        </div>
      </section>

      <section className="border border-line bg-white/60 p-6">
        <h3 className="font-head text-lg font-semibold text-ink">Connection Health</h3>
        {health.length ? (
          <div className="mt-3 space-y-2">
            {health.map((h) => (
              <div key={h.id} className="flex justify-between border border-line bg-white p-3 text-sm">
                <span>{h.provider}</span>
                <span className={h.ok ? "text-ink" : "text-clay"}>
                  {h.ok ? `✓ OK (${h.latencyMs}ms)` : `✕ ${h.message}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/50">No connected providers.</p>
        )}
      </section>

      <section className="border border-line bg-white/60 p-6">
        <h3 className="font-head text-lg font-semibold text-ink">Job Queue</h3>
        {jobs.length ? (
          <div className="mt-3 space-y-2">
            {jobs.slice(0, 20).map((j) => (
              <div key={j.id} className="border border-line bg-white p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{j.type}</span>
                  <span>{j.status}</span>
                </div>
                <div className="mt-1 text-xs text-ink/50">
                  Attempts {j.attempts}/{j.maxAttempts} · Run after {new Date(j.runAfter).toLocaleString()}
                </div>
                {j.lastError && <div className="mt-1 text-xs text-clay">{j.lastError}</div>}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/50">No jobs.</p>
        )}
      </section>

      <section className="border border-line bg-white/60 p-6">
        <h3 className="font-head text-lg font-semibold text-ink">Team</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@email.com"
            className="border border-line bg-white px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="editor">Editor</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={invite}
            disabled={busy || !email}
            className="border-2 border-ink bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Invite / Add
          </button>
        </div>
        {message && <p className="mt-2 text-sm text-ink/70">{message}</p>}
        <div className="mt-4 space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="flex justify-between border border-line bg-white p-3 text-xs">
              <span className="font-mono">{m.user_id}</span>
              <span>{m.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-line bg-white/60 p-6">
        <h3 className="font-head text-lg font-semibold text-ink">Audit Log</h3>
        {logs.length ? (
          <div className="mt-3 space-y-2">
            {logs.slice(0, 30).map((l) => (
              <div key={l.id} className="border border-line bg-white p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{l.action}</span>
                  <span className="text-xs text-ink/50">{new Date(l.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-xs text-ink/50">
                  {l.entity_type || "system"} {l.entity_id || ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/50">No audit entries.</p>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="nx-card p-4">
      <div className="nx-label">{label}</div>
      <div className="nx-metric mt-2 text-ink">{value}</div>
    </div>
  );
}

function SecretField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="text-sm text-ink/80">{label}</span>
      <div className="relative mt-1">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="focus-ring w-full border border-line bg-white px-3 py-2 pr-11 text-ink"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `${label} hide` : `${label} show`}
          className="absolute inset-y-0 right-0 px-3 text-sm text-ink/50 hover:text-ink"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="nx-label">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="focus-ring mt-1 min-h-10 w-full rounded-[var(--nx-radius-sm)] border border-[var(--nx-border-strong)] bg-elevated px-3 py-2 text-sm text-ink placeholder:text-muted"
      />
    </label>
  );
}
