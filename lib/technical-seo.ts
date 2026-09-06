import { crawlSite, type SiteCrawlResult, type CrawlResult } from "@/lib/seo-crawler";

export type FixSeverity = "critical" | "high" | "medium" | "low";
export type FixKind = "title" | "meta-description" | "h1" | "canonical" | "viewport" | "robots" | "schema" | "og" | "twitter" | "image-alt" | "broken-links" | "noindex" | "hreflang";

export interface TechnicalFix {
  id: string;
  kind: FixKind;
  severity: FixSeverity;
  url: string;
  issue: string;
  recommendation: string;
  autoApplicable: boolean;
  evidence: Record<string, unknown>;
}

function severity(score: number): FixSeverity { return score >= 90 ? "critical" : score >= 70 ? "high" : score >= 40 ? "medium" : "low"; }
function fix(kind: FixKind, url: string, issue: string, recommendation: string, score: number, autoApplicable: boolean, evidence: Record<string, unknown> = {}): TechnicalFix {
  return { id: `${kind}:${Buffer.from(url).toString("base64url").slice(0, 18)}`, kind, severity: severity(score), url, issue, recommendation, autoApplicable, evidence };
}

export function buildTechnicalFixes(site: SiteCrawlResult): TechnicalFix[] {
  const fixes: TechnicalFix[] = [];
  for (const p of site.pages) {
    if (!p.title) fixes.push(fix("title", p.url, "Missing title tag", "Add a unique, descriptive title aligned with the page intent.", 95, true));
    else if (p.titleLength < 30 || p.titleLength > 65) fixes.push(fix("title", p.url, "Title length is outside the recommended range", "Rewrite the title so it is concise and descriptive without keyword stuffing.", 55, true, { length: p.titleLength }));
    if (!p.metaDescription) fixes.push(fix("meta-description", p.url, "Missing meta description", "Add a unique summary that accurately describes the page and its search intent.", 85, true));
    else if (p.metaDescriptionLength < 70 || p.metaDescriptionLength > 170) fixes.push(fix("meta-description", p.url, "Meta description length is outside the recommended range", "Rewrite the description to be concise and useful in search results.", 45, true, { length: p.metaDescriptionLength }));
    if (p.h1s.length === 0) fixes.push(fix("h1", p.url, "Missing H1", "Add one clear primary heading that matches the page topic.", 80, true));
    if (p.h1s.length > 1) fixes.push(fix("h1", p.url, "Multiple H1 headings", "Review the heading hierarchy and keep one primary H1 where practical.", 45, false, { count: p.h1s.length }));
    if (!p.hasCanonicalTag) fixes.push(fix("canonical", p.url, "Missing canonical link", "Add a canonical URL that represents the preferred version of the page.", 70, false));
    if (!p.hasViewportTag) fixes.push(fix("viewport", p.url, "Missing viewport meta tag", "Add a responsive viewport declaration in the page head.", 65, false));
    if (p.noindex) fixes.push(fix("noindex", p.url, "Page contains noindex", "Confirm that this page is intentionally excluded from search before removing noindex.", 95, false, { robots: p.robotsMeta }));
    if (!p.ogTitle || !p.ogDescription || !p.ogImage) fixes.push(fix("og", p.url, "Incomplete Open Graph metadata", "Add accurate og:title, og:description and og:image values for social sharing.", 35, false, { missing: [!p.ogTitle && "og:title", !p.ogDescription && "og:description", !p.ogImage && "og:image"].filter(Boolean) }));
    if (!p.twitterCard || !p.twitterTitle || !p.twitterDescription) fixes.push(fix("twitter", p.url, "Incomplete Twitter metadata", "Add an appropriate Twitter card and matching title/description metadata.", 25, false));
    if (p.imagesMissingAlt > 0) fixes.push(fix("image-alt", p.url, "Images missing alt text", "Add concise, meaningful alt text where the image conveys information; use empty alt for decorative images.", 55, false, { missing: p.imagesMissingAlt, total: p.imagesTotal }));
    if (p.jsonLdCount === 0) fixes.push(fix("schema", p.url, "No JSON-LD detected", "Add structured data only when it accurately represents visible page content and matches an eligible schema type.", 35, false));
    if (p.hreflangCount === 0) fixes.push(fix("hreflang", p.url, "No hreflang detected", "Only add hreflang when the site has genuinely localized/translated page variants.", 15, false));
  }
  if (site.brokenLinks.length) fixes.push(fix("broken-links", site.startUrl, "Broken internal links detected", "Repair or remove broken internal links and re-check the affected pages.", 75, false, { count: site.brokenLinks.length, urls: site.brokenLinks.slice(0, 20) }));
  return fixes;
}

export async function runTechnicalAudit(url: string, maxPages = 25): Promise<{ site: SiteCrawlResult; fixes: TechnicalFix[]; score: number }> {
  const site = await crawlSite(url, Math.min(Math.max(maxPages, 1), 50));
  const fixes = buildTechnicalFixes(site);
  const critical = fixes.filter(f => f.severity === "critical").length;
  const high = fixes.filter(f => f.severity === "high").length;
  const medium = fixes.filter(f => f.severity === "medium").length;
  const score = Math.max(0, Math.min(100, 100 - critical * 12 - high * 7 - medium * 3));
  return { site, fixes, score };
}

export function summarizeTechnicalAudit(site: SiteCrawlResult, fixes: TechnicalFix[]) {
  return {
    pages: site.pages.length,
    discovered: site.summary.pagesDiscovered,
    fixes: fixes.length,
    critical: fixes.filter(f => f.severity === "critical").length,
    high: fixes.filter(f => f.severity === "high").length,
    medium: fixes.filter(f => f.severity === "medium").length,
    low: fixes.filter(f => f.severity === "low").length,
    brokenLinks: site.brokenLinks.length,
    noindexPages: site.summary.noindexPages,
  };
}
