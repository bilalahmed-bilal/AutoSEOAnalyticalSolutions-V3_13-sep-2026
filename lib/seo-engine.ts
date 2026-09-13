import type { CrawlResult } from "@/lib/seo-crawler";

export interface DeterministicSeoIssue {
  severity: "high" | "medium" | "low";
  issue: string;
  fix: string;
  points: number;
}

export interface DeterministicSeoResult {
  score: number;
  issues: DeterministicSeoIssue[];
  checks: Record<string, boolean>;
}

export function calculateDeterministicSeoScore(crawl: CrawlResult): DeterministicSeoResult {
  let score = 100;
  const issues: DeterministicSeoIssue[] = [];
  const checks: Record<string, boolean> = {};

  const deduct = (condition: boolean, points: number, issue: DeterministicSeoIssue) => {
    if (!condition) return;
    score -= points;
    issues.push(issue);
  };

  checks.title = crawl.titleLength >= 30 && crawl.titleLength <= 60;
  deduct(!crawl.title, 20, {
    severity: "high",
    issue: "Page title missing.",
    fix: "Add a unique, descriptive title around 30–60 characters.",
    points: 20,
  });
  deduct(!!crawl.title && !checks.title, 8, {
    severity: "medium",
    issue: "Page title length is outside the recommended range.",
    fix: "Rewrite the title to roughly 30–60 characters while keeping the primary topic clear.",
    points: 8,
  });

  checks.metaDescription = crawl.metaDescriptionLength >= 70 && crawl.metaDescriptionLength <= 160;
  deduct(!crawl.metaDescription, 15, {
    severity: "high",
    issue: "Meta description missing.",
    fix: "Add a unique, useful meta description of roughly 70–160 characters.",
    points: 15,
  });
  deduct(!!crawl.metaDescription && !checks.metaDescription, 6, {
    severity: "medium",
    issue: "Meta description length is outside the recommended range.",
    fix: "Rewrite it to roughly 70–160 characters with a clear search intent and benefit.",
    points: 6,
  });

  checks.h1 = crawl.h1s.length === 1;
  deduct(crawl.h1s.length === 0, 12, {
    severity: "high",
    issue: "No H1 heading found.",
    fix: "Add one clear H1 that describes the page's primary topic.",
    points: 12,
  });
  deduct(crawl.h1s.length > 1, 5, {
    severity: "low",
    issue: "Multiple H1 headings found.",
    fix: "Prefer one primary H1 and use H2/H3 headings for supporting sections.",
    points: 5,
  });

  checks.imagesAlt = crawl.imagesMissingAlt === 0;
  deduct(crawl.imagesMissingAlt > 0, Math.min(10, crawl.imagesMissingAlt * 2), {
    severity: "medium",
    issue: `${crawl.imagesMissingAlt} image(s) are missing alt text.`,
    fix: "Add concise, meaningful alt text to informative images; leave decorative images empty.",
    points: Math.min(10, crawl.imagesMissingAlt * 2),
  });

  checks.viewport = crawl.hasViewportTag;
  deduct(!crawl.hasViewportTag, 5, {
    severity: "medium",
    issue: "Viewport meta tag is missing.",
    fix: "Add a responsive viewport meta tag for mobile rendering.",
    points: 5,
  });

  checks.canonical = crawl.hasCanonicalTag;
  deduct(!crawl.hasCanonicalTag, 5, {
    severity: "low",
    issue: "Canonical link is missing.",
    fix: "Add a canonical URL when the page can have duplicate URL variants.",
    points: 5,
  });

  checks.content = crawl.wordCount >= 300;
  deduct(crawl.wordCount < 300, 8, {
    severity: "medium",
    issue: "The page has relatively little crawlable text.",
    fix: "Expand useful, search-intent-aligned content where the page purpose warrants it.",
    points: 8,
  });

  checks.internalLinks = crawl.internalLinkCount >= 2;
  deduct(crawl.internalLinkCount < 2, 4, {
    severity: "low",
    issue: "Few internal links were found.",
    fix: "Add relevant internal links to related pages where useful to visitors.",
    points: 4,
  });

  return { score: Math.max(0, Math.min(100, score)), issues: issues.sort((a, b) => b.points - a.points), checks };
}
