import { crawlSite, type SiteCrawlResult } from "@/lib/seo-crawler";
import type { KeywordOpportunity } from "@/lib/keyword-research-repository";
import { type UnknownRecord } from "@/lib/unknown";

export type LocalIssueSeverity = "critical" | "high" | "medium" | "low";
export interface LocalSeoIssue {
  key: string;
  severity: LocalIssueSeverity;
  score: number;
  title: string;
  reason: string;
  recommendation: string;
}
export interface LocalKeywordOpportunity {
  keyword: string;
  intent: string;
  score: number;
  reason: string;
}
export interface LocalSeoAnalysis {
  site: SiteCrawlResult;
  location: string;
  businessName?: string;
  summary: {
    score: number;
    pages: number;
    issues: number;
    localKeywords: number;
    locationSignals: number;
    schemaSignals: number;
  };
  issues: LocalSeoIssue[];
  keywordOpportunities: LocalKeywordOpportunity[];
  locationSignals: string[];
  schemaSignals: string[];
  recommendations: string[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const locationParts = (location: string) =>
  location
    .split(",")
    .map((x) => norm(x))
    .filter(Boolean);
const corpus = (p: UnknownRecord) =>
  [
    p.title || "",
    p.metaDescription || "",
    ...(p.h1s || []),
    ...(p.headingTexts || []),
    p.readableText || "",
    ...(p.linkAnchors || []),
  ].join(" ");

function detectLocationSignals(site: SiteCrawlResult, location: string, businessName?: string) {
  const parts = locationParts(location);
  const signals: string[] = [];
  const text = site.pages.map(corpus).join(" ");
  const n = norm(text);
  for (const part of parts) {
    if (part && n.includes(part)) signals.push(`Location term detected: ${part}`);
  }
  if (businessName && n.includes(norm(businessName))) signals.push("Business name appears in crawlable content.");
  if (site.pages.some((p) => p.hreflangCount > 0)) signals.push("Hreflang metadata detected.");
  return [...new Set(signals)];
}

function detectSchema(site: SiteCrawlResult) {
  const types = [...new Set(site.pages.flatMap((p) => p.jsonLdTypes || []))];
  return types;
}

function makeIssues(site: SiteCrawlResult, location: string, businessName?: string): LocalSeoIssue[] {
  const issues: LocalSeoIssue[] = [];
  const parts = locationParts(location);
  const locationText = parts.join(" ");
  const pages = site.pages.filter((p) => p.statusCode >= 200 && p.statusCode < 400 && !p.noindex);
  const combined = norm(site.pages.map(corpus).join(" "));
  if (!parts.length)
    issues.push({
      key: "location_missing",
      severity: "critical",
      score: 100,
      title: "Target location is missing",
      reason: "A local SEO audit needs a city/area or service location to evaluate location relevance.",
      recommendation: "Add a precise target location such as city, district, or service area.",
    });
  else if (!parts.some((p) => combined.includes(p)))
    issues.push({
      key: "location_signal",
      severity: "high",
      score: 88,
      title: "Weak location signals",
      reason: `None of the supplied location terms (${locationText}) were found in the crawlable site content.`,
      recommendation:
        "Add the genuine service location to relevant titles, headings, contact/location content and other appropriate local signals without keyword stuffing.",
    });
  if (!site.pages.some((p) => p.jsonLdTypes.some((t) => /LocalBusiness|Organization/i.test(t))))
    issues.push({
      key: "local_schema",
      severity: "high",
      score: 82,
      title: "Local business schema not detected",
      reason: "No LocalBusiness/Organization JSON-LD type was detected in the crawled pages.",
      recommendation:
        "Add accurate, validated LocalBusiness or the most specific applicable schema with genuine business details.",
    });
  if (!site.pages.some((p) => /address|contact|location|find us|directions/i.test(corpus(p))))
    issues.push({
      key: "contact_location",
      severity: "high",
      score: 78,
      title: "Contact or location content is not obvious",
      reason: "The crawl did not find clear address/contact/location language.",
      recommendation:
        "Provide a clear contact/location section and, where applicable, service-area details and directions.",
    });
  if (!site.pages.some((p) => /\b(phone|tel|call|contact)\b/i.test(corpus(p))))
    issues.push({
      key: "contact_signal",
      severity: "medium",
      score: 62,
      title: "Phone/contact signal is weak",
      reason: "No clear phone/contact wording was detected in crawlable content.",
      recommendation: "Make a legitimate business phone or contact method easy to discover where appropriate.",
    });
  if (!site.pages.some((p) => /\b(review|reviews|rating|testimonial|customer)\b/i.test(corpus(p))))
    issues.push({
      key: "reviews",
      severity: "medium",
      score: 55,
      title: "Review/testimonial content not detected",
      reason: "No review or testimonial language was detected; this does not prove reviews are absent.",
      recommendation:
        "If genuine customer reviews are available, surface them transparently and mark up only eligible, accurate content.",
    });
  const missingMeta = pages.filter((p) => !p.metaDescription).length;
  if (missingMeta)
    issues.push({
      key: "meta",
      severity: "medium",
      score: 50,
      title: "Pages missing meta descriptions",
      reason: `${missingMeta} crawlable page(s) have no meta description.`,
      recommendation:
        "Write unique, useful descriptions that naturally communicate service and location where relevant.",
    });
  const thin = pages.filter((p) => p.wordCount < 250).length;
  if (thin)
    issues.push({
      key: "thin",
      severity: "medium",
      score: 48,
      title: "Thin crawlable pages",
      reason: `${thin} page(s) have fewer than 250 extracted words.`,
      recommendation: "Expand genuinely useful local/service content where the page needs more context; avoid filler.",
    });
  if (businessName && !site.pages.some((p) => norm(corpus(p)).includes(norm(businessName))))
    issues.push({
      key: "business_name",
      severity: "medium",
      score: 58,
      title: "Business name not detected",
      reason: "The supplied business name was not found in crawlable content.",
      recommendation:
        "Use the real business name consistently where users expect it, such as branding/contact information.",
    });
  return issues.sort((a, b) => b.score - a.score);
}

function keywordIdeas(location: string, seed: KeywordOpportunity[], site: SiteCrawlResult) {
  const loc = location.trim();
  const out: LocalKeywordOpportunity[] = [];
  const covered = norm(site.pages.map(corpus).join(" "));
  const seeds = seed.length ? seed.map((x) => x.keyword) : ["services", "near me", "company", "provider"];
  for (const raw of seeds.slice(0, 40)) {
    const k = raw.trim();
    if (!k) continue;
    const candidates = [`${k} ${loc}`, `${k} near me`, `${k} in ${loc}`];
    for (const c of candidates) {
      const n = norm(c);
      if (covered.includes(norm(k)) && covered.includes(norm(loc))) continue;
      const intent = /near me|in /.test(n) ? "local" : "commercial";
      const score = Math.min(
        100,
        Math.round(55 + (loc ? 15 : 0) + (n.includes("near me") ? 12 : 0) + (k.length < 55 ? 8 : 0))
      );
      out.push({
        keyword: c,
        intent,
        score,
        reason: `Combines the existing keyword opportunity with the target location; validate actual search demand before production.`,
      });
    }
  }
  return [...new Map(out.map((x) => [norm(x.keyword), x])).values()].sort((a, b) => b.score - a.score).slice(0, 50);
}

export async function analyzeLocalSeo(
  targetUrl: string,
  location: string,
  businessName: string | undefined,
  keywordOpportunities: KeywordOpportunity[] = [],
  maxPages = 25
): Promise<LocalSeoAnalysis> {
  const site = await crawlSite(targetUrl, Math.min(50, Math.max(5, maxPages)));
  const issues = makeIssues(site, location, businessName);
  const signals = detectLocationSignals(site, location, businessName);
  const schema = detectSchema(site);
  const localKeywordOpportunities = keywordIdeas(location, keywordOpportunities, site);
  const pages = site.pages.filter((p) => p.statusCode >= 200 && p.statusCode < 400 && !p.noindex);
  const issuePenalty = issues.reduce(
    (s, i) => s + (i.severity === "critical" ? 24 : i.severity === "high" ? 14 : i.severity === "medium" ? 7 : 3),
    0
  );
  const score = Math.max(0, Math.min(100, Math.round(100 - issuePenalty - Math.max(0, 3 - signals.length) * 5)));
  const recommendations = [
    ...issues.slice(0, 6).map((i) => i.recommendation),
    "Create dedicated location pages only when each location has genuinely useful, unique content.",
    "Keep business name, address/service area and contact details accurate and consistent across the website and external profiles.",
    "Use local schema only for information that is actually present and accurate on the site.",
  ];
  return {
    site,
    location,
    businessName,
    summary: {
      score,
      pages: pages.length,
      issues: issues.length,
      localKeywords: localKeywordOpportunities.length,
      locationSignals: signals.length,
      schemaSignals: schema.length,
    },
    issues,
    keywordOpportunities: localKeywordOpportunities,
    locationSignals: signals,
    schemaSignals: schema,
    recommendations: [...new Set(recommendations)],
  };
}
