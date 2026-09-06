import Anthropic from "@anthropic-ai/sdk";

// Phase 1 scope: content generation only. No publishing/action tools yet —
// those get added as real "tools" on this same client starting Phase 3
// (see Section 4.5 / 5.2 of the Master Requirements Document).

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Claude sometimes writes real line-breaks inside a JSON string value (e.g.
// paragraph breaks in "body") instead of the escaped "\n" the JSON spec
// requires — that's invalid JSON and crashes JSON.parse with "Unterminated
// string". This walks the text tracking whether we're inside a string
// literal and escapes any raw newline/tab found there, without touching
// whitespace between JSON tokens (where raw newlines are harmless).
function sanitizeJsonString(raw: string): string {
  let result = "";
  let inString = false;
  let escapeNext = false;
  for (const char of raw) {
    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      result += char;
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (inString && (char === "\n" || char === "\r" || char === "\t")) {
      result += char === "\n" ? "\\n" : char === "\r" ? "\\r" : "\\t";
      continue;
    }
    result += char;
  }
  return result;
}

function parseClaudeJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(sanitizeJsonString(cleaned)) as T;
}

export type Channel = "website" | "youtube" | "facebook";
export type Language = "en" | "ur" | "roman-ur";

export interface BusinessProfile {
  businessName: string;
  niche: string;
  audience: string;
  tone: string;
}

export interface GenerateContentInput {
  channel: Channel;
  language: Language;
  topic: string;
  profile: BusinessProfile;
}

export interface GeneratedContent {
  title: string;
  body: string;
  metaDescription?: string;
  hashtags?: string[];
}

const CHANNEL_INSTRUCTIONS: Record<Channel, string> = {
  website:
    "Write SEO-optimized website/blog content: a strong page title (under 60 characters), " +
    "a meta description (under 155 characters) written to earn clicks from a search results page, " +
    "and a body of 300-500 words structured with a clear H1-equivalent opening and natural keyword usage. " +
    "Do not stuff keywords unnaturally.",
  youtube:
    "Write a YouTube video title (under 70 characters, curiosity-driven, no clickbait that misleads) " +
    "and a full video description (150-300 words) including a hook in the first two lines, " +
    "a short summary of what the video covers, and a natural call-to-action at the end. " +
    "Also suggest 8-12 relevant tags.",
  facebook:
    "Write a Facebook post: a short, scroll-stopping opening line, a body of 2-4 short paragraphs " +
    "written for a mobile feed (short sentences, no dense blocks), and a clear call-to-action. " +
    "Suggest 3-5 relevant hashtags.",
};

const LANGUAGE_INSTRUCTIONS: Record<Language, string> = {
  en: "Write entirely in English.",
  ur: "Write entirely in Urdu script (اردو), using natural, easy-to-read everyday Urdu — not overly formal/literary.",
  "roman-ur":
    "Write entirely in Roman Urdu (Urdu language written in Latin/English script), the way Pakistanis " +
    "commonly type on WhatsApp/social media — natural and conversational, not English.",
};

function buildSystemPrompt(input: GenerateContentInput): string {
  return [
    "You are the content-generation engine inside AutoSEO, an SEO and marketing platform.",
    "You generate one piece of channel-specific marketing content per request, grounded in the business profile provided.",
    "Never invent facts, prices, or claims about the business that were not given to you.",
    CHANNEL_INSTRUCTIONS[input.channel],
    LANGUAGE_INSTRUCTIONS[input.language],
    "Respond ONLY with a JSON object — no markdown fences, no preamble — matching this shape:",
    '{ "title": string, "body": string, "metaDescription"?: string, "hashtags"?: string[] }',
    'Include "metaDescription" only for the website channel. Include "hashtags" only for youtube/facebook.',
    'CRITICAL: this must be valid JSON. Any line break inside a string value (e.g. paragraph breaks in "body") must be written as the two characters \\n — never as a literal newline.',
  ].join("\n");
}

export async function generateContent(
  input: GenerateContentInput
): Promise<GeneratedContent> {
  const userMessage = [
    `Business name: ${input.profile.businessName}`,
    `Niche/industry: ${input.profile.niche}`,
    `Target audience: ${input.profile.audience}`,
    `Brand tone: ${input.profile.tone}`,
    `Topic for this piece of content: ${input.topic}`,
  ].join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: buildSystemPrompt(input),
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content returned from Claude.");
  }

  return parseClaudeJson<GeneratedContent>(textBlock.text);
}

// ---------------------------------------------------------------------
// Phase 2: SEO Analysis. Takes the raw signals pulled by lib/seo-crawler.ts
// and asks Claude to turn them into a score + prioritized, actionable fixes
// (rather than a raw data dump the user has to interpret themselves).
// ---------------------------------------------------------------------

import type { CrawlResult } from "@/lib/seo-crawler";

export interface SeoIssue {
  severity: "high" | "medium" | "low";
  issue: string;
  fix: string;
}

export interface SeoAnalysis {
  score: number; // 0-100
  summary: string;
  issues: SeoIssue[];
}

const SEO_ANALYST_SYSTEM_PROMPT = `You are the SEO analysis engine inside AutoSEO.
You receive raw on-page technical SEO signals crawled from a single page and turn them
into a 0-100 score, a one-sentence plain-language summary, and a prioritized list of
issues with concrete fixes. Be specific and practical — no generic advice like "improve
your content". Base every issue strictly on the data given; never invent facts about the
page you were not given. Respond ONLY with a JSON object, no markdown fences, no preamble,
matching this shape:
{ "score": number, "summary": string, "issues": [{ "severity": "high"|"medium"|"low", "issue": string, "fix": string }] }`;

export async function analyzeSeo(crawl: CrawlResult): Promise<SeoAnalysis> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SEO_ANALYST_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here are the crawled on-page SEO signals for ${crawl.url}:\n${JSON.stringify(
          crawl,
          null,
          2
        )}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content returned from Claude.");
  }

  return parseClaudeJson<SeoAnalysis>(textBlock.text);
}

// ---------------------------------------------------------------------
// Phase 5: Advanced Automation.
//   - generateTrendIdeas(): uses Claude's server-side web_search tool to
//     find genuinely current trending topics/angles for a niche, rather
//     than relying on the model's static training knowledge (which goes
//     stale). Requires web search to be available on the API account.
//   - generateVariants(): A/B testing — two distinct title options for the
//     same topic, so the user can compare real performance later via the
//     Analytics tab (Phase 4.5) rather than guessing which angle is better.
//   - generateReport(): turns a raw analytics snapshot into a short,
//     readable digest instead of a data dump.
// ---------------------------------------------------------------------

export interface TrendIdea {
  topic: string;
  angle: string;
  whyTrending: string;
}

export async function generateTrendIdeas(
  niche: string,
  language: Language
): Promise<TrendIdea[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: `You are the trend research module inside AutoSEO. Use web search to find
genuinely current, real discussion/trends relevant to the given niche — do not invent
trends from memory. Return 5 content ideas that are timely right now. ${LANGUAGE_INSTRUCTIONS[language]}
After your research, respond with ONLY a JSON array as your final message content (no markdown
fences, no preamble text before or after it), matching this shape:
[{ "topic": string, "angle": string, "whyTrending": string }]`,
    messages: [
      { role: "user", content: `Niche: ${niche}. Find 5 current content ideas.` },
    ],
    tools: [{ type: "web_search_20250305", name: "web_search" } as any],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  const lastText = textBlocks[textBlocks.length - 1];
  if (!lastText || lastText.type !== "text") {
    throw new Error("No text content returned from Claude.");
  }
  return parseClaudeJson<TrendIdea[]>(lastText.text);
}

export interface ContentVariants {
  variantA: { title: string };
  variantB: { title: string };
}

export async function generateVariants(
  input: GenerateContentInput
): Promise<ContentVariants> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: `You generate two genuinely different title options (not just reworded — different
angles/hooks) for A/B testing. ${CHANNEL_INSTRUCTIONS[input.channel]} ${LANGUAGE_INSTRUCTIONS[input.language]}
Respond ONLY with JSON: { "variantA": { "title": string }, "variantB": { "title": string } }`,
    messages: [
      {
        role: "user",
        content: `Business: ${input.profile.businessName} (${input.profile.niche}). Topic: ${input.topic}`,
      },
    ],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content returned from Claude.");
  }
  return parseClaudeJson<ContentVariants>(textBlock.text);
}

export async function generateReport(analyticsSnapshot: unknown): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: `You write short, plain-language weekly performance digests for a small business
owner from raw analytics data. Roman Urdu mein likhein, dostana lekin professional lehja.
2-4 short paragraphs — highlight what's working, what needs attention, and one concrete
suggestion. Never invent numbers not present in the data. If data is sparse, say so plainly.`,
    messages: [
      {
        role: "user",
        content: `Yahan analytics data hai:\n${JSON.stringify(analyticsSnapshot, null, 2)}`,
      },
    ],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content returned from Claude.");
  }
  return textBlock.text.trim();
}

// ---------------------------------------------------------------------
// Advanced SEO Fixing: turns the SEO Analyzer's flagged issues into
// concrete, ready-to-apply replacement values for an EXISTING page —
// not new content, but a fix for what's already live. This is what
// makes "advanced-level" fixing possible through the endpoint-based
// architecture (Section 5.2's adapter pattern) rather than requiring
// AutoSEO to have direct source-code access to any user's site.
// ---------------------------------------------------------------------


export interface OptimizedContent {
  title: string;
  metaDescription: string;
  h1: string;
  body: string;
  changes: string[];
  warnings: string[];
}

export async function optimizeContentWithAI(brief: unknown): Promise<OptimizedContent> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3500,
    system: `You are AutoSEO's assisted optimization engine. Rewrite the supplied page content
for the supplied target keyword and detected search intent. Produce usable SEO copy, not generic advice.
Preserve every factual claim that can be supported by the source and NEVER invent prices, reviews, ratings,
locations, guarantees, certifications, product features, statistics, or business facts. Do not keyword-stuff.
Keep the core meaning of the source. Improve title, meta description, H1, structure, topical coverage,
readability and natural semantic coverage. If a requested gap cannot be filled without inventing facts,
leave it as a warning instead.
Respond ONLY with valid JSON matching:
{ "title": string, "metaDescription": string, "h1": string, "body": string, "changes": string[], "warnings": string[] }
Title should normally be under 60 characters and meta description under 155 characters.
Use "\\n" escapes for line breaks inside JSON strings.`,
    messages: [{ role: "user", content: JSON.stringify(brief, null, 2) }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text content returned from Claude.");
  return parseClaudeJson<OptimizedContent>(textBlock.text);
}

export interface SeoFixes {
  title: string;
  metaDescription: string;
  suggestedHeadings: string[];
  schemaJsonLd: string;
  rationale: string;
}

export async function generateSeoFixes(
  crawl: CrawlResult,
  analysis: SeoAnalysis
): Promise<SeoFixes> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: `You are the SEO fix-generation engine inside AutoSEO. Given a page's crawled
data and the issues already flagged by the analyzer, produce concrete, ready-to-apply
replacement values — not more advice, actual final text/code the user can paste in or that
gets sent to their site's update endpoint. Base everything strictly on the page's actual
existing title/headings/content — never invent business facts (prices, services) not
present in the crawl data. Respond ONLY with JSON, no markdown fences, no preamble:
{ "title": string, "metaDescription": string, "suggestedHeadings": string[], "schemaJsonLd": string, "rationale": string }
"schemaJsonLd" must be a valid JSON-LD <script type="application/ld+json"> body (as a string) using
schema.org types appropriate to the page (e.g. Organization, LocalBusiness, Service, FAQPage) —
only include fields you can support from the given data, never fabricate ratings/reviews/prices.
CRITICAL: this must be valid JSON. Any line break inside a string value must be written as \\n, never a literal newline.`,
    messages: [
      {
        role: "user",
        content: `Crawled page data:\n${JSON.stringify(crawl, null, 2)}\n\nFlagged issues:\n${JSON.stringify(
          analysis.issues,
          null,
          2
        )}`,
      },
    ],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content returned from Claude.");
  }
  return parseClaudeJson<SeoFixes>(textBlock.text);
}

// ---------------------------------------------------------------------
// V26: AI Content Production Studio. Turns an approved content-strategy
// brief into production-ready content while preserving factual safety.
// ---------------------------------------------------------------------
export interface ContentStudioResult {
  title: string;
  metaDescription: string;
  h1: string;
  body: string;
  outline: string[];
  faq: Array<{ question: string; answer: string }>;
  seoKeywords: string[];
  internalLinkSuggestions: string[];
  qualityNotes: string[];
}

export async function generateContentFromBrief(brief: unknown): Promise<ContentStudioResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 5000,
    system: `You are AutoSEO's AI Content Production Studio. Create production-ready SEO content from a structured brief.
Use only facts supplied in the brief. NEVER invent prices, reviews, ratings, guarantees, certifications, statistics,
locations, products, services, policies, customer outcomes, or other business facts. If information is missing, write
neutral content or flag the limitation in qualityNotes. Do not copy competitor wording. Use competitor insights only as
high-level topic/coverage signals. Respect the requested language and channel. For website content, produce a useful,
well-structured article/page with natural keyword usage, H1, title, meta description, outline, FAQs, semantic keywords,
and internal-link suggestions. FAQs must be answerable from the brief; do not fabricate facts. For YouTube/Facebook,
adapt the body to the channel while retaining SEO intent. Respond ONLY with valid JSON matching:
{ "title": string, "metaDescription": string, "h1": string, "body": string, "outline": string[],
  "faq": [{"question": string, "answer": string}], "seoKeywords": string[],
  "internalLinkSuggestions": string[], "qualityNotes": string[] }
Title should normally be under 60 characters and meta description under 155 characters. Use \\n escapes for line breaks inside JSON strings.`,
    messages: [{ role: "user", content: JSON.stringify(brief, null, 2) }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text content returned from Claude.");
  return parseClaudeJson<ContentStudioResult>(textBlock.text);
}
