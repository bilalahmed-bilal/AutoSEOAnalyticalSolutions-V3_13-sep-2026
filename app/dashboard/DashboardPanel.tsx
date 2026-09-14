"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { errorMessage, scheduleMount, type UnknownRecord } from "@/lib/unknown";
import { useUiLanguage } from "@/app/i18n/LanguageProvider";
import { AiBadge, ApprovalBadge, Skeleton } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, MetricCard, PageHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ActivityRow, ScoreMark, Sparkline } from "@/components/ui/Visual";
import type { Tab } from "@/lib/ui/nav";

function SetupItem({
  icon,
  title,
  description,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  description: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="nx-dashboard-setup-icon" aria-hidden>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--nx-text-secondary)]">{description}</span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="nx-dashboard-setup-item nx-dashboard-setup-item-interactive w-full text-left focus-ring"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className="nx-dashboard-setup-item">{content}</div>;
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="nx-dashboard-state nx-dashboard-state-error">
      <span className="nx-dashboard-state-icon" aria-hidden>
        <Icon name="shield" className="h-5 w-5" />
      </span>
      <div>
        <h2 className="nx-section-title text-ink">Dashboard is waiting for your workspace</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--nx-text-secondary)]">{message}</p>
      </div>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export default function DashboardPanel({ onNavigate }: { onNavigate?: (tab: Tab) => void }) {
  const { t } = useUiLanguage();
  const [data, setData] = useState<UnknownRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    apiFetch("/api/dashboard")
      .then(async (res) => {
        const text = await res.text();
        let json: UnknownRecord = {};
        if (text) {
          try {
            json = JSON.parse(text) as UnknownRecord;
          } catch {
            throw new Error("AIBISORA could not read the dashboard response. Please retry.");
          }
        }
        if (!res.ok) {
          throw new Error(String(json.error || "Sign in and select a workspace, then retry."));
        }
        setData(json);
      })
      .catch((err: unknown) => {
        const message = errorMessage(err, "Dashboard load failed.");
        setError(message);
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
      <div className="space-y-6" aria-busy="true" aria-label={t("dashboard.loading")}>
        <div className="nx-dashboard-hero-skeleton">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-[min(32rem,80vw)]" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.75fr)]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Command center"
          title="Dashboard"
          description="Your live SEO, content, publishing, and usage overview."
        />
        <DashboardError
          message={
            /workspace|signed-in|400|required/i.test(error)
              ? "Sign in and select a workspace to load live metrics. AIBISORA never invents business data for the dashboard."
              : error
          }
          onRetry={load}
        />
      </div>
    );
  }

  if (!data || data.empty) {
    return (
      <div className="space-y-6">
        <div className="nx-dashboard-hero nx-dashboard-hero-empty">
          <div className="min-w-0">
            <p className="nx-label">Command center</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="nx-display text-ink">Build your AIBISORA workspace.</h1>
              <span className="nx-dashboard-live-pill">
                <span className="nx-dashboard-live-dot" aria-hidden /> Free Beta
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--nx-text-secondary)]">
              Start with a workspace, connect your website, and let AIBISORA turn your live data into clear SEO and
              marketing actions.
            </p>
          </div>
          <div className="nx-dashboard-hero-orb" aria-hidden>
            <span className="nx-dashboard-orb-ring nx-dashboard-orb-ring-1" />
            <span className="nx-dashboard-orb-ring nx-dashboard-orb-ring-2" />
            <span className="nx-dashboard-orb-core">
              <Icon name="ai" className="h-6 w-6" />
            </span>
          </div>
        </div>

        <section className="nx-dashboard-setup-grid" aria-label="Getting started">
          <SetupItem
            icon="team"
            title="Create a workspace"
            description="Your workspace keeps websites, channels, SEO work, and results together."
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>('input[aria-label="Workspace name"]');
              input?.scrollIntoView({ behavior: "smooth", block: "center" });
              input?.focus();
            }}
          />
          <SetupItem
            icon="globe"
            title="Start with your Website"
            description="Audit technical SEO, content quality, internal links, local SEO, and more."
            onClick={() => onNavigate?.("websiteOverview")}
          />
          <SetupItem
            icon="youtube"
            title="Explore YouTube"
            description="Research keywords, optimize videos, and understand channel performance."
            onClick={() => onNavigate?.("ytKeywordResearch")}
          />
          <SetupItem
            icon="facebook"
            title="Explore Facebook"
            description="Create, optimize, schedule, and analyze Page content."
            onClick={() => onNavigate?.("fbPageSeo")}
          />
          <SetupItem
            icon="instagram"
            title="Instagram · Coming Soon"
            description="Instagram is not live. This card only shows where the channel will sit after it is implemented."
          />
          <SetupItem
            icon="whatsapp"
            title="WhatsApp · Coming Soon"
            description="WhatsApp marketing, automation, AI replies, broadcasts, and analytics are not live in this beta."
          />
        </section>

        <div className="nx-dashboard-setup-footer">
          <div>
            <p className="text-sm font-medium text-ink">No sample numbers. No fake performance.</p>
            <p className="mt-1 text-xs leading-5 text-[var(--nx-text-secondary)]">
              Create a workspace first. Then open Website, YouTube, or Facebook. Instagram and WhatsApp remain Coming
              Soon until those channels are implemented.
            </p>
          </div>
          {onNavigate ? (
            <Button variant="secondary" onClick={() => onNavigate("websiteOverview")}>
              Open Website Tools
              <span aria-hidden>→</span>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const seo = data.seoHealth as UnknownRecord | null;
  const history = ((data.seoHistory as UnknownRecord[]) || [])
    .map((row) => Number(row.score))
    .filter((value) => Number.isFinite(value))
    .reverse();
  const connected = (data.connectedAccounts as UnknownRecord[]) || [];
  const drafts = (data.recentContent as UnknownRecord[]) || [];
  const automation = (data.automationStatus as UnknownRecord) || {};
  const subscription = (data.subscription as UnknownRecord) || {};
  const usage = (data.usage as UnknownRecord[]) || [];
  const aiUsage = usage.find((row) => String(row.metric).toLowerCase().includes("ai"));
  const pending = Number(data.pendingApprovals || 0);
  const queued = Number(data.scheduledActions || automation.queued || 0);
  const running = Number(automation.running || 0);
  const failed = Number(automation.failed || 0);
  const liveConnections = connected.filter((row) => !/revoked|error|failed/i.test(String(row.status))).length;

  const recommendation = pending
    ? {
        title: "Review pending approvals",
        reason: `${pending} item(s) are waiting in Publishing. Humans stay in control of anything that goes live.`,
        action: "Review approvals",
        tab: "publish" as Tab,
        priority: "High",
        icon: "check" as const,
      }
    : failed
      ? {
          title: "Inspect failed automation",
          reason: `${failed} automation run(s) failed. Open Automation to review errors and retry.`,
          action: "Open automation",
          tab: "automation" as Tab,
          priority: "High",
          icon: "workflow" as const,
        }
      : !connected.length
        ? {
            title: "Connect a data source",
            reason: "Search Console, YouTube, or Facebook can add live performance signals to this workspace.",
            action: "Connect data",
            tab: "connections" as Tab,
            priority: "Medium",
            icon: "plug" as const,
          }
        : seo?.score != null
          ? {
              title: "Build on your live data",
              reason:
                "Your workspace is collecting signals. Review Analytics for trends or SEO for the next actionable fix.",
              action: "View analytics",
              tab: "analytics" as Tab,
              priority: "Low",
              icon: "chart" as const,
            }
          : {
              title: "Run your first SEO audit",
              reason:
                "A website audit produces a health score and a prioritized set of issues. No sample scores are shown.",
              action: "Run SEO audit",
              tab: "analyze" as Tab,
              priority: "High",
              icon: "search" as const,
            };

  const aiUsageValue = aiUsage ? Number(aiUsage.quantity || 0) : null;
  const aiUsageLabel = aiUsage ? String(aiUsage.metric) : "No AI activity yet";
  const seoScore = seo?.score != null ? Number(seo.score) : null;
  const seoStatus =
    seoScore == null ? "No audit yet" : seoScore >= 80 ? "Healthy" : seoScore >= 60 ? "Needs attention" : "Critical";
  const subscriptionName = String(subscription.name || "Free Beta");

  return (
    <div className="space-y-6">
      <div className="nx-dashboard-hero">
        <div className="min-w-0">
          <p className="nx-label">Command center</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="nx-display text-ink">Dashboard</h1>
            <span className="nx-dashboard-live-pill">
              <span className="nx-dashboard-live-dot" aria-hidden /> Live workspace
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--nx-text-secondary)]">
            A focused view of SEO health, AI activity, publishing, and the next action worth taking.
          </p>
        </div>
        {onNavigate ? (
          <Button variant="primary" size="lg" onClick={() => onNavigate("analyze")}>
            <Icon name="search" className="h-4 w-4" />
            Run SEO audit
          </Button>
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace overview">
        <div className="nx-dashboard-metric nx-dashboard-metric-primary">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="nx-label">SEO health</p>
              <p className="mt-1 text-xs text-[var(--nx-text-secondary)]">Latest audited signal</p>
            </div>
            <span className="nx-dashboard-metric-icon nx-dashboard-metric-icon-blue" aria-hidden>
              <Icon name="shield" className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-5 flex items-center justify-between gap-4">
            {seoScore != null ? (
              <ScoreMark value={seoScore} label={seoStatus} />
            ) : (
              <div className="nx-dashboard-mini-empty">Run your first audit</div>
            )}
          </div>
        </div>

        <MetricCard label="Pending approvals" value={pending} hint="Human review before publish" />
        <MetricCard label="Queued jobs" value={queued} hint={`${running} currently running`} />
        <div className="nx-dashboard-metric">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="nx-label">AI usage</p>
              <p className="mt-1 text-xs text-[var(--nx-text-secondary)]">This workspace</p>
            </div>
            <span className="nx-dashboard-metric-icon nx-dashboard-metric-icon-ai" aria-hidden>
              <Icon name="ai" className="h-4 w-4" />
            </span>
          </div>
          <p className="nx-metric mt-5 text-ink">{aiUsageValue == null ? "—" : aiUsageValue}</p>
          <p className="mt-1 truncate text-xs text-muted">{aiUsageLabel}</p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)]">
        <Card className="nx-dashboard-recommendation">
          <div className="flex h-full flex-col justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="nx-dashboard-ai-icon" aria-hidden>
                    <Icon name={recommendation.icon} className="h-4 w-4" />
                  </span>
                  <AiBadge>Next best action</AiBadge>
                </div>
                <span className="nx-dashboard-priority">{recommendation.priority} priority</span>
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-ink">{recommendation.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--nx-text-secondary)]">
                {recommendation.reason}
              </p>
            </div>
            {onNavigate ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={() => onNavigate(recommendation.tab)}>
                  {recommendation.action}
                  <span aria-hidden>→</span>
                </Button>
                <span className="text-xs text-muted">Based on current workspace signals</span>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="nx-dashboard-plan">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="nx-label">Current access</p>
              <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-ink">{subscriptionName}</p>
            </div>
            <span className="nx-dashboard-plan-mark">AI</span>
          </div>
          <div className="mt-6 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--nx-text-secondary)]">Status</span>
              <ApprovalBadge status={String(subscription.status || "active")} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--nx-text-secondary)]">Connections</span>
              <span className="font-medium text-ink">{liveConnections}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--nx-text-secondary)]">Failed jobs</span>
              <span className={failed ? "font-medium text-danger" : "font-medium text-success"}>{failed}</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <div className="nx-dashboard-panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="nx-label">SEO performance</p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">Health trend</h2>
              <p className="mt-1 text-sm text-[var(--nx-text-secondary)]">
                Completed audit scores from this workspace.
              </p>
            </div>
            {onNavigate ? (
              <Button variant="ghost" size="sm" onClick={() => onNavigate("analyze")}>
                Open SEO
                <span aria-hidden>→</span>
              </Button>
            ) : null}
          </div>
          <div className="mt-5 nx-dashboard-chart-shell">
            {history.length >= 2 ? (
              <>
                <div className="nx-dashboard-chart-grid" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <Sparkline values={history} label="SEO score history" />
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                  <span>{history.length} recorded audits</span>
                  <span>
                    Latest score: <strong className="font-semibold text-ink">{history[history.length - 1]}</strong>
                  </span>
                </div>
              </>
            ) : (
              <div className="nx-dashboard-chart-empty">
                <span className="nx-dashboard-empty-icon" aria-hidden>
                  <Icon name="chart" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">Build a trend from real audits</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--nx-text-secondary)]">
                    Run more than one audit to compare SEO health over time.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="nx-dashboard-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="nx-label">Connected sources</p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">Your live channels</h2>
            </div>
            <span className="nx-dashboard-count-pill">{connected.length}</span>
          </div>
          {connected.length ? (
            <ul className="mt-4 divide-y divide-line">
              {connected.slice(0, 5).map((row) => (
                <ActivityRow
                  key={String(row.id)}
                  icon={<Icon name="plug" className="h-4 w-4" />}
                  title={String(row.provider).replace(/-/g, " ")}
                  meta={
                    row.last_checked_at ? new Date(String(row.last_checked_at)).toLocaleString() : "Not checked yet"
                  }
                  status={<ApprovalBadge status={String(row.status)} />}
                />
              ))}
            </ul>
          ) : (
            <div className="mt-5 nx-dashboard-inline-empty">
              <span className="nx-dashboard-empty-icon" aria-hidden>
                <Icon name="plug" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-ink">No live sources yet</p>
                <p className="mt-1 text-xs leading-5 text-[var(--nx-text-secondary)]">
                  Connect a provider to make this workspace measurable.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="nx-dashboard-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="nx-label">Operations</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">Publishing & activity</h2>
            <p className="mt-1 text-sm text-[var(--nx-text-secondary)]">
              A compact operational view of what needs attention.
            </p>
          </div>
          {onNavigate ? (
            <Button variant="ghost" size="sm" onClick={() => onNavigate("publish")}>
              Open publishing
              <span aria-hidden>→</span>
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="nx-dashboard-operation-grid">
            <div className="nx-dashboard-operation-item">
              <span className="nx-dashboard-operation-icon nx-dashboard-operation-icon-blue" aria-hidden>
                <Icon name="send" className="h-4 w-4" />
              </span>
              <div>
                <p className="nx-label">Queued</p>
                <p className="mt-1 text-xl font-semibold text-ink">{queued}</p>
              </div>
            </div>
            <div className="nx-dashboard-operation-item">
              <span className="nx-dashboard-operation-icon nx-dashboard-operation-icon-ai" aria-hidden>
                <Icon name="workflow" className="h-4 w-4" />
              </span>
              <div>
                <p className="nx-label">Running</p>
                <p className="mt-1 text-xl font-semibold text-ink">{running}</p>
              </div>
            </div>
            <div className="nx-dashboard-operation-item">
              <span className="nx-dashboard-operation-icon nx-dashboard-operation-icon-danger" aria-hidden>
                <Icon name="shield" className="h-4 w-4" />
              </span>
              <div>
                <p className="nx-label">Failed</p>
                <p className="mt-1 text-xl font-semibold text-ink">{failed}</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="nx-label">Recent activity</p>
              <span className="text-xs text-muted">Latest 5</span>
            </div>
            {drafts.length ? (
              <ul className="mt-2">
                {drafts.slice(0, 5).map((row) => (
                  <ActivityRow
                    key={String(row.id)}
                    icon={<Icon name="pen" className="h-4 w-4" />}
                    title={String(row.title || row.channel || "Untitled content")}
                    meta={[row.channel, row.created_at ? new Date(String(row.created_at)).toLocaleString() : null]
                      .filter(Boolean)
                      .join(" · ")}
                    status={<ApprovalBadge status={String(row.status)} />}
                  />
                ))}
              </ul>
            ) : (
              <div className="mt-3 nx-dashboard-inline-empty">
                <span className="nx-dashboard-empty-icon" aria-hidden>
                  <Icon name="pen" className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">No recent drafts</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--nx-text-secondary)]">
                    Generate content to start the approval and publishing flow.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <Card>
          <p className="nx-label">YouTube activity</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">Connected channel work</h2>
          {connected.some((row) => String(row.provider).includes("youtube")) ? (
            <p className="mt-3 text-sm text-[var(--nx-text-secondary)]">
              {drafts.filter((row) => String(row.channel) === "youtube").length} YouTube draft(s) in this workspace.
              Open YouTube tools for live video data after OAuth is connected.
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--nx-text-secondary)]">
              YouTube is not connected. No channel metrics are shown.
            </p>
          )}
        </Card>
        <Card>
          <p className="nx-label">Facebook activity</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">Connected Page work</h2>
          {connected.some((row) => String(row.provider).includes("facebook")) ? (
            <p className="mt-3 text-sm text-[var(--nx-text-secondary)]">
              {drafts.filter((row) => String(row.channel) === "facebook").length} Facebook draft(s) in this workspace.
              Page stats appear in Facebook tools after the first Page is connected.
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--nx-text-secondary)]">
              Facebook is not connected. No Page metrics are shown.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
