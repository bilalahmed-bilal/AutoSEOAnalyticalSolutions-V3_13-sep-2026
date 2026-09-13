import * as cheerio from "cheerio";
import { assertSafeUrl, safeFetchPage } from "@/lib/security/url-safety";
import { type UnknownRecord } from "@/lib/unknown";

export interface CrawlResult {
  url: string;
  statusCode: number;
  contentType: string | null;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1s: string[];
  h2Count: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  internalLinkCount: number;
  externalLinkCount: number;
  wordCount: number;
  readableText: string;
  headingTexts: string[];
  linkAnchors: string[];
  hasViewportTag: boolean;
  hasCanonicalTag: boolean;
  canonicalUrl: string | null;
  robotsMeta: string | null;
  noindex: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  hreflangCount: number;
  jsonLdCount: number;
  jsonLdTypes: string[];
  brokenImageCount: number;
  links: string[];
}

export interface SiteCrawlResult {
  startUrl: string;
  pages: CrawlResult[];
  robots: { found: boolean; statusCode: number | null; sitemapUrls: string[]; disallowRules: number };
  sitemap: { found: boolean; statusCode: number | null; urls: string[] };
  brokenLinks: string[];
  duplicateTitles: string[];
  duplicateDescriptions: string[];
  summary: {
    pagesCrawled: number;
    pagesDiscovered: number;
    noindexPages: number;
    missingCanonicalPages: number;
    missingHreflangPages: number;
    pagesWithSchema: number;
    totalBrokenImages: number;
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeUrl(value: string, base: string): string | null {
  try {
    const u = new URL(value, base);
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

function extractJsonLdTypes($: cheerio.CheerioAPI): string[] {
  const types: string[] = [];
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const raw = $(el).text().trim();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of values) {
        if (item && typeof item === "object") {
          const type = (item as UnknownRecord)["@type"];
          if (typeof type === "string") types.push(type);
          if (Array.isArray(type)) types.push(...type.filter((x): x is string => typeof x === "string"));
          if (Array.isArray((item as UnknownRecord)["@graph"])) {
            for (const node of (item as UnknownRecord)["@graph"]) {
              if (typeof node?.["@type"] === "string") types.push(node["@type"]);
            }
          }
        }
      }
    } catch {
      // Invalid JSON-LD is reported separately by the schema count/types gap.
    }
  });
  return [...new Set(types)];
}

export async function crawlPage(rawUrl: string): Promise<CrawlResult> {
  const fetched = await safeFetchPage(rawUrl);
  const url = fetched.url;
  const parsedUrl = new URL(url);
  const $ = cheerio.load(fetched.html);
  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const h1s = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const images = $("img");
  const links: string[] = [];
  let internalLinkCount = 0;
  let externalLinkCount = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:"))
      return;
    const linkUrl = normalizeUrl(href, url);
    if (!linkUrl) return;
    links.push(linkUrl);
    try {
      if (new URL(linkUrl).hostname === parsedUrl.hostname) internalLinkCount++;
      else externalLinkCount++;
    } catch {}
  });
  const readableText = $("body")
    .clone()
    .find("script,style,noscript,template,svg")
    .remove()
    .end()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const headingTexts = $("h1,h2,h3,h4,h5,h6")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
  const linkAnchors = $("a[href]")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
  const jsonLdTypes = extractJsonLdTypes($);
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() || null;
  const canonicalUrl = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const contentType = fetched.response.headers.get("content-type") || null;
  const brokenImageCount = images.toArray().filter((el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    return !src;
  }).length;
  return {
    url,
    statusCode: fetched.response.status,
    contentType,
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    h1s,
    h2Count: $("h2").length,
    imagesTotal: images.length,
    imagesMissingAlt: images.toArray().filter((el) => !$(el).attr("alt")?.trim()).length,
    internalLinkCount,
    externalLinkCount,
    wordCount: countWords(readableText),
    readableText,
    headingTexts,
    linkAnchors,
    hasViewportTag: $('meta[name="viewport"]').length > 0,
    hasCanonicalTag: Boolean(canonicalUrl),
    canonicalUrl,
    robotsMeta,
    noindex: /\bnoindex\b/i.test(robotsMeta || ""),
    ogTitle: $('meta[property="og:title"]').attr("content")?.trim() || null,
    ogDescription: $('meta[property="og:description"]').attr("content")?.trim() || null,
    ogImage: $('meta[property="og:image"]').attr("content")?.trim() || null,
    twitterCard: $('meta[name="twitter:card"]').attr("content")?.trim() || null,
    twitterTitle: $('meta[name="twitter:title"]').attr("content")?.trim() || null,
    twitterDescription: $('meta[name="twitter:description"]').attr("content")?.trim() || null,
    twitterImage: $('meta[name="twitter:image"]').attr("content")?.trim() || null,
    hreflangCount: $('link[rel="alternate"][hreflang]').length,
    jsonLdCount: $('script[type="application/ld+json"]').length,
    jsonLdTypes,
    brokenImageCount,
    links: [...new Set(links)],
  };
}

async function fetchTextResource(url: string): Promise<{ statusCode: number | null; text: string | null }> {
  try {
    const safe = await assertSafeUrl(url);
    const response = await fetch(safe, {
      redirect: "manual",
      headers: { "User-Agent": "AutoSEO-Bot/2.0", Accept: "text/plain,application/xml,text/xml,*/*;q=0.5" },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { statusCode: response.status, text: null };
      const redirected = await assertSafeUrl(new URL(location, safe).toString());
      const next = await fetch(redirected, {
        redirect: "error",
        headers: { "User-Agent": "AutoSEO-Bot/2.0" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!next.ok) return { statusCode: next.status, text: null };
      return { statusCode: next.status, text: (await next.text()).slice(0, 2_000_000) };
    }
    if (!response.ok) return { statusCode: response.status, text: null };
    return { statusCode: response.status, text: (await response.text()).slice(0, 2_000_000) };
  } catch {
    return { statusCode: null, text: null };
  }
}

function parseSitemapXml(xml: string, baseUrl: string): string[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls = $("url > loc")
    .map((_, el) => $(el).text().trim())
    .get();
  const nested = $("sitemap > loc")
    .map((_, el) => $(el).text().trim())
    .get();
  return [...new Set([...urls, ...nested].map((u) => normalizeUrl(u, baseUrl)).filter((u): u is string => Boolean(u)))];
}

export async function crawlSite(rawUrl: string, maxPages = 25): Promise<SiteCrawlResult> {
  const start = new URL(rawUrl);
  start.hash = "";
  const startUrl = start.href;
  const origin = start.origin;
  const robotsResource = await fetchTextResource(`${origin}/robots.txt`);
  const sitemapUrls: string[] = [];
  const disallowRules = robotsResource.text
    ? robotsResource.text.split(/\r?\n/).filter((line) => /^\s*Disallow\s*:/i.test(line)).length
    : 0;
  if (robotsResource.text) {
    for (const line of robotsResource.text.split(/\r?\n/)) {
      const match = line.match(/^\s*Sitemap:\s*(\S+)/i);
      if (match) sitemapUrls.push(match[1]);
    }
  }
  if (!sitemapUrls.length) sitemapUrls.push(`${origin}/sitemap.xml`);
  const sitemapResource = await fetchTextResource(sitemapUrls[0]);
  const sitemapFound = Boolean(sitemapResource.text);
  const sitemapEntries = sitemapResource.text ? parseSitemapXml(sitemapResource.text, startUrl) : [];
  const queue = [startUrl, ...sitemapEntries.slice(0, Math.max(0, maxPages - 1))];
  const seen = new Set<string>();
  const pages: CrawlResult[] = [];
  while (queue.length && pages.length < maxPages) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    try {
      const page = await crawlPage(next);
      if (new URL(page.url).hostname !== start.hostname) continue;
      pages.push(page);
      for (const link of page.links) {
        if (queue.length + pages.length >= maxPages * 2) break;
        if (!seen.has(link) && new URL(link).hostname === start.hostname) queue.push(link);
      }
    } catch {
      // A page that cannot be fetched is represented in brokenLinks below.
    }
  }
  const brokenLinks: string[] = [];
  const candidates = [...new Set(pages.flatMap((p) => p.links))].slice(0, 100);
  for (const link of candidates) {
    if (pages.some((p) => p.url === link)) continue;
    try {
      const result = await safeFetchPage(link);
      if ((result.response.status ?? 200) >= 400) brokenLinks.push(link);
    } catch {
      brokenLinks.push(link);
    }
  }
  const titleMap = new Map<string, string[]>();
  const descMap = new Map<string, string[]>();
  for (const p of pages) {
    if (p.title) titleMap.set(p.title, [...(titleMap.get(p.title) || []), p.url]);
    if (p.metaDescription) descMap.set(p.metaDescription, [...(descMap.get(p.metaDescription) || []), p.url]);
  }
  return {
    startUrl,
    pages,
    robots: { found: Boolean(robotsResource.text), statusCode: robotsResource.statusCode, sitemapUrls, disallowRules },
    sitemap: { found: sitemapFound, statusCode: sitemapResource.statusCode, urls: sitemapEntries },
    brokenLinks,
    duplicateTitles: [...titleMap.values()].filter((v) => v.length > 1).flat(),
    duplicateDescriptions: [...descMap.values()].filter((v) => v.length > 1).flat(),
    summary: {
      pagesCrawled: pages.length,
      pagesDiscovered: new Set([...queue, ...seen]).size,
      noindexPages: pages.filter((p) => p.noindex).length,
      missingCanonicalPages: pages.filter((p) => !p.hasCanonicalTag).length,
      missingHreflangPages: pages.filter((p) => p.hreflangCount === 0).length,
      pagesWithSchema: pages.filter((p) => p.jsonLdCount > 0).length,
      totalBrokenImages: pages.reduce((n, p) => n + p.brokenImageCount, 0),
    },
  };
}
