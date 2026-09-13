import type { CrawlResult } from "@/lib/seo-crawler";

export type KeywordIntent = "informational" | "commercial" | "transactional" | "navigational" | "local" | "mixed";
export type OpportunityTier = "priority" | "strong" | "watch" | "low";

export interface KeywordCandidate {
  keyword: string;
  normalizedKeyword: string;
  source: "seed" | "related" | "question" | "modifier" | "page" | "gsc";
  intent: KeywordIntent;
  relevanceScore: number;
  opportunityScore: number;
  difficultyScore: number;
  contentFitScore: number;
  currentSignalScore: number;
  tier: OpportunityTier;
  recommendedContentType: "pillar" | "landing-page" | "article" | "faq" | "comparison" | "local-page";
  recommendation: string;
}

const STOP_WORDS = new Set(
  "a an and are as at be by for from how i in is it of on or that the this to was what when where which who why with your you our we official online guide best".split(
    /\s+/
  )
);
const QUESTION_STARTS = ["what is", "how to", "how do", "why", "when", "where", "which", "can i", "is", "are"];
const MODIFIERS = [
  "best",
  "cheap",
  "price",
  "pricing",
  "online",
  "near me",
  "services",
  "guide",
  "tips",
  "reviews",
  "comparison",
  "vs",
  "alternative",
  "for beginners",
];
const LOCAL_MODIFIERS = ["near me", "in karachi", "in lahore", "in islamabad", "in pakistan", "nearby"];

function normalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ");
}
function words(value: string) {
  return normalize(value).split(" ").filter(Boolean);
}
function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function detectKeywordIntent(keyword: string): KeywordIntent {
  const k = normalize(keyword);
  const transactional =
    /\b(buy|order|purchase|book|hire|price|pricing|cheap|deal|quote|subscribe|service|services)\b/.test(k);
  const commercial = /\b(best|top|review|reviews|compare|comparison|vs|alternative|alternatives)\b/.test(k);
  const informational =
    /\b(what|why|how|guide|tutorial|learn|meaning|definition|tips|examples|when|where|which)\b/.test(k);
  const navigational = /\b(login|signin|official|website|contact|address)\b/.test(k);
  const local = LOCAL_MODIFIERS.some((m) => k.includes(m));
  if (local && (transactional || commercial)) return "local";
  const count = [transactional, commercial, informational, navigational].filter(Boolean).length;
  if (count > 1) return "mixed";
  if (transactional) return "transactional";
  if (commercial) return "commercial";
  if (informational) return "informational";
  if (navigational) return "navigational";
  return "mixed";
}

function candidateIntentScore(intent: KeywordIntent) {
  return { transactional: 95, commercial: 90, local: 88, informational: 82, navigational: 45, mixed: 70 }[intent];
}

function estimateDifficulty(keyword: string, crawl?: CrawlResult | null) {
  const w = words(keyword);
  let score = 35 + Math.max(0, w.length - 2) * 4;
  if (/\b(best|cheap|price|online|near me|vs|reviews)\b/.test(normalize(keyword))) score -= 6;
  if (crawl?.title && normalize(crawl.title).includes(normalize(keyword))) score -= 10;
  return clamp(score);
}

function contentFit(keyword: string, crawl?: CrawlResult | null) {
  if (!crawl) return 65;
  const kWords = new Set(words(keyword).filter((w) => !STOP_WORDS.has(w)));
  const pageText = normalize(
    [
      crawl.title,
      crawl.metaDescription,
      ...crawl.h1s,
      ...(crawl.headingTexts || []),
      ...(crawl.readableText || "").slice(0, 12000),
    ].join(" ")
  );
  if (!pageText) return 50;
  const overlap = [...kWords].filter((w) => pageText.includes(w)).length / Math.max(1, kWords.size);
  return clamp(40 + overlap * 60);
}

function currentSignal(keyword: string, crawl?: CrawlResult | null) {
  if (!crawl) return 0;
  const k = normalize(keyword);
  let score = 0;
  if (normalize(crawl.title || "").includes(k)) score += 25;
  if (crawl.h1s.some((h) => normalize(h).includes(k))) score += 25;
  if (normalize(crawl.metaDescription || "").includes(k)) score += 15;
  if (normalize(crawl.url).includes(k.replace(/\s+/g, "-"))) score += 15;
  const text = normalize(crawl.readableText || "");
  if (text.includes(k)) score += 20;
  return clamp(score);
}

function contentType(intent: KeywordIntent, keyword: string): KeywordCandidate["recommendedContentType"] {
  const k = normalize(keyword);
  if (intent === "local") return "local-page";
  if (intent === "transactional") return "landing-page";
  if (intent === "commercial") return /\b(vs|comparison|alternative)\b/.test(k) ? "comparison" : "article";
  if (intent === "informational") return QUESTION_STARTS.some((q) => k.startsWith(q)) ? "faq" : "article";
  return "article";
}

function buildCandidate(
  keyword: string,
  source: KeywordCandidate["source"],
  seed: string,
  crawl?: CrawlResult | null
): KeywordCandidate {
  const normalizedKeyword = normalize(keyword);
  const intent = detectKeywordIntent(normalizedKeyword);
  const relevanceBase = normalize(seed)
    .split(" ")
    .filter(Boolean)
    .reduce((n, token) => (normalizedKeyword.includes(token) ? n + 1 : n), 0);
  const relevanceScore = clamp(
    45 + (relevanceBase / Math.max(1, words(seed).length)) * 45 + (source === "gsc" ? 10 : 0)
  );
  const difficultyScore = estimateDifficulty(normalizedKeyword, crawl);
  const contentFitScore = contentFit(normalizedKeyword, crawl);
  const currentSignalScore = currentSignal(normalizedKeyword, crawl);
  const intentScore = candidateIntentScore(intent);
  const opportunityScore = clamp(
    relevanceScore * 0.3 +
      intentScore * 0.2 +
      contentFitScore * 0.2 +
      (100 - difficultyScore) * 0.2 +
      (100 - currentSignalScore) * 0.1
  );
  const tier: OpportunityTier =
    opportunityScore >= 80 ? "priority" : opportunityScore >= 68 ? "strong" : opportunityScore >= 52 ? "watch" : "low";
  const type = contentType(intent, normalizedKeyword);
  const recommendation =
    currentSignalScore >= 70
      ? "Existing page has strong keyword signals; improve CTR, intent match and supporting content before creating a competing page."
      : intent === "transactional"
        ? "Create or strengthen a conversion-focused landing/service page and connect it to relevant supporting content."
        : intent === "local"
          ? "Consider a genuinely useful location page with local proof, service details and LocalBusiness signals."
          : "Create a focused page/article that satisfies the intent and build internal links from closely related pages.";
  return {
    keyword,
    normalizedKeyword,
    source,
    intent,
    relevanceScore,
    opportunityScore,
    difficultyScore,
    contentFitScore,
    currentSignalScore,
    tier,
    recommendedContentType: type,
    recommendation,
  };
}

export function generateKeywordCandidates(
  seedKeyword: string,
  crawl?: CrawlResult | null,
  gscQueries: string[] = []
): KeywordCandidate[] {
  const seed = normalize(seedKeyword);
  if (!seed) throw new Error("Seed keyword is required.");
  const seedWords = words(seed).filter((w) => !STOP_WORDS.has(w));
  const raw: Array<[string, KeywordCandidate["source"]]> = [[seed, "seed"]];
  for (const mod of MODIFIERS) raw.push([`${mod} ${seed}`, "modifier"], [`${seed} ${mod}`, "modifier"]);
  for (const start of QUESTION_STARTS) raw.push([`${start} ${seed}`, "question"]);
  for (const local of LOCAL_MODIFIERS) raw.push([`${seed} ${local}`, "related"]);
  if (seedWords.length >= 2) {
    raw.push([seedWords.slice(0, -1).join(" "), "related"], [seedWords.slice(1).join(" "), "related"]);
  }
  if (crawl) {
    for (const h of [...(crawl.h1s || []), ...(crawl.headingTexts || [])]) {
      const normalized = normalize(h);
      if (normalized && normalized !== seed && normalized.split(" ").length <= 12) raw.push([normalized, "page"]);
    }
    for (const anchor of crawl.linkAnchors || []) {
      const normalized = normalize(anchor);
      if (normalized && normalized.split(" ").length <= 10 && seedWords.some((w) => normalized.includes(w)))
        raw.push([normalized, "page"]);
    }
  }
  for (const query of gscQueries) {
    const q = normalize(query);
    if (q && (q.includes(seed) || seedWords.some((w) => q.includes(w)))) raw.push([q, "gsc"]);
  }
  const dedup = new Map<string, KeywordCandidate>();
  for (const [keyword, source] of raw) {
    const k = normalize(keyword);
    if (!k || k.length < 2 || k.length > 120) continue;
    const candidate = buildCandidate(k, source, seed, crawl);
    const previous = dedup.get(k);
    if (!previous || candidate.opportunityScore > previous.opportunityScore) dedup.set(k, candidate);
  }
  return [...dedup.values()]
    .sort((a, b) => b.opportunityScore - a.opportunityScore || a.difficultyScore - b.difficultyScore)
    .slice(0, 100);
}

export function summarizeKeywordResearch(candidates: KeywordCandidate[]) {
  const counts = candidates.reduce(
    (acc, c) => {
      acc[c.tier] += 1;
      return acc;
    },
    { priority: 0, strong: 0, watch: 0, low: 0 } as Record<OpportunityTier, number>
  );
  const intents = candidates.reduce(
    (acc, c) => {
      acc[c.intent] = (acc[c.intent] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  return {
    total: candidates.length,
    priority: counts.priority,
    strong: counts.strong,
    watch: counts.watch,
    low: counts.low,
    intentMix: intents,
    topOpportunities: candidates.slice(0, 10).map((c) => ({
      keyword: c.keyword,
      score: c.opportunityScore,
      intent: c.intent,
      type: c.recommendedContentType,
    })),
  };
}
