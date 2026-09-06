"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { getSession, loadCurrentUser, signOut } from "@/lib/auth/browser";
import AuthScreen from "@/app/auth/AuthScreen";
import AutomationWorkflowPanel from "@/app/automation/AutomationWorkflowPanel";
import StrategistTab from "@/app/StrategistTab";
import OperatingSystemTab from "@/app/os/OperatingSystemTab";
import type { BusinessProfile, Channel, GeneratedContent, Language, SeoAnalysis, SeoFixes } from "@/lib/claude";
import type { CrawlResult } from "@/lib/seo-crawler";

const CHANNELS: { id: Channel; label: string; note: string }[] = [
  { id: "website", label: "Website", note: "Blog/page content + meta description" },
  { id: "youtube", label: "YouTube", note: "Title + description + tags" },
  { id: "facebook", label: "Facebook", note: "Post + hashtags" },
];

const LANGUAGES: { id: Language; label: string }[] = [
  { id: "ur", label: "اردو" },
  { id: "roman-ur", label: "Roman Urdu" },
  { id: "en", label: "English" },
];

type Tab = "generate" | "analyze" | "publish" | "analytics" | "keywords" | "competitors" | "strategy" | "studio" | "quality" | "technical" | "architecture" | "local" | "experiments" | "monitoring" | "advancedAnalytics" | "strategist" | "operatingSystem" | "automation" | "system"
  | "ytKeywordResearch" | "ytSeoStudio" | "ytTagGenerator" | "ytChannelAudit"
  | "ytThumbnailAB" | "ytBulkOptimizer" | "ytCommunityPosts"
  | "ytPerformanceAnalytics" | "ytCompetitorTracking" | "ytRetentionInsights"
  | "fbPageSeo" | "fbHashtagResearch"
  | "fbPostAB" | "fbBulkScheduler" | "fbEngagementAssistant"
  | "fbPostAnalytics" | "fbCompetitorTracking" | "fbAudienceInsights";

type TabCategory = "website" | "youtube" | "facebook" | "overview";

const TAB_CATEGORIES: { id: TabCategory; label: string; icon: string }[] = [
  { id: "website", label: "Website", icon: "🌐" },
  { id: "youtube", label: "YouTube", icon: "📺" },
  { id: "facebook", label: "Facebook", icon: "📘" },
  { id: "overview", label: "Overview & Settings", icon: "⚙️" },
];

// Content Generator, Publish, and AI Content Studio each already let you pick
// a channel inside the tool itself (website/youtube/facebook) — so they
// appear under all three channel categories rather than living in just one.
// Everything else here is genuinely website-only right now (Section 4.1's
// note: YouTube/Facebook don't have their own Keyword Research, Technical
// SEO, etc. yet — that's future work, not something this navigation change
// can paper over).
const TABS_BY_CATEGORY: Record<TabCategory, { id: Tab; label: string; group?: string }[]> = {
  website: [
    { id: "analyze", label: "SEO Analyzer", group: "SEO" },
    { id: "keywords", label: "Keyword Research", group: "SEO" },
    { id: "competitors", label: "Competitor Intelligence", group: "SEO" },
    { id: "technical", label: "Technical SEO", group: "SEO" },
    { id: "architecture", label: "Internal Linking", group: "SEO" },
    { id: "local", label: "Local SEO", group: "SEO" },
    { id: "strategy", label: "Content Strategy", group: "Marketing" },
    { id: "generate", label: "Content Generator", group: "Marketing" },
    { id: "publish", label: "Publish", group: "Marketing" },
    { id: "analytics", label: "Analytics", group: "Analytics" },
  ],
  youtube: [
    { id: "ytKeywordResearch", label: "YouTube Keyword Research", group: "SEO" },
    { id: "ytSeoStudio", label: "Video SEO Studio", group: "SEO" },
    { id: "ytTagGenerator", label: "Tag Generator", group: "SEO" },
    { id: "ytChannelAudit", label: "Channel Audit", group: "SEO" },
    { id: "generate", label: "Content Generator", group: "Marketing" },
    { id: "publish", label: "Publish", group: "Marketing" },
    { id: "studio", label: "AI Content Studio", group: "Marketing" },
    { id: "ytThumbnailAB", label: "Thumbnail & Title A/B Testing", group: "Marketing" },
    { id: "ytBulkOptimizer", label: "Bulk Video Optimizer", group: "Marketing" },
    { id: "ytCommunityPosts", label: "Community Post Generator", group: "Marketing" },
    { id: "analytics", label: "Analytics", group: "Analytics" },
    { id: "ytPerformanceAnalytics", label: "Video Performance Analytics", group: "Analytics" },
    { id: "ytCompetitorTracking", label: "Competitor Channel Tracking", group: "Analytics" },
    { id: "ytRetentionInsights", label: "Watch Time & Retention Insights", group: "Analytics" },
  ],
  facebook: [
    { id: "fbPageSeo", label: "Page & Post Discovery Optimization", group: "SEO" },
    { id: "fbHashtagResearch", label: "Hashtag & Keyword Research", group: "SEO" },
    { id: "generate", label: "Content Generator", group: "Marketing" },
    { id: "publish", label: "Publish", group: "Marketing" },
    { id: "studio", label: "AI Content Studio", group: "Marketing" },
    { id: "fbPostAB", label: "Post A/B Testing", group: "Marketing" },
    { id: "fbBulkScheduler", label: "Bulk Post Scheduler", group: "Marketing" },
    { id: "fbEngagementAssistant", label: "Comment & Engagement Assistant", group: "Marketing" },
    { id: "analytics", label: "Analytics", group: "Analytics" },
    { id: "fbPostAnalytics", label: "Post Performance Analytics", group: "Analytics" },
    { id: "fbCompetitorTracking", label: "Competitor Page Tracking", group: "Analytics" },
    { id: "fbAudienceInsights", label: "Audience Insights", group: "Analytics" },
  ],
  overview: [
    { id: "analytics", label: "Analytics (All Channels)" },
    { id: "automation", label: "Automation" },
    { id: "quality", label: "Quality & Fact Check" },
    { id: "experiments", label: "SEO Experiments" },
    { id: "monitoring", label: "Monitoring & Alerts" },
    { id: "advancedAnalytics", label: "Advanced Analytics & ROI" },
    { id: "strategist", label: "AI SEO Strategist" },
    { id: "operatingSystem", label: "AI Operating System" },
    { id: "system", label: "System" },
  ],
};

function categoryOf(tab: Tab): TabCategory {
  for (const cat of TAB_CATEGORIES) {
    if (TABS_BY_CATEGORY[cat.id].some((t) => t.id === tab)) return cat.id;
  }
  return "website";
}

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Local/demo mode: if Supabase isn't configured (NEXT_PUBLIC_SUPABASE_URL
  // missing), skip the login screen entirely and use a stand-in local user —
  // this restores the "local single-user demo works without auth" behavior
  // documented for AUTOSEO_AUTH_REQUIRED=false. Once Supabase is configured
  // and login is actually set up, this branch stops applying automatically.
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  useEffect(() => {
    if (!supabaseConfigured) {
      setUser({ id: "local-demo-user", email: "local@autoseo.dev" });
      setReady(true);
      return;
    }
    let mounted = true;
    loadCurrentUser().then((u) => { if (mounted) { setUser(u); setReady(true); } }).catch(() => { if (mounted) setReady(true); });
    const onAuth = () => loadCurrentUser().then((u) => { if (mounted) setUser(u); });
    window.addEventListener("autoseo-auth-change", onAuth);
    return () => { mounted = false; window.removeEventListener("autoseo-auth-change", onAuth); };
  }, [supabaseConfigured]);

  if (!ready) return <main className="min-h-screen bg-paper p-10 text-center text-sm text-ink/60">AutoSEO load ho raha hai…</main>;
  if (supabaseConfigured && (!user || !getSession())) {
    return <main className="min-h-screen bg-paper px-6 py-16"><AuthScreen onAuthenticated={() => loadCurrentUser().then(setUser)} /></main>;
  }
  return (
    <AuthenticatedDashboard
      user={user}
      onSignOut={supabaseConfigured ? () => signOut().then(() => setUser(null)) : () => {}}
    />
  );
}

function AuthenticatedDashboard({ user, onSignOut }: { user: any; onSignOut: () => void }) {
  const [tab, setTabRaw] = useState<Tab>("generate");
  const [category, setCategory] = useState<TabCategory>(categoryOf("generate"));

  function selectCategory(c: TabCategory) {
    setCategory(c);
    setTabRaw(TABS_BY_CATEGORY[c][0].id);
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b-4 border-ink bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <p className="font-display text-3xl leading-tight text-signal">آٹو ایس ای او</p>
          <h1 className="font-head mt-2 text-2xl font-semibold sm:text-3xl">
            Website, YouTube, Facebook — جو بھی آپ کے پاس ہے
          </h1>
          <p className="mt-3 max-w-xl text-sm text-paper/80">
            Sab channels connect karna zaroori nahi — sirf woh chunein jo aap chalate hain,
            aur is se advance-level SEO aur marketing content payein.
          </p>

          <WorkspaceBar />
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-paper/70">
            <span>{user?.id === "local-demo-user" ? "Local demo mode (Supabase not configured)" : user?.email || "Signed in"}</span>
            {user?.id !== "local-demo-user" && (
              <button onClick={onSignOut} className="border border-paper/30 px-3 py-1.5 hover:border-paper/60">Sign out</button>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {TAB_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat.id)}
                className={`focus-ring border-2 px-4 py-2 text-sm font-medium transition ${
                  category === cat.id
                    ? "border-signal bg-signal text-ink"
                    : "border-paper/30 bg-transparent text-paper/80 hover:border-paper/60"
                }`}
              >
                <span className="mr-1.5">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="mt-3 border-t border-paper/20 pt-3">
            {(() => {
              const tabs = TABS_BY_CATEGORY[category];
              const hasGroups = tabs.some((t) => t.group);
              if (!hasGroups) {
                return (
                  <div className="flex flex-wrap gap-2">
                    {tabs.map((t) => (
                      <TabButton key={t.id} active={tab === t.id} onClick={() => setTabRaw(t.id)}>
                        {t.label}
                      </TabButton>
                    ))}
                  </div>
                );
              }
              const groups = Array.from(new Set(tabs.map((t) => t.group || "")));
              return (
                <div className="space-y-3">
                  {groups.map((g) => (
                    <div key={g}>
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-paper/50">
                        {g}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {tabs
                          .filter((t) => (t.group || "") === g)
                          .map((t) => (
                            <TabButton key={t.id} active={tab === t.id} onClick={() => setTabRaw(t.id)}>
                              {t.label}
                            </TabButton>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
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
        {tab === "strategist" && <StrategistTab />}
        {tab === "operatingSystem" && <OperatingSystemTab />}
        {tab === "automation" && <AutomationTab />}
        {tab === "system" && <SystemTab />}
        {tab === "ytKeywordResearch" && (
          <ComingSoonTab
            title="YouTube Keyword Research"
            pillar="SEO"
            description="Video topics ke liye realistically-rankable keywords aur search-intent — website Keyword Research jaisa, lekin YouTube search behavior ke liye tuned."
          />
        )}
        {tab === "ytSeoStudio" && (
          <ComingSoonTab
            title="Video SEO Studio"
            pillar="SEO"
            description="Kisi bhi existing video ki title/description/tags ek click mein optimize karein — TubeBuddy ke 'SEO Studio' jaisa, seedha Publish tab ke YouTube adapter se juda hua."
          />
        )}
        {tab === "ytTagGenerator" && (
          <ComingSoonTab
            title="Tag Generator"
            pillar="SEO"
            description="Kisi bhi video/topic ke liye relevant tags ka poora set generate karein."
          />
        )}
        {tab === "ytChannelAudit" && (
          <ComingSoonTab
            title="Channel Audit"
            pillar="SEO"
            description="Channel ki saari videos scan kar ke underperforming videos flag karein jo dobara optimize karne layak hain — Analytics tab ke data pe based."
          />
        )}
        {tab === "ytThumbnailAB" && (
          <ComingSoonTab
            title="Thumbnail & Title A/B Testing"
            pillar="Marketing"
            description="Ek video ke 2 alag titles/thumbnails generate kar ke test karein, phir Analytics data se dekhein kaunsa behtar chal raha hai."
          />
        )}
        {tab === "ytBulkOptimizer" && (
          <ComingSoonTab
            title="Bulk Video Optimizer"
            pillar="Marketing"
            description="Poori channel ki purani videos ki description/tags/CTA ek sath update karein (manual approval ke sath, kyunke ye bulk/high-risk action hai)."
          />
        )}
        {tab === "ytCommunityPosts" && (
          <ComingSoonTab
            title="Community Post Generator"
            pillar="Marketing"
            description="Channel ke 'Community' tab ke liye engagement posts (polls, updates, teasers) generate karein."
          />
        )}
        {tab === "ytPerformanceAnalytics" && (
          <ComingSoonTab
            title="Video Performance Analytics"
            pillar="Analytics"
            description="Har video ka detailed views/watch-time/CTR breakdown — abhi ke Analytics tab se zyada detailed, per-video trend history ke sath."
          />
        )}
        {tab === "ytCompetitorTracking" && (
          <ComingSoonTab
            title="Competitor Channel Tracking"
            pillar="Analytics"
            description="Doosre YouTube channels ka public data (subscribers, upload frequency, view trends) track karein comparison ke liye."
          />
        )}
        {tab === "ytRetentionInsights" && (
          <ComingSoonTab
            title="Watch Time & Retention Insights"
            pillar="Analytics"
            description="YouTube Analytics API se deeper watch-time/audience-retention data — alag OAuth scope chahiye hoga (abhi sirf basic Data API stats hain)."
          />
        )}
        {tab === "fbPageSeo" && (
          <ComingSoonTab
            title="Page & Post Discovery Optimization"
            pillar="SEO"
            description="Facebook Page ki 'About' info, category, aur post text ko Facebook ke apne search/discovery aur Google indexing (public pages) ke liye optimize karein."
          />
        )}
        {tab === "fbHashtagResearch" && (
          <ComingSoonTab
            title="Hashtag & Keyword Research"
            pillar="SEO"
            description="Niche ke liye Facebook par relevant, abhi trending hashtags aur keywords dhoondein — web search se real data ke sath."
          />
        )}
        {tab === "fbPostAB" && (
          <ComingSoonTab
            title="Post A/B Testing"
            pillar="Marketing"
            description="Ek hi topic ke 2 alag post variations generate karein, phir engagement data se dekhein kaunsa behtar chalta hai."
          />
        )}
        {tab === "fbBulkScheduler" && (
          <ComingSoonTab
            title="Bulk Post Scheduler"
            pillar="Marketing"
            description="Multiple posts ek sath schedule/generate karein Content Calendar se juda hua — manual approval ke sath."
          />
        )}
        {tab === "fbEngagementAssistant" && (
          <ComingSoonTab
            title="Comment & Engagement Assistant"
            pillar="Marketing"
            description="Page ke comments par AI-drafted replies suggest karein — approval ke baad hi bhejein jayein."
          />
        )}
        {tab === "fbPostAnalytics" && (
          <ComingSoonTab
            title="Post Performance Analytics"
            pillar="Analytics"
            description="Har post ka detailed reach/likes/comments/shares breakdown — abhi ke Analytics tab se zyada detailed, per-post trend history ke sath."
          />
        )}
        {tab === "fbCompetitorTracking" && (
          <ComingSoonTab
            title="Competitor Page Tracking"
            pillar="Analytics"
            description="Doosre Facebook Pages ka public data (followers, post frequency, engagement trends) track karein comparison ke liye."
          />
        )}
        {tab === "fbAudienceInsights" && (
          <ComingSoonTab
            title="Audience Insights"
            pillar="Analytics"
            description="Page followers ki demographics aur engagement patterns — Meta ki apni data availability policies ke against depend karega."
          />
        )}
      </div>
    </main>
  );
}

function ComingSoonTab({
  title,
  pillar,
  description,
}: {
  title: string;
  pillar: string;
  description: string;
}) {
  return (
    <section className="border-2 border-dashed border-line bg-white/40 p-8 text-center">
      <span className="inline-block border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink/50">
        {pillar} · Coming Soon
      </span>
      <h2 className="font-head mt-3 text-xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">{description}</p>
    </section>
  );
}

function WorkspaceBar() {
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch("/api/workspaces");
    if (!res.ok) return;
    const data = await res.json();
    const list = data.workspaces || [];
    setWorkspaces(list);
    const saved = window.localStorage.getItem("autoseo.workspaceId");
    const next = list.some((w: any) => w.id === saved) ? saved! : list[0]?.id || "";
    setSelected(next);
    if (next) window.localStorage.setItem("autoseo.workspaceId", next);
  }

  useEffect(() => { load().catch(() => undefined); }, []);

  async function createWorkspace() {
    if (!name.trim()) return;
    setBusy(true); setMessage(null);
    try {
      const res = await apiFetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Workspace create nahi ho saka.");
      window.localStorage.setItem("autoseo.workspaceId", data.workspace.id);
      setName("");
      setMessage("Workspace create ho gaya.");
      await load();
    } catch (e: any) { setMessage(e.message || "Workspace error."); } finally { setBusy(false); }
  }

  if (!workspaces.length) return (
    <div className="mt-5 border-2 border-signal bg-paper p-4">
      <div className="text-sm font-medium text-paper">Apna pehla workspace banayein</div>
      <p className="mt-1 text-xs text-paper/70">Workspace ke baghair production data aur publishing actions available nahi honge.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name" className="border border-paper/30 bg-ink px-3 py-1.5 text-sm text-paper placeholder:text-paper/40" />
        <button onClick={createWorkspace} disabled={busy || !name.trim()} className="border border-signal bg-signal px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40">{busy ? "Creating…" : "Create workspace"}</button>
      </div>
      {message && <span className="mt-2 block text-xs text-paper/70">{message}</span>}
    </div>
  );
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 border border-paper/20 bg-paper/5 p-3">
      <span className="text-xs uppercase tracking-wide text-paper/60">Workspace</span>
      <select value={selected} onChange={(e) => { setSelected(e.target.value); window.localStorage.setItem("autoseo.workspaceId", e.target.value); window.location.reload(); }} className="border border-paper/30 bg-ink px-3 py-1.5 text-sm text-paper">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.role}</option>)}
      </select>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New workspace" className="border border-paper/30 bg-ink px-3 py-1.5 text-sm text-paper placeholder:text-paper/40" />
      <button onClick={createWorkspace} disabled={busy || !name.trim()} className="border border-signal bg-signal px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40">Create</button>
      {message && <span className="text-xs text-paper/70">{message}</span>}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`focus-ring border-2 px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-signal bg-signal text-ink"
          : "border-paper/30 bg-transparent text-paper/80 hover:border-paper/60"
      }`}
    >
      {children}
    </button>
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
  const [language, setLanguage] = useState<Language>("ur");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [videoId, setVideoId] = useState("");
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  const profileReady =
    profile.businessName.trim() && profile.niche.trim() && profile.audience.trim();

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
    } catch (e: any) {
      setError(e.message || "کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔");
    } finally {
      setLoading(false);
    }
  }

  async function sendForApproval() {
    if (!result) return;
    if (channel === "youtube" && !videoId.trim()) {
      setQueueMessage("YouTube ke liye Video ID daalna zaroori hai (jis video ko optimize karna hai).");
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
          metaDescription:
            result.metaDescription || (result.hashtags ? result.hashtags.join(", ") : undefined),
          videoId: channel === "youtube" ? videoId.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Queue mein add nahi hua.");
      setQueueMessage(
        data.queued
          ? "Auto-publish permission on hai — draft durable queue mein chala gaya. Worker isay automatically publish karega."
          : "Approval queue mein bhej diya — 'Publish' tab mein ja kar approve karein."
      );
    } catch (e: any) {
      setQueueMessage(e.message || "Kuch ghalat ho gaya.");
    } finally {
      setQueueLoading(false);
    }
  }

  return (
    <>
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">
          1. اپنے کاروبار کے بارے میں بتائیں
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="کاروبار کا نام"
            value={profile.businessName}
            onChange={(v) => setProfile({ ...profile, businessName: v })}
            placeholder="مثال: Karachi Smart Travel & Tour Services"
          />
          <Field
            label="شعبہ / نچ"
            value={profile.niche}
            onChange={(v) => setProfile({ ...profile, niche: v })}
            placeholder="مثال: بس ٹکٹ بکنگ"
          />
          <Field
            label="ٹارگٹ آڈینس"
            value={profile.audience}
            onChange={(v) => setProfile({ ...profile, audience: v })}
            placeholder="مثال: پاکستان بھر کے مسافر"
          />
          <Field
            label="برانڈ کا لہجہ"
            value={profile.tone}
            onChange={(v) => setProfile({ ...profile, tone: v })}
            placeholder="مثال: دوستانہ اور بھروسہ مند"
          />
        </div>
      </section>

      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">
          2. چینل اور موضوع منتخب کریں
        </h2>

        <div className="mt-4 flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setChannel(c.id);
                setResult(null);
                setQueueMessage(null);
              }}
              className={`focus-ring border px-4 py-2 text-sm transition ${
                channel === c.id
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-white text-ink hover:border-ink"
              }`}
            >
              <span className="font-medium">{c.label}</span>
              <span className="mx-2 text-xs opacity-70">{c.note}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => setLanguage(l.id)}
              className={`focus-ring border px-3 py-1.5 text-sm transition ${
                language === l.id
                  ? "border-signal bg-signal/20 text-ink"
                  : "border-line bg-white text-ink hover:border-signal"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Field
            label="موضوع"
            value={topic}
            onChange={setTopic}
            placeholder="مثال: کراچی سے سوات بس ٹکٹ صرف 1000 روپے میں"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={!profileReady || !topic.trim() || loading}
          className="focus-ring mt-5 w-full border-2 border-ink bg-signal py-3 font-medium text-ink transition hover:bg-ink hover:text-signal disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-ink/40"
        >
          {loading ? "بن رہا ہے…" : "Content بنائیں"}
        </button>

        {error && (
          <p className="mt-3 border border-clay bg-clay/10 px-3 py-2 text-sm text-clay">
            {error}
          </p>
        )}
      </section>

      {result && (
        <section className="mt-6 border-2 border-ink bg-white p-6">
          <h2 className="font-head text-lg font-semibold text-ink">Draft</h2>
          <p className="mt-3 text-sm uppercase tracking-wide text-clay">Title</p>
          <p className="font-head text-xl text-ink">{result.title}</p>

          {result.metaDescription && (
            <>
              <p className="mt-4 text-sm uppercase tracking-wide text-clay">
                Meta Description
              </p>
              <p className="text-ink">{result.metaDescription}</p>
            </>
          )}

          <p className="mt-4 text-sm uppercase tracking-wide text-clay">Body</p>
          <p className="whitespace-pre-wrap leading-relaxed text-ink">{result.body}</p>

          {result.hashtags && result.hashtags.length > 0 && (
            <>
              <p className="mt-4 text-sm uppercase tracking-wide text-clay">Hashtags</p>
              <p className="text-ink">{result.hashtags.join("  ")}</p>
            </>
          )}

          <div className="mt-6 border-t border-line pt-4">
            {channel === "youtube" && (
              <div className="mb-3">
                <Field
                  label="Video ID (jis existing video ko optimize karna hai)"
                  value={videoId}
                  onChange={setVideoId}
                  placeholder="مثال: dQw4w9WgXcQ (YouTube URL کا آخری حصہ)"
                />
                <p className="mt-1 text-xs text-ink/50">
                  YouTube API sirf existing video ki title/description/tags update kar sakti
                  hai — nayi video upload text se nahi ho sakti.
                </p>
              </div>
            )}
            <button
              onClick={sendForApproval}
              disabled={queueLoading}
              className="focus-ring w-full border-2 border-ink bg-paper py-2.5 font-medium text-ink transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              {queueLoading
                ? "بھیجا جا رہا ہے…"
                : `${CHANNELS.find((c) => c.id === channel)?.label} Publish کے لیے بھیجیں`}
            </button>
            {queueMessage && <p className="mt-2 text-sm text-ink/70">{queueMessage}</p>}
          </div>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------
// Tab 2: SEO Analyzer (Phase 2)
// ---------------------------------------------------------------------

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-clay bg-clay/10 text-clay",
  medium: "border-signal bg-signal/10 text-ink",
  low: "border-line bg-white text-ink/70",
};

const SEVERITY_LABEL: Record<string, string> = {
  high: "زیادہ اہم",
  medium: "درمیانہ",
  low: "معمولی",
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
    } catch (e: any) {
      setError(e.message || "کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔");
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
    } catch (e: any) {
      setFixesError(e.message || "Fixes generate nahi ho sakin.");
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
          ? "Auto-publish permission on hai — SEO fix durable queue mein chala gaya. Worker isay automatically apply karega."
          : "Fix approval queue mein bhej diya — 'Publish' tab mein ja kar approve karein."
      );
    } catch (e: any) {
      setApplyMessage(e.message || "Kuch ghalat ho gaya.");
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <>
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">
          ویب سائٹ کا URL درج کریں
        </h2>
        <div className="mt-4 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="مثال: kstts.com"
            className="focus-ring flex-1 border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
          />
          <button
            onClick={handleAnalyze}
            disabled={!url.trim() || loading}
            className="focus-ring border-2 border-ink bg-signal px-5 py-2 font-medium text-ink transition hover:bg-ink hover:text-signal disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-ink/40"
          >
            {loading ? "چیک ہو رہا ہے…" : "Analyze کریں"}
          </button>
        </div>
        {error && (
          <p className="mt-3 border border-clay bg-clay/10 px-3 py-2 text-sm text-clay">
            {error}
          </p>
        )}
      </section>

      {analysis && (
        <section className="mt-6 border-2 border-ink bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-head text-lg font-semibold text-ink">SEO Score</h2>
            <span className="font-head text-3xl text-signal" dir="ltr">{analysis.score}/100</span>
          </div>
          <p className="mt-2 text-ink/80">{analysis.summary}</p>

          <div className="mt-5 space-y-3">
            {analysis.issues.map((issue, i) => (
              <div
                key={i}
                className={`border p-3 ${SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.low}`}
              >
                <p className="text-xs font-medium uppercase tracking-wide">
                  {SEVERITY_LABEL[issue.severity] || issue.severity}
                </p>
                <p className="mt-1 font-medium text-ink">{issue.issue}</p>
                <p className="mt-1 text-sm text-ink/80">{issue.fix}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <button
              onClick={handleGenerateFixes}
              disabled={fixesLoading}
              className="focus-ring w-full border-2 border-ink bg-paper py-2.5 font-medium text-ink transition hover:bg-ink hover:text-paper disabled:opacity-50"
            >
              {fixesLoading ? "بن رہا ہے…" : "Fixes Generate کریں"}
            </button>
            {fixesError && <p className="mt-2 text-sm text-clay">{fixesError}</p>}
          </div>

          {fixes && (
            <div className="mt-4 border border-ink bg-paper p-4">
              <p className="text-sm uppercase tracking-wide text-clay">Corrected Title</p>
              <p className="font-head text-lg text-ink">{fixes.title}</p>

              <p className="mt-3 text-sm uppercase tracking-wide text-clay">
                Corrected Meta Description
              </p>
              <p className="text-ink">{fixes.metaDescription}</p>

              {fixes.suggestedHeadings.length > 0 && (
                <>
                  <p className="mt-3 text-sm uppercase tracking-wide text-clay">
                    Suggested H2 Headings
                  </p>
                  <ul className="list-inside list-disc text-ink">
                    {fixes.suggestedHeadings.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </>
              )}

              <p className="mt-3 text-sm uppercase tracking-wide text-clay">Schema Markup (JSON-LD)</p>
              <pre className="mt-1 overflow-x-auto bg-white p-3 text-xs text-ink/80">
                {fixes.schemaJsonLd}
              </pre>

              <p className="mt-3 text-sm text-ink/60">{fixes.rationale}</p>

              <button
                onClick={handleSendFixForApproval}
                disabled={applyLoading}
                className="focus-ring mt-4 w-full border-2 border-ink bg-signal py-2.5 font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
              >
                {applyLoading ? "بھیجا جا رہا ہے…" : "Website پر Fix Apply کرنے کے لیے بھیجیں"}
              </button>
              {applyMessage && <p className="mt-2 text-sm text-ink/70">{applyMessage}</p>}
              <p className="mt-2 text-xs text-ink/50">
                Custom sites: title + meta + headings + schema سب apply ہو سکتے ہیں (agar receiver
                endpoint support kare). WordPress: sirf title + meta apply hote hain — schema/headings
                yahan se copy kar ke manually daalne honge.
              </p>
            </div>
          )}

          {crawl && (
            <details className="mt-5 border-t border-line pt-3">
              <summary className="cursor-pointer text-sm text-ink/60">
                Raw crawl data دیکھیں
              </summary>
              <pre className="mt-2 overflow-x-auto bg-paper p-3 text-xs text-ink/70">
                {JSON.stringify(crawl, null, 2)}
              </pre>
            </details>
          )}
        </section>
      )}
    </>
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
  pending: "منظوری کا منتظر",
  approved: "منظور شدہ",
  published: "شائع ہو گیا",
  rejected: "مسترد",
  failed: "ناکام",
};

const STATUS_STYLE: Record<QueueDraft["status"], string> = {
  pending: "border-signal bg-signal/10 text-ink",
  approved: "border-line bg-white text-ink/70",
  published: "border-ink bg-ink/5 text-ink",
  rejected: "border-line bg-white text-ink/40",
  failed: "border-clay bg-clay/10 text-clay",
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
          value === "suggest"
            ? "border-ink bg-ink text-paper"
            : "border-line bg-white text-ink/70 hover:border-ink"
        }`}
      >
        Suggest only (منظوری چاہیے)
      </button>
      <button
        onClick={() => onChange("auto")}
        className={`focus-ring border px-3 py-1.5 text-xs transition ${
          value === "auto"
            ? "border-signal bg-signal text-ink"
            : "border-line bg-white text-ink/70 hover:border-signal"
        }`}
      >
        Auto-publish (بغیر منظوری)
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

  useEffect(() => {
    loadSettings();
    loadDrafts();
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth") === "success") {
      const provider = params.get("provider") || "platform";
      setYtMsg(provider === "google-youtube" ? "YouTube OAuth connected successfully." : null);
      setFbMsg(provider === "facebook" ? "Facebook OAuth connected successfully." : null);
      setGscMsg(provider === "google-search-console" ? "Google Search Console connected successfully." : null);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("oauth") === "error") {
      const message = params.get("message") || "OAuth connection failed.";
      setYtMsg(message); setFbMsg(message); setGscMsg(message);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function connectWebsite() {
    setWebsiteBusy(true);
    setWebsiteMsg(null);
    try {
      const payload =
        websitePlatformType === "wordpress"
          ? { platform: "website", platformType: "wordpress", siteUrl, username, applicationPassword, permission: websitePermission }
          : websitePlatformType === "shopify"
          ? { platform: "website", platformType: "shopify", shopDomain, accessToken: shopifyToken, permission: websitePermission }
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
    } catch (e: any) {
      setWebsiteConnected(false);
      setWebsiteMsg(e.message || "Connect nahi ho saka.");
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
    } catch (e: any) {
      setYtConnected(false);
      setYtMsg(e.message || "Connect nahi ho saka.");
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
    } catch (e: any) {
      setFbConnected(false);
      setFbMsg(e.message || "Connect nahi ho saka.");
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
            Custom Site (Next.js جیسی)
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
            <Field label="Webhook URL" value={webhookUrl} onChange={setWebhookUrl} placeholder="https://kstts.com/api/autoseo-publish" />
            <SecretField label="API Key" value={apiKey} onChange={setApiKey} />
          </div>
        ) : websitePlatformType === "shopify" ? (
          <>
            <p className="mt-3 text-sm text-ink/60">
              Shopify Admin → Settings → Apps and sales channels → Develop apps → ایک نیا app
              بنائیں، Admin API میں "write_content" scope on کریں، install کریں، اور Admin API
              access token یہاں پیسٹ کریں — کوئی کوڈ نہیں لکھنا۔
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
            <div className="sm:col-span-2"><SecretField label="Application Password" value={applicationPassword} onChange={setApplicationPassword} /></div>
          </div>
        )}

        <PermissionToggle value={websitePermission} onChange={setWebsitePermission} />

        <button
          onClick={connectWebsite}
          disabled={websiteBusy}
          className="focus-ring mt-4 border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
        >
          {websiteBusy ? "Connect ہو رہا ہے…" : "Connect / Update کریں"}
        </button>
        {websiteMsg && <p className={`mt-2 text-sm ${websiteConnected ? "text-ink/70" : "text-clay"}`}>{websiteMsg}</p>}
        {websiteConnected && !websiteMsg && <p className="mt-2 text-sm text-ink/70">✓ Connected hai.</p>}
      </section>

      {/* YouTube connection */}
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">YouTube</h2>
        <p className="mt-1 text-sm text-ink/60">
          OAuth 2.0 access token chahiye hoga (youtube.force-ssl scope). Ye Google Cloud
          Console mein apna app register kar ke milta hai — details ke liye{" "}
          <code className="bg-paper px-1">docs/youtube-facebook-setup.md</code> dekhein.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={async () => { const r = await apiFetch("/api/oauth/google-youtube"); const d = await r.json(); if (r.ok && d.url) window.location.href = d.url; else setYtMsg(d.error || "OAuth start nahi ho saka."); }} className="focus-ring border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink">Connect with Google OAuth</button>
          <span className="self-center text-xs text-ink/50">Ya legacy token manually use karein:</span>
        </div>
        <div className="mt-3"><SecretField label="Access Token (legacy/manual)" value={ytAccessToken} onChange={setYtAccessToken} /></div>
        <PermissionToggle value={ytPermission} onChange={setYtPermission} />
        <button
          onClick={connectYouTube}
          disabled={!ytAccessToken || ytBusy}
          className="focus-ring mt-4 border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ytBusy ? "Connect ہو رہا ہے…" : "Connect / Update کریں"}
        </button>
        {ytMsg && <p className={`mt-2 text-sm ${ytConnected ? "text-ink/70" : "text-clay"}`}>{ytMsg}</p>}
        {ytConnected && !ytMsg && <p className="mt-2 text-sm text-ink/70">✓ Connected hai.</p>}
      </section>

      {/* Facebook connection */}
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Facebook</h2>
        <p className="mt-1 text-sm text-ink/60">
          Page Access Token chahiye hoga (pages_manage_posts permission). Meta for
          Developers app se milta hai — details{" "}
          <code className="bg-paper px-1">docs/youtube-facebook-setup.md</code> mein hain.
        </p>
        <div className="mt-3">
          <button onClick={async () => { const r = await apiFetch("/api/oauth/facebook"); const d = await r.json(); if (r.ok && d.url) window.location.href = d.url; else setFbMsg(d.error || "OAuth start nahi ho saka."); }} className="focus-ring border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink">Connect with Facebook OAuth</button>
          <p className="mt-2 text-xs text-ink/50">OAuth pehli available Page ko connect karega. Ya legacy Page ID/token manually use karein.</p>
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
          {fbBusy ? "Connect ہو رہا ہے…" : "Connect / Update کریں"}
        </button>
        {fbMsg && <p className={`mt-2 text-sm ${fbConnected ? "text-ink/70" : "text-clay"}`}>{fbMsg}</p>}
        {fbConnected && !fbMsg && <p className="mt-2 text-sm text-ink/70">✓ Connected hai.</p>}
      </section>

      {/* Google Search Console connection */}
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Google Search Console</h2>
        <p className="mt-1 text-sm text-ink/60">Organic clicks, impressions, CTR aur average position ke liye read-only Google OAuth connection.</p>
        <button onClick={async () => { const r = await apiFetch("/api/oauth/google-search-console"); const d = await r.json(); if (r.ok && d.url) window.location.href = d.url; else setGscMsg(d.error || "OAuth start nahi ho saka."); }} className="focus-ring mt-3 border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink">Connect with Google Search Console</button>
        {gscMsg && <p className="mt-2 text-sm text-ink/70">{gscMsg}</p>}
      </section>

      {/* Approval queue */}
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Approval Queue</h2>
        <p className="mt-1 text-sm text-ink/60">
          "Suggest only" mode wale channels ka content yahan manzoori ka intezar karta hai.
          "Auto-publish" wale channels turant publish ho jate hain (yahan sirf log dikhega).
        </p>

        {drafts.length === 0 ? (
          <p className="mt-4 text-sm text-ink/50">Abhi koi draft queue mein nahi hai.</p>
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
                  <a href={d.publishedUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-clay underline">
                    Live دیکھیں →
                  </a>
                )}

                {d.status === "failed" && d.errorMessage && (
                  <p className="mt-2 text-sm text-clay">{d.errorMessage}</p>
                )}

                {d.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleAction(d.id, "approve")}
                      disabled={actingOn === d.id}
                      className="focus-ring border-2 border-ink bg-signal px-4 py-1.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
                    >
                      {actingOn === d.id ? "…" : "Approve اور Publish کریں"}
                    </button>
                    <button
                      onClick={() => handleAction(d.id, "reject")}
                      disabled={actingOn === d.id}
                      className="focus-ring border border-line bg-white px-4 py-1.5 text-sm text-ink/70 transition hover:border-clay hover:text-clay disabled:opacity-50"
                    >
                      Reject کریں
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
    siteUrl?: string; clicks?: number; impressions?: number; ctr?: number; averagePosition?: number | null; rows?: number; periodStart?: string; periodEnd?: string; error?: string;
  } | null;
  snapshots: Array<{ provider: string; period_start: string; period_end: string; metrics: { clicks?: number; impressions?: number; ctr?: number; averagePosition?: number | null } }>;
}


function KeywordResearchTab() {
  const [seedKeyword, setSeedKeyword] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [name, setName] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadProjects() {
    const r = await apiFetch("/api/keyword-research");
    if (r.ok) setProjects((await r.json()).projects || []);
  }
  useEffect(() => { loadProjects().catch(() => undefined); }, []);

  async function research() {
    setBusy(true); setMessage(null);
    try {
      const r = await apiFetch("/api/keyword-research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seedKeyword, targetUrl, name }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Keyword research failed.");
      setSelected(d.project); setOpportunities(d.opportunities || []); setMessage(`${d.opportunities?.length || 0} keyword opportunities generate ho gayi hain.`);
      await loadProjects();
    } catch (e: any) { setMessage(e.message || "Keyword research error."); } finally { setBusy(false); }
  }
  async function openProject(id: string) {
    const r = await apiFetch(`/api/keyword-research/${id}`); if (!r.ok) return;
    const d = await r.json(); setSelected(d.project); setOpportunities(d.opportunities || []);
  }
  const tierClass = (tier:string) => tier === "priority" ? "border-2 border-signal" : tier === "strong" ? "border border-ink" : "border border-line";
  return <>
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">Advanced Keyword Research</h2>
      <p className="mt-2 text-sm text-ink/60">Seed keyword se related, question, modifier, page aur optional Search Console queries discover karein. Opportunity score deterministic signals par based hai; fake search-volume numbers generate nahi kiye jate.</p>
      <div className="mt-5 grid gap-3">
        <input value={seedKeyword} onChange={e=>setSeedKeyword(e.target.value)} placeholder="Seed keyword — e.g. bus booking Karachi" className="border border-line bg-white px-3 py-2 text-sm" />
        <input value={targetUrl} onChange={e=>setTargetUrl(e.target.value)} placeholder="Optional target URL for on-page opportunity signals" className="border border-line bg-white px-3 py-2 text-sm" />
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Research project name (optional)" className="border border-line bg-white px-3 py-2 text-sm" />
        <button disabled={busy||!seedKeyword.trim()} onClick={research} className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium text-ink disabled:opacity-40">{busy?"Researching…":"Research keywords"}</button>
        {message&&<p className="text-xs text-ink/60">{message}</p>}
      </div>
    </section>
    <section className="mt-6 border border-line bg-white/60 p-6">
      <h3 className="font-head text-base font-semibold text-ink">Saved research</h3>
      <div className="mt-3 space-y-2">{projects.map(p=><button key={p.id} onClick={()=>openProject(p.id)} className="block w-full border border-line bg-white px-3 py-3 text-left text-sm hover:border-ink"><span className="font-medium">{p.name}</span><span className="ml-2 text-xs text-ink/50">{p.seedKeyword}</span></button>)}{!projects.length&&<p className="text-sm text-ink/50">Abhi koi keyword research project nahi hai.</p>}</div>
    </section>
    {selected&&<section className="mt-6">
      <div className="border border-line bg-white/60 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-head text-base font-semibold">{selected.name}</h3><p className="mt-1 text-xs text-ink/50">Seed: {selected.seedKeyword} · {selected.summary?.total || opportunities.length} candidates · GSC: {selected.summary?.gscConnected ? "connected" : "not connected"}</p></div><div className="grid grid-cols-4 gap-2 text-center text-[11px]"><span className="border border-signal px-2 py-1">Priority {selected.summary?.priority ?? 0}</span><span className="border border-line px-2 py-1">Strong {selected.summary?.strong ?? 0}</span><span className="border border-line px-2 py-1">Watch {selected.summary?.watch ?? 0}</span><span className="border border-line px-2 py-1">Low {selected.summary?.low ?? 0}</span></div></div></div>
      <div className="mt-3 space-y-2">{opportunities.map((o:any)=><div key={o.id} className={`${tierClass(o.tier)} bg-white/60 p-4`}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium text-ink">{o.keyword}</p><p className="mt-1 text-xs text-ink/50">{o.intent} · {o.recommendedContentType} · source: {o.source}</p></div><div className="text-right"><p className="text-lg font-semibold">{o.opportunityScore}</p><p className="text-[10px] uppercase text-ink/40">opportunity</p></div></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-ink/60 sm:grid-cols-4"><span>Relevance {o.relevanceScore}</span><span>Difficulty {o.difficultyScore}</span><span>Content fit {o.contentFitScore}</span><span>Current signal {o.currentSignalScore}</span></div><p className="mt-3 text-xs text-ink/70">{o.recommendation}</p></div>)}
      </div>
    </section>}
  </>;
}

function CompetitorIntelligenceTab() {
  const [targetUrl,setTargetUrl]=useState(""); const [competitorUrls,setCompetitorUrls]=useState(["",""]); const [name,setName]=useState("");
  const [projects,setProjects]=useState<any[]>([]); const [keywordProjectId,setKeywordProjectId]=useState(""); const [selected,setSelected]=useState<any|null>(null); const [message,setMessage]=useState<string|null>(null); const [busy,setBusy]=useState(false);
  async function load(){const r=await apiFetch("/api/keyword-research");if(r.ok)setProjects((await r.json()).projects||[]);} useEffect(()=>{load().catch(()=>undefined)},[]);
  async function run(){setBusy(true);setMessage(null);try{const urls=competitorUrls.map(x=>x.trim()).filter(Boolean);const r=await apiFetch("/api/competitors",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,targetUrl,competitorUrls:urls,keywordProjectId:keywordProjectId||undefined})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Competitor analysis failed.");setSelected(d.project);setMessage("Competitor analysis complete ho gaya.");}catch(e:any){setMessage(e.message||"Competitor analysis error.")}finally{setBusy(false)}}
  async function open(id:string){const r=await apiFetch(`/api/competitors/${id}`);if(r.ok)setSelected((await r.json()).project)}
  const gaps=selected?.analysis?.gaps||[]; const by=(t:string)=>gaps.filter((g:any)=>g.gapType===t); 
  return <>
    <section className="border border-line bg-white/60 p-6"><h2 className="font-head text-lg font-semibold">Competitor Intelligence</h2><p className="mt-2 text-sm text-ink/60">Target website ko public competitor sites ke against compare karein: keyword gaps, content gaps aur technical SEO opportunities. Analysis bounded aur SSRF-safe public crawling par based hai.</p>
      <div className="mt-5 grid gap-3"><input value={targetUrl} onChange={e=>setTargetUrl(e.target.value)} placeholder="Your target URL — https://example.com" className="border border-line bg-white px-3 py-2 text-sm"/>
      {competitorUrls.map((u,i)=><input key={i} value={u} onChange={e=>setCompetitorUrls(a=>a.map((x,j)=>j===i?e.target.value:x))} placeholder={`Competitor URL ${i+1} — https://competitor.com`} className="border border-line bg-white px-3 py-2 text-sm"/>)}
      <button onClick={()=>setCompetitorUrls(a=>a.length<5?[...a,""]:a)} disabled={competitorUrls.length>=5} className="border border-line px-3 py-2 text-xs text-left disabled:opacity-40">+ Add another competitor</button>
      <select value={keywordProjectId} onChange={e=>setKeywordProjectId(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Optional: V23 keyword project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name} — {p.seedKeyword}</option>)}</select>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Analysis name (optional)" className="border border-line bg-white px-3 py-2 text-sm"/><button disabled={busy||!targetUrl.trim()||competitorUrls.every(x=>!x.trim())} onClick={run} className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40">{busy?"Analyzing…":"Run competitor analysis"}</button>{message&&<p className="text-xs text-ink/60">{message}</p>}</div>
    </section>
    {selected&&<section className="mt-6"><div className="grid grid-cols-2 gap-2 sm:grid-cols-6">{[["Competitors",selected.summary.competitors],["Target pages",selected.summary.targetPages],["Comp pages",selected.summary.competitorPages],["Keyword gaps",selected.summary.keywordGaps],["Content gaps",selected.summary.contentGaps],["Technical",selected.summary.technicalGaps]].map(([k,v])=><div key={String(k)} className="border border-line bg-white/60 p-3 text-center"><div className="text-lg font-semibold">{v}</div><div className="text-[10px] uppercase text-ink/40">{k}</div></div>)}</div>
      <div className="mt-4 border border-signal bg-white/60 p-5"><p className="text-xs uppercase text-ink/40">Opportunity score</p><p className="text-3xl font-semibold">{selected.summary.opportunityScore}/100</p><div className="mt-3 space-y-1 text-xs text-ink/70">{(selected.analysis.recommendations||[]).map((r:string,i:number)=><p key={i}>• {r}</p>)}</div></div>
      {[["Keyword gaps",by("keyword")],["Content gaps",by("content")],["Technical gaps",by("technical")]].map(([title,list]:any)=><div key={title} className="mt-5"><h3 className="font-head text-base font-semibold">{title}</h3><div className="mt-2 space-y-2">{list.slice(0,20).map((g:any,i:number)=><div key={i} className="border border-line bg-white/60 p-4"><div className="flex justify-between gap-3"><div><p className="font-medium">{g.keyword||g.recommendation}</p><p className="mt-1 text-xs text-ink/50">{g.severity} · competitor: {g.competitorUrl}</p></div><span className="text-lg font-semibold">{g.score}</span></div><p className="mt-2 text-xs text-ink/70">{g.recommendation}</p>{g.evidenceUrls?.length>0&&<p className="mt-2 break-all text-[10px] text-ink/40">Evidence: {g.evidenceUrls.join(" · ")}</p>}</div>)}{!list.length&&<p className="text-sm text-ink/50">Is category mein koi gap nahi mila.</p>}</div></div>)}
    </section>}
  </>;
}


function ContentStrategyTab() {
  const [keywordProjects,setKeywordProjects]=useState<any[]>([]); const [competitorProjects,setCompetitorProjects]=useState<any[]>([]);
  const [keywordProjectId,setKeywordProjectId]=useState(""); const [competitorProjectId,setCompetitorProjectId]=useState(""); const [name,setName]=useState("");
  const [projects,setProjects]=useState<any[]>([]); const [selected,setSelected]=useState<any|null>(null); const [message,setMessage]=useState<string|null>(null); const [busy,setBusy]=useState(false);
  async function load(){const [k,c,s]=await Promise.all([apiFetch("/api/keyword-research"),apiFetch("/api/competitors"),apiFetch("/api/content-strategy")]);if(k.ok)setKeywordProjects((await k.json()).projects||[]);if(c.ok)setCompetitorProjects((await c.json()).projects||[]);if(s.ok)setProjects((await s.json()).projects||[]);}
  useEffect(()=>{load().catch(()=>undefined)},[]);
  async function run(){setBusy(true);setMessage(null);try{const r=await apiFetch("/api/content-strategy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,keywordProjectId,competitorProjectId:competitorProjectId||undefined})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Strategy generation failed.");setSelected(d.project);setMessage("Content strategy complete ho gayi.");await load();}catch(e:any){setMessage(e.message||"Content strategy error.")}finally{setBusy(false)}}
  async function open(id:string){const r=await apiFetch(`/api/content-strategy/${id}`);if(r.ok)setSelected((await r.json()).project)}
  const strategy=selected?.strategy||{};
  return <>
    <section className="border border-line bg-white/60 p-6"><h2 className="font-head text-lg font-semibold">Topic & Content Strategy</h2><p className="mt-2 text-sm text-ink/60">V23 keyword opportunities ko structured topic clusters, pillar pages aur supporting content plan mein convert karein. Optional V24 competitor gaps priority ko reinforce karte hain.</p>
      <div className="mt-5 grid gap-3"><select value={keywordProjectId} onChange={e=>setKeywordProjectId(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Select V23 keyword project</option>{keywordProjects.map(p=><option key={p.id} value={p.id}>{p.name} — {p.seedKeyword}</option>)}</select>
      <select value={competitorProjectId} onChange={e=>setCompetitorProjectId(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Optional: V24 competitor project</option>{competitorProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Strategy name (optional)" className="border border-line bg-white px-3 py-2 text-sm"/>
      <button disabled={busy||!keywordProjectId} onClick={run} className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40">{busy?"Building strategy…":"Build content strategy"}</button>{message&&<p className="text-xs text-ink/60">{message}</p>}</div></section>
    <section className="mt-6 border border-line bg-white/60 p-6"><h3 className="font-head text-base font-semibold">Saved strategies</h3><div className="mt-3 space-y-2">{projects.map(p=><button key={p.id} onClick={()=>open(p.id)} className="block w-full border border-line bg-white px-3 py-3 text-left text-sm hover:border-ink"><span className="font-medium">{p.name}</span><span className="ml-2 text-xs text-ink/50">{p.summary?.clusters||0} clusters · {p.summary?.items||0} items</span></button>)}{!projects.length&&<p className="text-sm text-ink/50">Abhi koi content strategy project nahi hai.</p>}</div></section>
    {selected&&<section className="mt-6"><div className="grid grid-cols-2 gap-2 sm:grid-cols-6">{[["Items",strategy.summary?.items],["Clusters",strategy.summary?.clusters],["Critical",strategy.summary?.priority],["High",strategy.summary?.high],["Pillars",strategy.summary?.pillarPages],["Supporting",strategy.summary?.supportingPages]].map(([k,v])=><div key={String(k)} className="border border-line bg-white/60 p-3 text-center"><div className="text-lg font-semibold">{v}</div><div className="text-[10px] uppercase text-ink/40">{k}</div></div>)}</div>
      <div className="mt-5 border border-signal bg-white/60 p-5"><h3 className="font-head text-base font-semibold">Top topic clusters</h3><div className="mt-3 space-y-2">{(strategy.clusters||[]).slice(0,10).map((c:any,i:number)=><div key={i} className="border border-line bg-white p-4"><div className="flex justify-between gap-3"><div><p className="font-medium">{c.name}</p><p className="mt-1 text-xs text-ink/50">Primary: {c.primaryKeyword} · {c.contentType}</p></div><span className="text-lg font-semibold">{c.score}</span></div><p className="mt-2 text-xs text-ink/60">Keywords: {c.keywords.join(" · ")}</p></div>)}</div></div>
      <div className="mt-5"><h3 className="font-head text-base font-semibold">Recommended content plan</h3><div className="mt-2 space-y-2">{(strategy.items||[]).slice(0,30).map((i:any,n:number)=><div key={n} className="border border-line bg-white/60 p-4"><div className="flex justify-between gap-3"><div><p className="font-medium">{i.suggestedTitle}</p><p className="mt-1 text-xs text-ink/50">{i.keyword} · {i.intent} · {i.contentType} · {i.priority}</p></div><span className="text-lg font-semibold">{i.score}</span></div><p className="mt-2 text-xs text-ink/70">{i.rationale}</p>{i.internalLinkTargets?.length>0&&<p className="mt-2 text-[10px] text-ink/40">Link with: {i.internalLinkTargets.join(" · ")}</p>}</div>)}</div></div>
      {(strategy.cannibalization||[]).length>0&&<div className="mt-5 border border-line bg-white/60 p-5"><h3 className="font-head text-base font-semibold">Cannibalization safeguards</h3>{strategy.cannibalization.map((x:string,i:number)=><p key={i} className="mt-2 text-xs text-ink/70">• {x}</p>)}</div>}
    </section>}
  </>;
}

function ContentStudioTab() {
  const [strategies,setStrategies]=useState<any[]>([]); const [projects,setProjects]=useState<any[]>([]);
  const [strategyId,setStrategyId]=useState(""); const [projectId,setProjectId]=useState(""); const [name,setName]=useState("AI Content Studio");
  const [businessName,setBusinessName]=useState(""); const [niche,setNiche]=useState(""); const [audience,setAudience]=useState(""); const [tone,setTone]=useState("Helpful, clear and professional");
  const [language,setLanguage]=useState<Language>("en"); const [channel,setChannel]=useState<Channel>("website"); const [item,setItem]=useState<any|null>(null); const [assets,setAssets]=useState<any[]>([]); const [message,setMessage]=useState<string|null>(null); const [busy,setBusy]=useState(false);
  async function load(){const [s,p]=await Promise.all([apiFetch("/api/content-strategy"),apiFetch("/api/content-studio")]);if(s.ok)setStrategies((await s.json()).projects||[]);if(p.ok)setProjects((await p.json()).projects||[]);}
  useEffect(()=>{load().catch(()=>undefined)},[]);
  async function openProject(id:string){if(!id)return;const r=await apiFetch(`/api/content-studio/${id}`);if(r.ok){const d=await r.json();setProjectId(id);setAssets(d.assets||[]);}}
  async function createProject(){setBusy(true);setMessage(null);try{const r=await apiFetch("/api/content-studio",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,strategyProjectId:strategyId||undefined})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Project create failed.");setProjectId(d.project.id);setAssets([]);await load();setMessage("Studio project ready hai.");}catch(e:any){setMessage(e.message||"Project error.")}finally{setBusy(false)}}
  async function generate(){if(!projectId){setMessage("Pehle Studio project create/select karein.");return;}if(!item){setMessage("Content Strategy se ek content item select karein.");return;}setBusy(true);setMessage(null);try{const r=await apiFetch(`/api/content-studio/${projectId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessName,niche,audience,tone,language,channel,keyword:item.keyword,intent:item.intent,contentType:item.contentType,topic:item.topic||item.keyword,suggestedTitle:item.suggestedTitle,supportingKeywords:[item.keyword],internalLinkTargets:item.internalLinkTargets||[],strategyItem:item})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Generation failed.");setAssets((old)=>[d.asset,...old]);setMessage("AI content generate ho gaya.");}catch(e:any){setMessage(e.message||"Generation error.")}finally{setBusy(false)}}
  async function queue(asset:any){if(!asset?.result)return;setBusy(true);setMessage(null);try{const r=await apiFetch("/api/queue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({channel,title:asset.result.title,body:asset.result.body,metaDescription:asset.result.metaDescription})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Queue failed.");setMessage("Content approval queue mein bhej diya gaya.");}catch(e:any){setMessage(e.message||"Queue error.")}finally{setBusy(false)}}
  const strategy=strategies.find((x)=>x.id===strategyId)?.strategy; const items=strategy?.items||[];
  return <>
    <section className="border border-line bg-white/60 p-6"><h2 className="font-head text-lg font-semibold">AI Content Production Studio</h2><p className="mt-2 text-sm text-ink/60">V25 strategy ko production-ready content mein convert karein. AI factual claims invent nahi karega; missing facts ko flag karega.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><select value={strategyId} onChange={e=>setStrategyId(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Select V25 content strategy</option>{strategies.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={item?.keyword||""} onChange={e=>setItem(items.find((x:any)=>x.keyword===e.target.value)||null)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Select content item</option>{items.map((x:any,i:number)=><option key={i} value={x.keyword}>{x.suggestedTitle} — {x.priority}</option>)}</select><input value={name} onChange={e=>setName(e.target.value)} placeholder="Studio project name" className="border border-line bg-white px-3 py-2 text-sm"/><select value={projectId} onChange={e=>openProject(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Select Studio project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="Business name" className="border border-line bg-white px-3 py-2 text-sm"/><input value={niche} onChange={e=>setNiche(e.target.value)} placeholder="Industry / niche" className="border border-line bg-white px-3 py-2 text-sm"/><input value={audience} onChange={e=>setAudience(e.target.value)} placeholder="Target audience" className="border border-line bg-white px-3 py-2 text-sm"/><input value={tone} onChange={e=>setTone(e.target.value)} placeholder="Brand tone" className="border border-line bg-white px-3 py-2 text-sm"/><select value={language} onChange={e=>setLanguage(e.target.value as Language)} className="border border-line bg-white px-3 py-2 text-sm">{LANGUAGES.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select><select value={channel} onChange={e=>setChannel(e.target.value as Channel)} className="border border-line bg-white px-3 py-2 text-sm">{CHANNELS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
      <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy||!name.trim()} onClick={createProject} className="border border-ink px-4 py-2 text-sm">Create Studio Project</button><button disabled={busy||!projectId||!item||!businessName||!niche||!audience} onClick={generate} className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40">{busy?"Producing…":"Generate Production Content"}</button></div>{message&&<p className="mt-3 text-xs text-ink/60">{message}</p>}</section>
    {item&&<section className="mt-6 border border-signal bg-white/60 p-5"><p className="text-xs uppercase text-ink/40">Selected strategy item</p><h3 className="mt-1 font-head text-lg font-semibold">{item.suggestedTitle}</h3><p className="mt-1 text-xs text-ink/50">{item.keyword} · {item.intent} · {item.contentType} · score {item.score}</p><p className="mt-3 text-sm text-ink/70">{item.rationale}</p></section>}
    <section className="mt-6"><h3 className="font-head text-base font-semibold">Generated assets</h3><div className="mt-3 space-y-4">{assets.map((a:any)=><div key={a.id} className="border border-line bg-white/60 p-5"><div className="flex justify-between gap-3"><div><p className="font-medium">{a.result?.title||a.strategyItem?.suggestedTitle}</p><p className="mt-1 text-xs text-ink/50">{a.status} · {a.strategyItem?.keyword||a.brief?.keyword}</p></div>{a.result&&<button disabled={busy} onClick={()=>queue(a)} className="border border-ink px-3 py-1.5 text-xs">Send to Approval</button>}</div>{a.result&&<><p className="mt-3 text-xs text-ink/60">Meta: {a.result.metaDescription}</p><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap border border-line bg-white p-4 text-xs leading-5 text-ink/80">{a.result.body}</pre>{a.result.qualityNotes?.length>0&&<div className="mt-3 text-xs text-ink/60">Quality notes: {a.result.qualityNotes.join(" · ")}</div>}</>}</div>)}{!assets.length&&<p className="border border-line bg-white/60 p-5 text-sm text-ink/50">Abhi koi generated asset nahi hai.</p>}</div></section>
  </>;
}


function ContentQualityTab() {
  const [projects,setProjects]=useState<any[]>([]); const [projectId,setProjectId]=useState(""); const [assets,setAssets]=useState<any[]>([]); const [assetId,setAssetId]=useState(""); const [report,setReport]=useState<any|null>(null); const [message,setMessage]=useState<string|null>(null); const [busy,setBusy]=useState(false);
  async function load(){const r=await apiFetch("/api/content-studio");if(r.ok)setProjects((await r.json()).projects||[]);}
  useEffect(()=>{load().catch(()=>undefined)},[]);
  async function open(id:string){setProjectId(id);setAssetId("");setReport(null);if(!id){setAssets([]);return;}const r=await apiFetch(`/api/content-studio/${id}`);if(r.ok)setAssets((await r.json()).assets||[]);}
  async function evaluate(){const asset=assets.find(a=>a.id===assetId);if(!asset?.result){setMessage("Generated asset select karein.");return;}setBusy(true);setMessage(null);try{const refs=assets.filter(a=>a.id!==assetId&&a.result?.body).slice(0,5).map(a=>String(a.result.body));const r=await apiFetch("/api/content-quality",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({assetId,title:asset.result.title,body:asset.result.body,metaDescription:asset.result.metaDescription,keyword:asset.brief?.keyword||asset.strategyItem?.keyword,channel:asset.brief?.channel,language:asset.brief?.language,referenceTexts:refs})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Quality evaluation failed.");setReport(d.report);setMessage("Quality aur factual-risk review complete ho gaya.");}catch(e:any){setMessage(e.message||"Quality evaluation error.")}finally{setBusy(false)}}
  return <>
    <section className="border border-line bg-white/60 p-6"><h2 className="font-head text-lg font-semibold">Content Quality & Fact Intelligence</h2><p className="mt-2 text-sm text-ink/60">V26 ke AI content ko publish karne se pehle SEO, readability, structure, originality aur factual-risk signals ke against check karein. Yeh truth verifier nahi — risk detector hai.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><select value={projectId} onChange={e=>open(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Select AI Content Studio project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={assetId} onChange={e=>setAssetId(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Select generated asset</option>{assets.filter(a=>a.result).map(a=><option key={a.id} value={a.id}>{a.result?.title||a.strategyItem?.keyword}</option>)}</select></div>
      <button onClick={evaluate} disabled={busy||!assetId} className="mt-3 border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40">{busy?"Checking…":"Run Quality & Fact Review"}</button>{message&&<p className="mt-3 text-xs text-ink/60">{message}</p>}
    </section>
    {report&&<section className="mt-6 space-y-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="border border-line bg-white/60 p-4 text-center"><div className="font-head text-3xl">{report.score}</div><div className="text-[10px] uppercase text-ink/40">Quality score</div></div><div className="border border-line bg-white/60 p-4 text-center"><div className="font-head text-lg">{report.verdict}</div><div className="text-[10px] uppercase text-ink/40">Verdict</div></div><div className="border border-line bg-white/60 p-4 text-center"><div className="font-head text-2xl">{report.metrics.words}</div><div className="text-[10px] uppercase text-ink/40">Words</div></div><div className="border border-line bg-white/60 p-4 text-center"><div className="font-head text-2xl">{report.metrics.riskClaims}</div><div className="text-[10px] uppercase text-ink/40">Risk claims</div></div></div>
      <div className="border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Factual Risk</h3><p className="mt-2 text-sm">{report.factualReview.status}</p><p className="mt-1 text-xs text-ink/60">{report.factualReview.note}</p>{report.factualReview.claims?.length>0&&<p className="mt-3 text-xs text-ink/70">Review: {report.factualReview.claims.join(" · ")}</p>}</div>
      <div className="border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Metrics</h3><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink/60 sm:grid-cols-4"><span>Avg sentence {report.metrics.avgWordsPerSentence}</span><span>Headings {report.metrics.headings}</span><span>Links {report.metrics.links}</span><span>Keyword density {report.metrics.keywordDensity}%</span><span>Keyword occurrences {report.metrics.keywordOccurrences}</span><span>Reference overlap {Math.round(report.metrics.duplicateSimilarity*100)}%</span></div></div>
      <div className="border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Issues</h3><div className="mt-3 space-y-3">{report.issues?.map((x:any,i:number)=><div key={i} className="border border-line bg-white p-3"><div className="flex justify-between gap-3"><span className="font-medium">{x.issue}</span><span className="text-xs uppercase text-ink/50">{x.severity}</span></div><p className="mt-1 text-xs text-ink/60">{x.category} · {x.fix}</p>{x.evidence&&<p className="mt-1 text-[10px] text-ink/40">Evidence: {x.evidence}</p>}</div>)}{!report.issues?.length&&<p className="text-sm text-ink/50">No issues detected.</p>}</div></div>
      <div className="border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Strengths</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink/70">{report.strengths?.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div></section>}
  </>;
}

function TechnicalSeoTab() {
  const [url,setUrl]=useState(""); const [maxPages,setMaxPages]=useState("25"); const [audit,setAudit]=useState<any|null>(null); const [history,setHistory]=useState<any[]>([]); const [message,setMessage]=useState<string|null>(null); const [busy,setBusy]=useState(false);
  async function load(){const r=await apiFetch("/api/technical-seo");if(r.ok)setHistory((await r.json()).audits||[]);}
  useEffect(()=>{load().catch(()=>undefined)},[]);
  async function run(){if(!url.trim()){setMessage("Website URL enter karein.");return;}setBusy(true);setMessage(null);try{const r=await apiFetch("/api/technical-seo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,maxPages:Number(maxPages)||25})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Technical audit failed.");setAudit(d.audit);setMessage("Technical SEO audit complete ho gaya.");load().catch(()=>undefined);}catch(e:any){setMessage(e.message||"Technical SEO error.")}finally{setBusy(false)}}
  const fixes=audit?.report?.fixes||[];
  return <>
    <section className="border border-line bg-white/60 p-6"><h2 className="font-head text-lg font-semibold">Technical SEO Automation</h2><p className="mt-2 text-sm text-ink/60">Public website ko crawl karke technical SEO issues identify karein aur prioritized, safe remediation plan hasil karein. AutoSEO direct production website files ko bina approval mutate nahi karta.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px_auto]"><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com" className="border border-line bg-white px-3 py-2 text-sm"/><select value={maxPages} onChange={e=>setMaxPages(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="10">10 pages</option><option value="25">25 pages</option><option value="50">50 pages</option></select><button onClick={run} disabled={busy} className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40">{busy?"Auditing…":"Run Technical Audit"}</button></div>{message&&<p className="mt-3 text-xs text-ink/60">{message}</p>}
    </section>
    {audit&&<section className="mt-6 space-y-5"><div className="grid grid-cols-2 gap-2 sm:grid-cols-7">{[["Score",audit.score],["Pages",audit.summary?.pages],["Fixes",audit.summary?.fixes],["Critical",audit.summary?.critical],["High",audit.summary?.high],["Medium",audit.summary?.medium],["Broken links",audit.summary?.brokenLinks]].map(([k,v])=><div key={String(k)} className="border border-line bg-white/60 p-3 text-center"><div className="font-head text-xl">{v}</div><div className="text-[9px] uppercase text-ink/40">{k}</div></div>)}</div>
      <div className="border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Prioritized Fix Plan</h3><div className="mt-3 space-y-3">{fixes.map((x:any)=><div key={x.id} className="border border-line bg-white p-3"><div className="flex justify-between gap-3"><div><span className="font-medium">{x.issue}</span><span className="ml-2 text-[10px] uppercase text-ink/40">{x.kind}</span></div><span className="text-xs uppercase text-ink/50">{x.severity}</span></div><p className="mt-1 text-xs text-ink/60">{x.url}</p><p className="mt-2 text-xs text-ink/70">{x.recommendation}</p><p className="mt-2 text-[10px] uppercase text-ink/40">{x.autoApplicable?"Safe candidate for assisted auto-fix":"Manual review required"}</p></div>)}{!fixes.length&&<p className="text-sm text-ink/50">No technical issues detected by current rules.</p>}</div></div>
      <div className="border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Crawl Summary</h3><div className="mt-3 grid gap-2 text-xs text-ink/60 sm:grid-cols-2"><span>Robots.txt: {audit.report?.site?.robots?.found?"Found":"Not found"}</span><span>Sitemap: {audit.report?.site?.sitemap?.found?"Found":"Not found"}</span><span>Noindex pages: {audit.summary?.noindexPages}</span><span>Discovered URLs: {audit.summary?.discovered}</span></div></div>
    </section>}
    {history.length>0&&<section className="mt-6 border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Recent Technical Audits</h3><div className="mt-3 space-y-2">{history.slice(0,8).map((x:any)=><div key={x.id} className="flex justify-between gap-3 border-b border-line py-2 text-xs"><span className="truncate">{x.target_url}</span><span>{x.score}/100</span></div>)}</div></section>}
  </>;
}


function LocalSeoTab() {
  const [url,setUrl]=useState(""); const [location,setLocation]=useState(""); const [businessName,setBusinessName]=useState(""); const [name,setName]=useState(""); const [maxPages,setMaxPages]=useState("25"); const [keywordProjectId,setKeywordProjectId]=useState(""); const [projects,setProjects]=useState<any[]>([]); const [selected,setSelected]=useState<any>(null); const [keywordProjects,setKeywordProjects]=useState<any[]>([]); const [busy,setBusy]=useState(false); const [message,setMessage]=useState<string|null>(null);
  async function load(){const [a,b]=await Promise.all([apiFetch("/api/local-seo"),apiFetch("/api/keyword-research")]);if(a.ok){const d=await a.json();setProjects(d.projects||[]);}if(b.ok){const d=await b.json();setKeywordProjects(d.projects||[]);}}
  useEffect(()=>{load().catch(()=>undefined)},[]);
  async function open(id:string){if(!id)return;const r=await apiFetch(`/api/local-seo/${id}`);if(r.ok){const d=await r.json();setSelected(d.project);}}
  async function run(){if(!url.trim()||!location.trim()){setMessage("Website URL aur target location enter karein.");return;}setBusy(true);setMessage(null);try{const r=await apiFetch("/api/local-seo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,location,businessName,name,keywordProjectId:keywordProjectId||undefined,maxPages:Number(maxPages)||25})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Local SEO analysis failed.");setSelected(d.project);setMessage("Local SEO analysis complete ho gaya.");await load();}catch(e:any){setMessage(e.message||"Local SEO error.")}finally{setBusy(false)}}
  const a=selected?.analysis||{}; const sum=selected?.summary||{};
  return <section>
    <div className="border border-line bg-white/60 p-6"><h2 className="font-head text-lg font-semibold">Local SEO Intelligence</h2><p className="mt-2 text-sm text-ink/60">Public website ko target location ke against analyze karke local search opportunities, location signals, schema aur local SEO issues identify karein.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com" className="border border-line bg-white px-3 py-2 text-sm"/><input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Karachi, Sindh, Pakistan" className="border border-line bg-white px-3 py-2 text-sm"/><input value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="Business name (optional)" className="border border-line bg-white px-3 py-2 text-sm"/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Project name (optional)" className="border border-line bg-white px-3 py-2 text-sm"/><select value={keywordProjectId} onChange={e=>setKeywordProjectId(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">No keyword project</option>{keywordProjects.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input value={maxPages} onChange={e=>setMaxPages(e.target.value)} type="number" min="5" max="50" className="border border-line bg-white px-3 py-2 text-sm"/></div>
      <div className="mt-3 flex gap-2"><button onClick={run} disabled={busy} className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40">{busy?"Analyzing…":"Analyze Local SEO"}</button><select onChange={e=>open(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Open saved project</option>{projects.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>{message&&<p className="mt-3 text-xs text-ink/60">{message}</p>}
    </div>
    {selected&&<section className="mt-6"><div className="grid grid-cols-2 gap-2 sm:grid-cols-6">{[["Score",sum.score+"/100"],["Pages",sum.pages],["Issues",sum.issues],["Local keywords",sum.localKeywords],["Location signals",sum.locationSignals],["Schema signals",sum.schemaSignals]].map(([k,v])=><div key={String(k)} className="border border-line bg-white/60 p-3 text-center"><div className="text-lg font-semibold">{v}</div><div className="text-[10px] uppercase text-ink/40">{k}</div></div>)}</div>
      <div className="mt-5 border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Local SEO Issues</h3><div className="mt-3 space-y-2">{(a.issues||[]).map((i:any)=><div key={i.key} className="border-b border-line py-3"><div className="flex justify-between gap-3"><p className="text-sm font-medium">{i.title}</p><span className="text-xs font-semibold uppercase">{i.severity} · {i.score}</span></div><p className="mt-1 text-xs text-ink/60">{i.reason}</p><p className="mt-1 text-xs">Fix: {i.recommendation}</p></div>)}{!(a.issues||[]).length&&<p className="text-sm text-ink/50">Koi major local SEO issue nahi mili.</p>}</div></div>
      <div className="mt-5 border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Local Keyword Opportunities</h3><div className="mt-3 space-y-2">{(a.keywordOpportunities||[]).slice(0,30).map((k:any,i:number)=><div key={i} className="flex justify-between gap-3 border-b border-line py-2"><div><p className="text-sm font-medium">{k.keyword}</p><p className="text-xs text-ink/50">{k.intent} · {k.reason}</p></div><span className="font-semibold">{k.score}</span></div>)}</div></div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2"><div className="border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Detected Location Signals</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink/70">{(a.locationSignals||[]).map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div><div className="border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Schema Types</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink/70">{(a.schemaSignals||[]).map((x:string,i:number)=><li key={i}>{x}</li>)}{!(a.schemaSignals||[]).length&&<li>No JSON-LD types detected.</li>}</ul></div></div>
      <div className="mt-5 border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Recommendations</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink/70">{(a.recommendations||[]).map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div>
    </section>}
  </section>
}

function SiteArchitectureTab() {
  const [projects,setProjects]=useState<any[]>([]); const [keywords,setKeywords]=useState<any[]>([]);
  const [projectId,setProjectId]=useState(""); const [url,setUrl]=useState(""); const [name,setName]=useState(""); const [keywordProjectId,setKeywordProjectId]=useState(""); const [maxPages,setMaxPages]=useState("30");
  const [selected,setSelected]=useState<any>(null); const [busy,setBusy]=useState(false); const [message,setMessage]=useState<string|null>(null);
  async function load(){const [a,b]=await Promise.all([apiFetch("/api/site-architecture"),apiFetch("/api/keyword-research")]);if(a.ok){const d=await a.json();setProjects(d.projects||[]);}if(b.ok){const d=await b.json();setKeywords(d.projects||[]);}}
  useEffect(()=>{load().catch(()=>undefined)},[]);
  async function run(){if(!url.trim()){setMessage("Website URL enter karein.");return;}setBusy(true);setMessage(null);try{const r=await apiFetch("/api/site-architecture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,name,keywordProjectId:keywordProjectId||undefined,maxPages:Number(maxPages)||30})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Architecture analysis failed.");setSelected(d.project);setMessage("Internal linking aur site architecture analysis complete ho gaya.");await load();}catch(e:any){setMessage(e.message||"Architecture analysis error.")}finally{setBusy(false)}}
  async function open(id:string){if(!id)return;const r=await apiFetch(`/api/site-architecture/${id}`);if(r.ok)setSelected((await r.json()).project)}
  const a=selected?.analysis||{}; const by=(t:string)=>(a.opportunities||[]).filter((x:any)=>x.type===t);
  return <>
    <section className="border border-line bg-white/60 p-6"><h2 className="font-head text-lg font-semibold">Internal Linking & Site Architecture</h2><p className="mt-2 text-sm text-ink/60">Public website ko crawl karke orphan/weak pages, hub candidates aur contextual internal-link opportunities identify karein. Suggestions reviewable hain; AutoSEO live site ko automatically mutate nahi karta.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com" className="border border-line bg-white px-3 py-2 text-sm"/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Project name (optional)" className="border border-line bg-white px-3 py-2 text-sm"/><select value={keywordProjectId} onChange={e=>setKeywordProjectId(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Optional V23 keyword project</option>{keywords.map((k:any)=><option key={k.id} value={k.id}>{k.name}</option>)}</select><select value={maxPages} onChange={e=>setMaxPages(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="15">15 pages</option><option value="30">30 pages</option><option value="60">60 pages</option></select></div>
      <div className="mt-3 flex gap-2"><button onClick={run} disabled={busy} className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40">{busy?"Analyzing…":"Analyze Architecture"}</button><select value={projectId} onChange={e=>{setProjectId(e.target.value);open(e.target.value)}} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Open saved project</option>{projects.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>{message&&<p className="mt-3 text-xs text-ink/60">{message}</p>}
    </section>
    {selected&&<section className="mt-6"><div className="grid grid-cols-2 gap-2 sm:grid-cols-7">{[["Pages",selected.summary.pages],["Internal links",selected.summary.internalLinks],["Orphans",selected.summary.orphanPages],["Opportunities",selected.summary.linkOpportunities],["Hubs",selected.summary.hubPages],["Weak pages",selected.summary.weakPages],["Score",selected.summary.architectureScore+"/100"]].map(([k,v])=><div key={String(k)} className="border border-line bg-white/60 p-3 text-center"><div className="text-lg font-semibold">{v}</div><div className="text-[10px] uppercase text-ink/40">{k}</div></div>)}</div>
      <div className="mt-5 border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Recommended Internal Links</h3><div className="mt-3 space-y-2">{(a.opportunities||[]).slice(0,30).map((o:any,i:number)=><div key={i} className="border-b border-line py-3"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium">{o.anchorSuggestion}</p><p className="mt-1 break-all text-[10px] text-ink/50">{o.sourceUrl} → {o.targetUrl}</p></div><span className="text-sm font-semibold">{o.score}</span></div><p className="mt-1 text-xs text-ink/60">{o.severity} · {o.reason}</p></div>)}{!(a.opportunities||[]).length&&<p className="text-sm text-ink/50">Koi strong linking opportunity nahi mili.</p>}</div></div>
      <div className="mt-5 border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Architecture Recommendations</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink/70">{(a.recommendations||[]).map((r:string,i:number)=><li key={i}>{r}</li>)}</ul></div>
      {(a.orphanPages||[]).length>0&&<div className="mt-5 border border-line bg-white/60 p-5"><h3 className="font-head font-semibold">Weakly Connected / Orphan Candidates</h3><div className="mt-2 space-y-1 text-xs text-ink/60">{a.orphanPages.slice(0,30).map((u:string)=><div key={u} className="break-all">{u}</div>)}</div></div>}
    </section>}
  </>
}

function ExperimentsTab() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [draftId, setDraftId] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [versions, setVersions] = useState<any[]>([]);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [experiments, setExperiments] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [dRes, eRes] = await Promise.all([apiFetch("/api/queue"), apiFetch("/api/experiments")]);
    if (dRes.ok) setDrafts((await dRes.json()).drafts || []);
    if (eRes.ok) setExperiments((await eRes.json()).experiments || []);
  }
  useEffect(() => { load().catch(() => undefined); }, []);
  useEffect(() => {
    if (!draftId) { setVersions([]); return; }
    const draft = drafts.find((d) => d.id === draftId);
    if (draft?.targetUrl) setTargetUrl(draft.targetUrl);
    apiFetch(`/api/optimization-versions?draftId=${encodeURIComponent(draftId)}`).then(async (r) => setVersions(r.ok ? ((await r.json()).versions || []) : [])).catch(() => setVersions([]));
  }, [draftId, drafts]);

  async function create() {
    setBusy(true); setMessage(null);
    try {
      const r = await apiFetch("/api/experiments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId, targetUrl, variantAVersionId: aId, variantBVersionId: bId }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Experiment create failed.");
      setMessage("Experiment create ho gaya. Ab Variant A start karein."); await load();
    } catch (e: any) { setMessage(e.message || "Experiment error."); } finally { setBusy(false); }
  }
  async function action(id:string, action:string, body?:any) {
    setBusy(true); setMessage(null);
    try { const r=await apiFetch(`/api/experiments/${id}/${action}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body||{}) }); const d=await r.json(); if(!r.ok) throw new Error(d.error||`${action} failed.`); setMessage(`${action} successful.`); await load(); }
    catch(e:any){setMessage(e.message||"Action failed.");} finally{setBusy(false);}
  }
  return <>
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold text-ink">SEO Experimentation</h2>
      <p className="mt-2 text-sm text-ink/60">Do approved optimization versions ko same URL par sequentially compare karein. Yeh randomized traffic A/B test nahi hai; Search Console based measurement hai.</p>
      <div className="mt-5 grid gap-3">
        <select value={draftId} onChange={e=>setDraftId(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Draft select karein</option>{drafts.map(d=><option key={d.id} value={d.id}>{d.title} · {d.status}</option>)}</select>
        <input value={targetUrl} onChange={e=>setTargetUrl(e.target.value)} placeholder="Target URL" className="border border-line bg-white px-3 py-2 text-sm" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={aId} onChange={e=>setAId(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Variant A version</option>{versions.map(v=><option key={v.id} value={v.id}>v{v.versionNumber} · {v.source} · {v.status}</option>)}</select>
          <select value={bId} onChange={e=>setBId(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="">Variant B version</option>{versions.map(v=><option key={v.id} value={v.id}>v{v.versionNumber} · {v.source} · {v.status}</option>)}</select>
        </div>
        <button disabled={busy||!draftId||!targetUrl||!aId||!bId||aId===bId} onClick={create} className="border-2 border-signal bg-signal px-4 py-2 text-sm font-medium text-ink disabled:opacity-40">{busy?"Working…":"Create experiment"}</button>
        {message&&<p className="text-xs text-ink/60">{message}</p>}
      </div>
    </section>
    <section className="mt-6 space-y-3">
      {experiments.map((e:any)=><div key={e.id} className="border border-line bg-white/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-ink">{e.targetUrl}</p><p className="mt-1 text-xs text-ink/50">Status: {e.status} · metric: {e.metric}</p></div><span className="border border-line px-2 py-1 text-xs">{e.id.slice(0,8)}</span></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {e.status==="draft"&&<button disabled={busy} onClick={()=>action(e.id,"start-a")} className="border border-ink px-3 py-1.5 text-xs">Start Variant A</button>}
          {e.status==="running_a"&&<button disabled={busy} onClick={()=>{const end=window.prompt("Variant A end date (YYYY-MM-DD)"); if(end) action(e.id,"start-b",{aEndDate:end});}} className="border border-ink px-3 py-1.5 text-xs">Finish A / Start B</button>}
          {e.status==="running_b"&&<button disabled={busy} onClick={()=>{const start=window.prompt("Observation start date (YYYY-MM-DD)"); const end=window.prompt("Observation end date (YYYY-MM-DD)"); if(start&&end) action(e.id,"observe",{variant:"b",startDate:start,endDate:end});}} className="border border-ink px-3 py-1.5 text-xs">Observe B</button>}
          {e.status!=="draft"&&<button disabled={busy} onClick={()=>action(e.id,"evaluate")} className="border border-ink px-3 py-1.5 text-xs">Evaluate</button>}
          {(e.status==="winner_a"||e.status==="winner_b")&&<button disabled={busy} onClick={()=>action(e.id,"promote")} className="border-2 border-signal bg-signal px-3 py-1.5 text-xs">Promote winner</button>}
        </div>
        {e.result&&<pre className="mt-4 overflow-auto border border-line bg-white p-3 text-[11px] text-ink/70">{JSON.stringify(e.result,null,2)}</pre>}
      </div>)}
      {!experiments.length&&<p className="border border-line bg-white/60 p-5 text-sm text-ink/50">Abhi koi SEO experiment nahi bana.</p>}
    </section>
  </>;
}

function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/analytics")
      .then((res) => res.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-ink/60">Data load ho raha hai…</p>;
  }

  if (!data) {
    return <p className="text-sm text-clay">Analytics data load nahi ho saka.</p>;
  }

  const hasAnyData =
    data.website.scoreHistory.length > 0 || data.youtube || data.facebook || data.searchConsole || data.snapshots.length > 0;

  if (!hasAnyData) {
    return (
      <section className="border border-line bg-white/60 p-6">
        <p className="text-sm text-ink/60">
          Abhi koi data nahi hai. SEO Analyzer se koi website check karein, ya Publish tab se
          YouTube/Facebook connect karein — Analytics yahan khud-ba-khud dikhne lagegi.
        </p>
      </section>
    );
  }

  return (
    <>
      {/* Website: SEO score history */}
      {data.website.scoreHistory.length > 0 && (
        <section className="border border-line bg-white/60 p-6">
          <h2 className="font-head text-lg font-semibold text-ink">Website SEO Score Trend</h2>
          <div className="mt-4 space-y-3">
            {data.website.scoreHistory.map((entry) => (
              <div key={entry.url} className="border border-line bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm text-ink/70">{entry.url}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-head text-xl text-signal" dir="ltr">{entry.latestScore}/100</span>
                    {entry.trend !== null && (
                      <span
                        className={`text-xs ${
                          entry.trend > 0 ? "text-ink" : entry.trend < 0 ? "text-clay" : "text-ink/40"
                        }`}
                      >
                        {entry.trend > 0 ? `▲ +${entry.trend}` : entry.trend < 0 ? `▼ ${entry.trend}` : "— no change"}
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-ink/40">
                  {entry.history.length} check{entry.history.length > 1 ? "s" : ""} so far
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* YouTube */}
      {data.youtube && (
        <section className="mt-6 border border-line bg-white/60 p-6">
          <h2 className="font-head text-lg font-semibold text-ink">YouTube</h2>
          {data.youtube.channelStats && (
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <StatBox label="Subscribers" value={data.youtube.channelStats.subscriberCount} />
              <StatBox label="Total Views" value={data.youtube.channelStats.viewCount} />
              <StatBox label="Videos" value={data.youtube.channelStats.videoCount} />
            </div>
          )}
          {data.youtube.videos.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-ink/60">
                AutoSEO se publish/optimize ki gayi videos:
              </p>
              {data.youtube.videos.map((v) => (
                <div
                  key={v.videoId}
                  className={`border p-3 ${
                    v.underperforming ? "border-clay bg-clay/5" : "border-line bg-white"
                  }`}
                >
                  <p className="text-sm font-medium text-ink">{v.title}</p>
                  <p className="mt-1 text-xs text-ink/60">
                    {v.viewCount} views · {v.likeCount} likes · {v.commentCount} comments
                  </p>
                  {v.underperforming && (
                    <p className="mt-1 text-xs text-clay">
                      Channel average se kaafi kam — title/description dobara optimize karne ka soch sakte hain.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/50">
              Abhi tak AutoSEO se koi video publish/optimize nahi hui.
            </p>
          )}
        </section>
      )}

      {/* Google Search Console */}
      {data.searchConsole && (
        <section className="mt-6 border border-line bg-white/60 p-6">
          <h2 className="font-head text-lg font-semibold text-ink">Google Search Console</h2>
          {data.searchConsole.error ? (
            <p className="mt-3 text-sm text-clay">{data.searchConsole.error}</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-ink/50">{data.searchConsole.siteUrl} · {data.searchConsole.periodStart} → {data.searchConsole.periodEnd}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBox label="Organic Clicks" value={data.searchConsole.clicks || 0} />
                <StatBox label="Impressions" value={data.searchConsole.impressions || 0} />
                <StatBox label="CTR %" value={Number(((data.searchConsole.ctr || 0) * 100).toFixed(2))} />
                <StatBox label="Avg Position" value={Number((data.searchConsole.averagePosition || 0).toFixed(1))} />
              </div>
            </>
          )}
        </section>
      )}

      {/* Facebook */}
      {data.facebook && (
        <section className="mt-6 border border-line bg-white/60 p-6">
          <h2 className="font-head text-lg font-semibold text-ink">Facebook</h2>
          {data.facebook.pageStats && (
            <div className="mt-3">
              <StatBox label="Page Followers" value={data.facebook.pageStats.fanCount} />
            </div>
          )}
          {data.facebook.posts.length > 0 ? (
            <div className="mt-4 space-y-2">
              {data.facebook.posts.map((p) => (
                <div
                  key={p.postId}
                  className={`border p-3 ${
                    p.underperforming ? "border-clay bg-clay/5" : "border-line bg-white"
                  }`}
                >
                  <p className="line-clamp-2 text-sm text-ink">{p.message}</p>
                  <p className="mt-1 text-xs text-ink/60">
                    {p.likeCount} likes · {p.commentCount} comments · {p.shareCount} shares
                  </p>
                  {p.underperforming && (
                    <p className="mt-1 text-xs text-clay">
                      Page average se kaafi kam engagement.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/50">Abhi tak koi recent posts nahi mile.</p>
          )}
        </section>
      )}
    </>
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

function AdvancedAnalyticsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiFetch("/api/analytics/advanced").then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Advanced analytics failed."); setData(d); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <p className="text-sm text-ink/60">Advanced analytics load ho rahi hai…</p>;
  if (error) return <section className="border border-clay bg-white/60 p-6"><p className="text-sm text-clay">{error}</p></section>;
  if (!data) return null;
  const pct = (n:number|null) => n == null ? "—" : `${(n*100).toFixed(2)}%`;
  const delta = data.traffic.delta;
  return <>
    <section className="border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold">Advanced SEO Analytics & ROI</h2>
      <p className="mt-1 text-xs text-ink/50">{data.periodStart} → {data.periodEnd} · previous: {data.previousPeriodStart} → {data.previousPeriodEnd}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Organic Clicks" value={data.traffic.current.clicks} />
        <StatBox label="Impressions" value={data.traffic.current.impressions} />
        <StatBox label="CTR %" value={Number((data.traffic.current.ctr*100).toFixed(2))} />
        <StatBox label="Published Content" value={data.content.published} />
      </div>
      {delta && <div className="mt-4 grid gap-2 sm:grid-cols-4 text-sm">
        <div className="border border-line p-3">Clicks: <b>{delta.clicks >= 0 ? "+" : ""}{delta.clicks}</b></div>
        <div className="border border-line p-3">Impressions: <b>{delta.impressions >= 0 ? "+" : ""}{delta.impressions}</b></div>
        <div className="border border-line p-3">CTR: <b>{pct(delta.ctr)}</b></div>
        <div className="border border-line p-3">Position: <b>{delta.averagePosition == null ? "—" : delta.averagePosition.toFixed(2)}</b></div>
      </div>}
    </section>
    <section className="mt-6 border border-line bg-white/60 p-6">
      <h3 className="font-head font-semibold">SEO & Content Efficiency</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="SEO Score Avg" value={Math.round(data.seo.currentAverage ?? 0)} />
        <StatBox label="Previous SEO Avg" value={Math.round(data.seo.previousAverage ?? 0)} />
        <StatBox label="URLs Tracked" value={data.seo.urls} />
        <StatBox label="Clicks / Content" value={Number((data.roi.clicksPerPublishedContent ?? 0).toFixed(1))} />
      </div>
      <p className="mt-4 text-xs text-ink/50">ROI yahan directional hai: organic clicks revenue nahi hain. Attribution correlation-only hai.</p>
    </section>
    <section className="mt-6 border border-line bg-white/60 p-6">
      <h3 className="font-head font-semibold">Recommended Actions</h3>
      <ul className="mt-3 space-y-2">{data.recommendations.map((r:string,i:number)=><li key={i} className="border border-line bg-white p-3 text-sm">{r}</li>)}</ul>
    </section>
  </>;
}

function MonitoringTab() {
  const [profiles,setProfiles]=useState<any[]>([]); const [snapshots,setSnapshots]=useState<any[]>([]);
  const [name,setName]=useState(""); const [url,setUrl]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState<string|null>(null);
  async function load(){const r=await apiFetch("/api/monitoring"); const d=await r.json(); setProfiles(d.profiles||[]); setSnapshots(d.snapshots||[]);}
  useEffect(()=>{load();},[]);
  async function create(){if(!name.trim()||!url.trim())return; setBusy(true); setMessage(null); try{const r=await apiFetch("/api/monitoring",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,targetUrl:url})}); const d=await r.json(); if(!r.ok)throw new Error(d.error); setName("");setUrl("");await load();}catch(e:any){setMessage(e.message||"Monitoring profile create nahi hua.");}finally{setBusy(false);}}
  async function run(id:string){setBusy(true);setMessage(null);try{const r=await apiFetch("/api/monitoring",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"run",profileId:id})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage(`${d.result.alerts?.length||0} alert(s) detect huay.`);await load();}catch(e:any){setMessage(e.message||"Monitoring run failed.");}finally{setBusy(false);}}
  return <section className="space-y-5">
    <div className="border border-line bg-white/60 p-6"><h2 className="font-head text-lg font-semibold">SEO Monitoring & Alerts</h2><p className="mt-1 text-sm text-ink/60">Technical SEO aur Search Console signals ko snapshots ke sath compare karein. Yeh website ko mutate nahi karta.</p>
      <div className="mt-4 grid gap-2 md:grid-cols-3"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Monitor name" className="border border-line bg-white px-3 py-2"/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com" className="border border-line bg-white px-3 py-2 md:col-span-2"/><button disabled={busy} onClick={create} className="border border-ink bg-ink px-4 py-2 text-white">Create monitor</button></div>{message&&<p className="mt-3 text-sm">{message}</p>}
    </div>
    <div className="border border-line bg-white/60 p-6"><h3 className="font-head font-semibold">Monitoring profiles</h3><div className="mt-3 space-y-2">{profiles.length?profiles.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border border-line p-3"><div><div className="font-medium">{p.name}</div><div className="text-xs text-ink/60">{p.target_url} · {p.frequency}</div></div><button disabled={busy} onClick={()=>run(p.id)} className="border border-line px-3 py-1 text-sm">Run check</button></div>):<p className="text-sm text-ink/60">Abhi koi monitoring profile nahi.</p>}</div></div>
    <div className="border border-line bg-white/60 p-6"><h3 className="font-head font-semibold">Recent snapshots</h3><div className="mt-3 space-y-2">{snapshots.slice(0,10).map((s:any)=><div key={s.id} className="border border-line p-3 text-sm"><div className="flex justify-between gap-2"><span>{s.target_url}</span><span>Score: {s.technical_score ?? "—"}</span></div><div className="mt-1 text-xs text-ink/60">Issues: {s.issue_count} · Alerts: {Array.isArray(s.alerts)?s.alerts.length:0} · {new Date(s.created_at).toLocaleString()}</div></div>)}</div></div>
  </section>;
}

function AutomationTab() {
  // Trend ideas
  const [niche, setNiche] = useState("");
  const [trendLanguage, setTrendLanguage] = useState<Language>("ur");
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
  const [runLanguage, setRunLanguage] = useState<Language>("ur");
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Report
  const [report, setReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    loadCalendar();
  }, []);

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
    } catch (e: any) {
      setIdeasError(e.message || "Kuch ghalat ho gaya.");
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
      setRunMessage("Pehle business profile bharein (neeche).");
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
          ? "Aaj koi item due nahi tha."
          : `${data.processed} item(s) process ho gaye — 'Publish' tab mein check karein.`
      );
      await loadCalendar();
    } catch (e: any) {
      setRunMessage(e.message || "Kuch ghalat ho gaya.");
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
      setReport(data.report || data.error || "Report nahi mila.");
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
        <p className="mt-1 text-sm text-ink/60">
          Web search se abhi ke real trends dekh kar 5 content ideas suggest karega.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="مثال: بس ٹکٹ بکنگ Pakistan"
            className="focus-ring flex-1 border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
          />
          <button
            onClick={fetchIdeas}
            disabled={!niche.trim() || ideasLoading}
            className="focus-ring border-2 border-ink bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ideasLoading ? "…" : "Ideas دیکھیں"}
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
          Topics plan kar ke schedule karein — "Run Due Items" dabane se aaj/pehle ki dates
          wale items khud generate ho jate hain (production mein ye cron se automatic hoga).
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
            className="focus-ring border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="focus-ring border border-line bg-white px-3 py-2 text-ink"
          />
          <button
            onClick={addCalendarItem}
            disabled={!newTopic.trim() || !newDate || calendarBusy}
            className="focus-ring border-2 border-ink bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
          >
            Add کریں
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
          <p className="mb-2 text-sm text-ink/70">
            Due items generate karne ke liye business profile:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label="کاروبار کا نام"
              value={runProfile.businessName}
              onChange={(v) => setRunProfile({ ...runProfile, businessName: v })}
            />
            <Field
              label="شعبہ / نچ"
              value={runProfile.niche}
              onChange={(v) => setRunProfile({ ...runProfile, niche: v })}
            />
            <Field
              label="ٹارگٹ آڈینس"
              value={runProfile.audience}
              onChange={(v) => setRunProfile({ ...runProfile, audience: v })}
            />
            <Field
              label="برانڈ کا لہجہ"
              value={runProfile.tone}
              onChange={(v) => setRunProfile({ ...runProfile, tone: v })}
            />
          </div>
          <button
            onClick={runDueItems}
            disabled={running}
            className="focus-ring mt-3 border-2 border-ink bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {running ? "چل رہا ہے…" : "Run Due Items Now"}
          </button>
          {runMessage && <p className="mt-2 text-sm text-ink/70">{runMessage}</p>}
        </div>
      </section>

      {/* Performance report */}
      <section className="mt-6 border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold text-ink">Performance Report</h2>
        <p className="mt-1 text-sm text-ink/60">
          Analytics tab ka data le kar ek plain-language summary banata hai.
        </p>
        <button
          onClick={fetchReport}
          disabled={reportLoading}
          className="focus-ring mt-3 border-2 border-ink bg-signal px-5 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-signal disabled:opacity-50"
        >
          {reportLoading ? "بن رہا ہے…" : "Report بنائیں"}
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
  const [jobs, setJobs] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [j, h, a, m] = await Promise.all([apiFetch("/api/jobs"), apiFetch("/api/connections/health", { method: "POST" }), apiFetch("/api/audit"), apiFetch("/api/workspaces/members")]);
    if (j.ok) setJobs((await j.json()).jobs || []);
    if (h.ok) setHealth((await h.json()).results || []);
    if (a.ok) setLogs((await a.json()).logs || []);
    if (m.ok) setMembers((await m.json()).members || []);
  }
  useEffect(() => { load().catch(() => undefined); }, []);

  async function invite() {
    setBusy(true); setMessage("");
    try {
      const res = await apiFetch("/api/workspaces/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invite failed.");
      setEmail(""); setMessage("Invite/member add request successful."); await load();
    } catch (e: any) { setMessage(e.message || "Member error."); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <section className="border-2 border-ink bg-white p-6">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-head text-xl font-semibold text-ink">System Health</h2><p className="text-sm text-ink/60">Publishing connections, durable jobs aur recent audit activity.</p></div><button onClick={() => load()} className="border border-line px-3 py-2 text-sm text-ink hover:border-ink">Refresh</button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Queued / Running" value={jobs.filter(j => j.status === "queued" || j.status === "running").length} />
          <Metric label="Failed Jobs" value={jobs.filter(j => j.status === "failed").length} />
          <Metric label="Healthy Connections" value={health.filter(h => h.ok).length} />
        </div>
      </section>

      <section className="border border-line bg-white/60 p-6"><h3 className="font-head text-lg font-semibold text-ink">Connection Health</h3>{health.length ? <div className="mt-3 space-y-2">{health.map(h => <div key={h.id} className="flex justify-between border border-line bg-white p-3 text-sm"><span>{h.provider}</span><span className={h.ok ? "text-ink" : "text-clay"}>{h.ok ? `✓ OK (${h.latencyMs}ms)` : `✕ ${h.message}`}</span></div>)}</div> : <p className="mt-3 text-sm text-ink/50">No connected providers.</p>}</section>

      <section className="border border-line bg-white/60 p-6"><h3 className="font-head text-lg font-semibold text-ink">Job Queue</h3>{jobs.length ? <div className="mt-3 space-y-2">{jobs.slice(0,20).map(j => <div key={j.id} className="border border-line bg-white p-3 text-sm"><div className="flex justify-between"><span className="font-medium">{j.type}</span><span>{j.status}</span></div><div className="mt-1 text-xs text-ink/50">Attempts {j.attempts}/{j.maxAttempts} · Run after {new Date(j.runAfter).toLocaleString()}</div>{j.lastError && <div className="mt-1 text-xs text-clay">{j.lastError}</div>}</div>)}</div> : <p className="mt-3 text-sm text-ink/50">No jobs.</p>}</section>

      <section className="border border-line bg-white/60 p-6"><h3 className="font-head text-lg font-semibold text-ink">Team</h3><div className="mt-3 flex flex-wrap gap-2"><input value={email} onChange={e => setEmail(e.target.value)} placeholder="member@email.com" className="border border-line bg-white px-3 py-2 text-sm"/><select value={role} onChange={e => setRole(e.target.value)} className="border border-line bg-white px-3 py-2 text-sm"><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select><button onClick={invite} disabled={busy || !email} className="border-2 border-ink bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40">Invite / Add</button></div>{message && <p className="mt-2 text-sm text-ink/70">{message}</p>}<div className="mt-4 space-y-2">{members.map(m => <div key={m.user_id} className="flex justify-between border border-line bg-white p-3 text-xs"><span className="font-mono">{m.user_id}</span><span>{m.role}</span></div>)}</div></section>

      <section className="border border-line bg-white/60 p-6"><h3 className="font-head text-lg font-semibold text-ink">Audit Log</h3>{logs.length ? <div className="mt-3 space-y-2">{logs.slice(0,30).map(l => <div key={l.id} className="border border-line bg-white p-3 text-sm"><div className="flex justify-between"><span className="font-medium">{l.action}</span><span className="text-xs text-ink/50">{new Date(l.created_at).toLocaleString()}</span></div><div className="mt-1 text-xs text-ink/50">{l.entity_type || "system"} {l.entity_id || ""}</div></div>)}</div> : <p className="mt-3 text-sm text-ink/50">No audit entries.</p>}</section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="border border-line bg-paper p-4"><div className="text-xs uppercase tracking-wide text-ink/50">{label}</div><div className="mt-1 font-head text-2xl text-ink">{value}</div></div>; }

function SecretField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="text-sm text-ink/80">{label}</span>
      <div className="relative mt-1">
        <input type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="focus-ring w-full border border-line bg-white px-3 py-2 pr-11 text-ink" autoComplete="off" />
        <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? `${label} hide` : `${label} show`} className="absolute inset-y-0 right-0 px-3 text-sm text-ink/50 hover:text-ink">{visible ? "Hide" : "Show"}</button>
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
      <span className="text-sm text-ink/80">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-ink placeholder:text-ink/30"
      />
    </label>
  );
}
