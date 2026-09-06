import type { SiteCrawlResult } from "@/lib/seo-crawler";

export interface SiteSeoIssue {
  severity: "high" | "medium" | "low";
  issue: string;
  fix: string;
  points: number;
}

export interface SiteSeoResult {
  score: number;
  issues: SiteSeoIssue[];
  checks: Record<string, boolean>;
}

export function calculateSiteSeoScore(site: SiteCrawlResult): SiteSeoResult {
  let score = 100;
  const issues: SiteSeoIssue[] = [];
  const checks: Record<string, boolean> = {};
  const deduct = (condition: boolean, points: number, issue: SiteSeoIssue) => {
    if (!condition) return;
    score -= points;
    issues.push(issue);
  };

  const pages = site.pages;
  const indexed = pages.filter((p) => !p.noindex);
  checks.robots = site.robots.found;
  checks.sitemap = site.sitemap.found;
  checks.canonical = pages.length > 0 && pages.filter((p) => p.hasCanonicalTag).length / pages.length >= 0.8;
  checks.hreflang = pages.length === 0 || pages.filter((p) => p.hreflangCount > 0).length / pages.length >= 0.8;
  checks.openGraph = pages.length === 0 || pages.filter((p) => p.ogTitle && p.ogDescription && p.ogImage).length / pages.length >= 0.8;
  checks.twitterCards = pages.length === 0 || pages.filter((p) => p.twitterCard).length / pages.length >= 0.8;
  checks.schema = pages.length === 0 || pages.filter((p) => p.jsonLdCount > 0).length / pages.length >= 0.5;
  checks.brokenLinks = site.brokenLinks.length === 0;
  checks.duplicateTitles = site.duplicateTitles.length === 0;
  checks.duplicateDescriptions = site.duplicateDescriptions.length === 0;

  deduct(!site.robots.found, 8, { severity: "medium", issue: "robots.txt was not found.", fix: "Publish a valid robots.txt and reference the preferred sitemap URL when appropriate.", points: 8 });
  deduct(!site.sitemap.found, 8, { severity: "medium", issue: "XML sitemap was not found.", fix: "Publish an XML sitemap containing canonical, indexable URLs.", points: 8 });
  deduct(site.brokenLinks.length > 0, Math.min(12, site.brokenLinks.length * 2), { severity: "high", issue: `${site.brokenLinks.length} broken internal link(s) detected.`, fix: "Fix, redirect, or remove links that return HTTP errors.", points: Math.min(12, site.brokenLinks.length * 2) });
  deduct(site.duplicateTitles.length > 0, 7, { severity: "medium", issue: "Duplicate page titles were detected.", fix: "Give important indexable pages unique, descriptive title tags.", points: 7 });
  deduct(site.duplicateDescriptions.length > 0, 5, { severity: "low", issue: "Duplicate meta descriptions were detected.", fix: "Write unique descriptions for pages with distinct search intent.", points: 5 });
  deduct(!checks.canonical, 6, { severity: "medium", issue: "Many crawled pages are missing canonical URLs.", fix: "Add self-referencing or intentionally consolidated canonical URLs where appropriate.", points: 6 });
  deduct(!checks.openGraph, 4, { severity: "low", issue: "Open Graph metadata is incomplete across the site.", fix: "Add og:title, og:description and og:image to shareable pages.", points: 4 });
  deduct(!checks.twitterCards, 2, { severity: "low", issue: "Twitter/X card metadata is incomplete.", fix: "Add an appropriate Twitter/X card and image metadata where useful.", points: 2 });
  deduct(!checks.schema, 5, { severity: "medium", issue: "Structured data is sparse across the crawled pages.", fix: "Add valid JSON-LD appropriate to each page type; avoid marking up content that is not visible or accurate.", points: 5 });
  deduct(site.summary.totalBrokenImages > 0, Math.min(6, site.summary.totalBrokenImages), { severity: "medium", issue: `${site.summary.totalBrokenImages} image source(s) appear to be missing.`, fix: "Repair missing image URLs and verify important images load successfully.", points: Math.min(6, site.summary.totalBrokenImages) });
  deduct(indexed.length === 0 && pages.length > 0, 15, { severity: "high", issue: "All crawled pages are marked noindex.", fix: "Review robots/noindex directives and allow intended landing pages to be indexed.", points: 15 });

  return { score: Math.max(0, Math.min(100, score)), issues: issues.sort((a, b) => b.points - a.points), checks };
}
