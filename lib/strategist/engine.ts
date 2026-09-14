import { type UnknownRecord } from "@/lib/unknown";
export type StrategyPriority = "critical" | "high" | "medium" | "low";
export type StrategyActionType = "fix" | "create" | "optimize" | "monitor" | "test";

export interface StrategySignal {
  source: string;
  label: string;
  score?: number | null;
  impact: number;
  urgency: number;
  confidence: number;
  evidence: string[];
}

export interface StrategyAction {
  id: string;
  priority: StrategyPriority;
  type: StrategyActionType;
  title: string;
  rationale: string;
  expectedOutcome: string;
  evidence: string[];
  confidence: number;
  dependencies: string[];
  sourceSignals: string[];
}

export interface StrategyPlan {
  overallPriority: StrategyPriority;
  summary: string;
  confidence: number;
  actions: StrategyAction[];
  signals: StrategySignal[];
  conflicts: string[];
  guardrails: string[];
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
function priority(score: number): StrategyPriority {
  return score >= 85 ? "critical" : score >= 65 ? "high" : score >= 40 ? "medium" : "low";
}
function signal(
  source: string,
  label: string,
  impact: number,
  urgency: number,
  confidence: number,
  evidence: string[],
  score?: number | null
): StrategySignal {
  return {
    source,
    label,
    impact: clamp(impact),
    urgency: clamp(urgency),
    confidence: clamp(confidence),
    evidence,
    score: score == null ? null : clamp(score),
  };
}

export function buildStrategyPlan(input: UnknownRecord): StrategyPlan {
  const signals: StrategySignal[] = [];
  const technical = input.technical || null;
  const architecture = input.architecture || null;
  const local = input.local || null;
  const quality = input.quality || null;
  const keyword = input.keyword || null;
  const competitor = input.competitor || null;
  const analytics = input.analytics || null;
  const monitoring = input.monitoring || null;
  const experiments = input.experiments || null;

  if (technical) {
    const s = Number(technical.score);
    if (Number.isFinite(s) && s < 80)
      signals.push(
        signal("technical_seo", "Technical SEO health", 90 - s, s < 60 ? 95 : 70, 90, [`Technical score ${s}/100`], s)
      );
  }
  if (architecture) {
    const s = Number(architecture.score);
    if (Number.isFinite(s) && s < 80)
      signals.push(
        signal(
          "site_architecture",
          "Site architecture",
          82 - s,
          s < 60 ? 85 : 65,
          85,
          [`Architecture score ${s}/100`],
          s
        )
      );
  }
  if (local) {
    const s = Number(local.score);
    if (Number.isFinite(s) && s < 80)
      signals.push(signal("local_seo", "Local SEO readiness", 80 - s, 70, 80, [`Local SEO score ${s}/100`], s));
  }
  if (quality) {
    const s = Number(quality.score);
    if (Number.isFinite(s) && s < 80)
      signals.push(signal("content_quality", "Content quality", 82 - s, 75, 88, [`Latest quality score ${s}/100`], s));
  }
  if (keyword?.opportunityCount) {
    signals.push(
      signal(
        "keyword_research",
        "Keyword opportunity coverage",
        Math.min(70, Number(keyword.opportunityCount) * 3),
        55,
        75,
        [`${keyword.opportunityCount} keyword opportunities available`]
      )
    );
  }
  if (competitor?.keywordGaps || competitor?.contentGaps) {
    const gaps = Number(competitor.keywordGaps || 0) + Number(competitor.contentGaps || 0);
    if (gaps)
      signals.push(
        signal("competitor_intelligence", "Competitive gaps", Math.min(90, gaps * 5), 70, 78, [
          `${competitor.keywordGaps || 0} keyword gaps`,
          `${competitor.contentGaps || 0} content gaps`,
        ])
      );
  }
  if (analytics?.clicksDeltaPct != null) {
    const d = Number(analytics.clicksDeltaPct);
    if (d < -10)
      signals.push(
        signal("analytics", "Organic clicks regression", Math.min(95, 50 + Math.abs(d)), 90, 92, [
          `Clicks changed ${d.toFixed(1)}% period-over-period`,
        ])
      );
    else if (d > 10)
      signals.push(
        signal("analytics", "Organic clicks growth", Math.min(70, d), 35, 92, [
          `Clicks changed +${d.toFixed(1)}% period-over-period`,
        ])
      );
  }
  if (analytics?.positionDelta != null && Number(analytics.positionDelta) > 1)
    signals.push(
      signal("analytics", "Average position regression", 70, 80, 88, [
        `Average position worsened by ${Number(analytics.positionDelta).toFixed(2)}`,
      ])
    );
  if (monitoring?.alertCount) {
    signals.push(
      signal("monitoring", "Active monitoring alerts", Math.min(95, 50 + Number(monitoring.alertCount) * 10), 90, 90, [
        `${monitoring.alertCount} monitoring alert(s)`,
      ])
    );
  }
  if (experiments?.inconclusive) {
    signals.push(
      signal("experiments", "Experimentation opportunity", 55, 45, 75, ["Recent SEO experiment was inconclusive"])
    );
  }

  const actions: StrategyAction[] = [];
  const add = (
    id: string,
    type: StrategyActionType,
    title: string,
    rationale: string,
    expectedOutcome: string,
    evidence: string[],
    confidence: number,
    dependencies: string[],
    sourceSignals: string[],
    score: number
  ) =>
    actions.push({
      id,
      priority: priority(score),
      type,
      title,
      rationale,
      expectedOutcome,
      evidence,
      confidence,
      dependencies,
      sourceSignals,
    });
  const by = (name: string) => signals.find((s) => s.source === name);
  if (by("monitoring") || by("technical_seo"))
    add(
      "fix-technical",
      "fix",
      "Resolve technical SEO regressions",
      "Technical or monitoring evidence indicates the safest first move is to remove blockers before creating more content.",
      "Restore crawlability, indexation and on-page technical health",
      [...(by("monitoring")?.evidence || []), ...(by("technical_seo")?.evidence || [])],
      90,
      [],
      ["monitoring", "technical_seo"],
      95
    );
  if (by("site_architecture"))
    add(
      "fix-architecture",
      "optimize",
      "Strengthen internal linking and site architecture",
      "Weak architecture can dilute authority and make important pages harder to discover.",
      "Improve page discoverability and contextual authority",
      by("site_architecture")!.evidence,
      86,
      ["technical SEO baseline"],
      ["site_architecture"],
      78
    );
  if (by("competitor_intelligence") || by("keyword_research"))
    add(
      "create-gap-content",
      "create",
      "Create content for the highest-value opportunity gaps",
      "Keyword and competitor evidence supports filling gaps rather than publishing arbitrary topics.",
      "Expand relevant search coverage with prioritized content",
      [...(by("competitor_intelligence")?.evidence || []), ...(by("keyword_research")?.evidence || [])],
      80,
      ["content strategy"],
      ["competitor_intelligence", "keyword_research"],
      72
    );
  if (by("content_quality"))
    add(
      "optimize-quality",
      "optimize",
      "Improve content quality before scaling output",
      "Quality signals indicate existing content should be improved before producing large volumes.",
      "Raise publish-readiness and reduce factual/readability risk",
      by("content_quality")!.evidence,
      88,
      ["content quality report"],
      ["content_quality"],
      74
    );
  if (by("analytics") && by("analytics")!.label === "Organic clicks regression")
    add(
      "recover-traffic",
      "optimize",
      "Investigate pages and queries behind the traffic decline",
      "A traffic regression is evidence for investigation, not proof of a single cause.",
      "Identify affected pages/queries and select evidence-backed fixes",
      by("analytics")!.evidence,
      92,
      ["Search Console data"],
      ["analytics"],
      86
    );
  if (by("experiments"))
    add(
      "run-test",
      "test",
      "Run a focused SEO experiment",
      "The previous experiment did not establish a winner, so the next test should isolate one change and use sufficient data.",
      "Generate decision-quality evidence before broad rollout",
      by("experiments")!.evidence,
      82,
      ["stable baseline", "Search Console observations"],
      ["experiments"],
      60
    );
  if (by("local_seo"))
    add(
      "local-optimize",
      "optimize",
      "Improve local SEO signals",
      "Local search signals show an opportunity to strengthen location relevance and business/entity signals.",
      "Improve local discovery and conversion readiness",
      by("local_seo")!.evidence,
      78,
      ["business facts"],
      ["local_seo"],
      58
    );
  if (!actions.length)
    add(
      "baseline-audit",
      "monitor",
      "Establish a baseline and monitor",
      "No material negative signal was supplied to the decision engine.",
      "Create a reliable baseline before making broad changes",
      ["No high-confidence regression signal found"],
      70,
      [],
      [],
      35
    );

  actions.sort(
    (a, b) =>
      ({ critical: 4, high: 3, medium: 2, low: 1 })[b.priority] -
        { critical: 4, high: 3, medium: 2, low: 1 }[a.priority] || b.confidence - a.confidence
  );
  const conflicts: string[] = [];
  if (by("analytics")?.label === "Organic clicks growth" && (by("technical_seo") || by("monitoring")))
    conflicts.push(
      "Organic clicks are growing while technical signals show risk; do not interpret traffic growth as proof that technical issues are harmless."
    );
  if (by("content_quality") && by("keyword_research"))
    conflicts.push(
      "Keyword opportunity does not automatically justify publishing; content quality and factual risk must still pass review."
    );
  const overall = actions.some((a) => a.priority === "critical")
    ? "critical"
    : actions.some((a) => a.priority === "high")
      ? "high"
      : actions.some((a) => a.priority === "medium")
        ? "medium"
        : "low";
  const confidence = Math.round(actions.reduce((s, a) => s + a.confidence, 0) / actions.length);
  return {
    overallPriority: overall,
    summary: `AIBISORA recommends ${actions.length} prioritized action(s). The plan favors fixing high-risk technical signals before scaling content, then using keyword, competitor, quality and performance evidence to choose the next growth actions.`,
    confidence,
    actions,
    signals,
    conflicts,
    guardrails: [
      "Recommendations are decision support, not proof of causality.",
      "Never publish or mutate a site solely because an AI recommendation exists.",
      "Require factual review for claims, prices, legal/medical statements and other high-risk content.",
      "Prefer reversible, measurable changes and compare results against a defined baseline.",
    ],
  };
}
