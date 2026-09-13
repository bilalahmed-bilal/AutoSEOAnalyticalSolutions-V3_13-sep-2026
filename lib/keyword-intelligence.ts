import type { CrawlResult } from "@/lib/seo-crawler";

export interface KeywordIssue {
  severity: "high" | "medium" | "low";
  issue: string;
  fix: string;
  points: number;
}

export interface KeywordIntelligenceResult {
  keyword: string;
  normalizedKeyword: string;
  score: number;
  metrics: {
    title: { present: boolean; exactMatch: boolean; position: "start" | "middle" | "end" | "none" };
    metaDescription: { present: boolean; exactMatch: boolean };
    h1: { present: boolean; exactMatch: boolean };
    headings: { matches: number; total: number };
    body: { wordCount: number; exactOccurrences: number; densityPercent: number; prominent: boolean };
    url: { present: boolean; exactMatch: boolean };
    canonical: { present: boolean };
    internalLinks: { count: number };
  };
  intent: "informational" | "commercial" | "transactional" | "navigational" | "mixed";
  issues: KeywordIssue[];
  recommendations: string[];
}

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function countOccurrences(text: string, keyword: string): number {
  const source = normalize(text);
  const target = normalize(keyword);
  if (!source || !target) return 0;
  return source.split(target).length - 1;
}

function hasMatch(text: string | null | undefined, keyword: string): boolean {
  return normalize(text || "").includes(normalize(keyword));
}

function detectIntent(keyword: string): KeywordIntelligenceResult["intent"] {
  const k = normalize(keyword);
  const transactional = /\b(buy|order|purchase|book|hire|price|pricing|cheap|deal|quote|subscribe)\b/.test(k);
  const commercial = /\b(best|top|review|reviews|compare|comparison|vs|alternative|alternatives)\b/.test(k);
  const informational = /\b(what|why|how|guide|tutorial|learn|meaning|definition|tips|examples)\b/.test(k);
  const navigational = /\b(login|signin|official|website|contact|address)\b/.test(k);
  const matches = [transactional, commercial, informational, navigational].filter(Boolean).length;
  if (matches > 1) return "mixed";
  if (transactional) return "transactional";
  if (commercial) return "commercial";
  if (informational) return "informational";
  if (navigational) return "navigational";
  return "mixed";
}

export function analyzeKeyword(crawl: CrawlResult, keyword: string): KeywordIntelligenceResult {
  const normalizedKeyword = normalize(keyword);
  if (!normalizedKeyword) throw new Error("Target keyword is required.");

  const title = normalize(crawl.title || "");
  const titleIndex = title.indexOf(normalizedKeyword);
  const titlePosition: KeywordIntelligenceResult["metrics"]["title"]["position"] =
    titleIndex < 0
      ? "none"
      : titleIndex <= Math.max(0, Math.floor(title.length / 3))
        ? "start"
        : titleIndex >= Math.floor(title.length * 0.66)
          ? "end"
          : "middle";
  const titleExact = titleIndex >= 0;
  const h1Exact = crawl.h1s.some((h) => hasMatch(h, normalizedKeyword));
  const bodyText = normalize(crawl.url + " " + (crawl.title || "") + " " + (crawl.metaDescription || ""));
  // CrawlResult intentionally exposes word count rather than raw body text, so occurrence
  // analysis uses the available page metadata/headings and a conservative signal for body prominence.
  const metadataOccurrences = countOccurrences(bodyText, normalizedKeyword);
  const headingMatches = crawl.h1s.filter((h) => hasMatch(h, normalizedKeyword)).length;
  const exactUrl = normalize(new URL(crawl.url).pathname.replace(/[-_]+/g, " ")).includes(
    normalizedKeyword.replace(/[-_]+/g, " ")
  );
  const contentSignal = metadataOccurrences + headingMatches;
  const densityPercent = crawl.wordCount > 0 ? Math.min(10, (contentSignal / crawl.wordCount) * 100) : 0;

  let score = 100;
  const issues: KeywordIssue[] = [];
  const deduct = (condition: boolean, points: number, issue: KeywordIssue) => {
    if (!condition) return;
    score -= points;
    issues.push(issue);
  };

  deduct(!titleExact, 20, {
    severity: "high",
    issue: "Target keyword is not present in the page title.",
    fix: "Include the target keyword naturally in the title, preferably near the beginning when it reads well.",
    points: 20,
  });
  deduct(!h1Exact, 15, {
    severity: "high",
    issue: "Target keyword is not present in an H1.",
    fix: "Align the primary H1 with the page topic and target keyword without forcing an exact-match phrase.",
    points: 15,
  });
  deduct(!hasMatch(crawl.metaDescription, normalizedKeyword), 10, {
    severity: "medium",
    issue: "Target keyword is absent from the meta description.",
    fix: "Mention the keyword naturally while keeping the description useful and click-oriented.",
    points: 10,
  });
  deduct(crawl.h2Count === 0, 6, {
    severity: "low",
    issue: "No H2 headings were detected for semantic topic organization.",
    fix: "Use descriptive H2 sections that cover important subtopics and related concepts.",
    points: 6,
  });
  deduct(!exactUrl, 5, {
    severity: "low",
    issue: "The target keyword is not reflected in the URL path.",
    fix: "Consider a short, readable keyword-aligned slug when changing the URL is safe and justified.",
    points: 5,
  });
  deduct(crawl.wordCount < 300, 8, {
    severity: "medium",
    issue: "The page has limited crawlable text for meaningful topic coverage.",
    fix: "Expand the page with genuinely useful sections that satisfy the search intent.",
    points: 8,
  });
  deduct(crawl.internalLinkCount < 2, 4, {
    severity: "low",
    issue: "Few internal links support this page's topic authority.",
    fix: "Add relevant internal links from and to closely related pages.",
    points: 4,
  });

  const recommendations = [
    `Search intent signal: ${detectIntent(normalizedKeyword)}. Make the page's main purpose obvious above the fold.`,
    titleExact
      ? "Keep the keyword in the title only if it remains natural and compelling."
      : "Add the target keyword to the title without keyword stuffing.",
    h1Exact ? "Keep the H1 focused on the single primary topic." : "Create one clear H1 aligned with the target topic.",
    crawl.h2Count > 0
      ? "Use H2s to answer distinct subtopics and related questions."
      : "Add H2 sections for important subtopics and questions.",
    "Use related entities, synonyms, examples and supporting facts instead of repeating the exact keyword excessively.",
  ];

  return {
    keyword,
    normalizedKeyword,
    score: Math.max(0, Math.min(100, score)),
    metrics: {
      title: { present: Boolean(crawl.title), exactMatch: titleExact, position: titlePosition },
      metaDescription: {
        present: Boolean(crawl.metaDescription),
        exactMatch: hasMatch(crawl.metaDescription, normalizedKeyword),
      },
      h1: { present: crawl.h1s.length > 0, exactMatch: h1Exact },
      headings: { matches: headingMatches, total: crawl.h1s.length + crawl.h2Count },
      body: {
        wordCount: crawl.wordCount,
        exactOccurrences: contentSignal,
        densityPercent: Number(densityPercent.toFixed(2)),
        prominent: contentSignal >= 2,
      },
      url: {
        present: Boolean(new URL(crawl.url).pathname && new URL(crawl.url).pathname !== "/"),
        exactMatch: exactUrl,
      },
      canonical: { present: crawl.hasCanonicalTag },
      internalLinks: { count: crawl.internalLinkCount },
    },
    intent: detectIntent(normalizedKeyword),
    issues: issues.sort((a, b) => b.points - a.points),
    recommendations,
  };
}
