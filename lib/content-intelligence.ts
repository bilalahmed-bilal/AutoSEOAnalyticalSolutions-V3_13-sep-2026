import type { CrawlResult } from "@/lib/seo-crawler";

export type ContentIntent = "informational" | "commercial" | "transactional" | "navigational" | "mixed";
export interface ContentGap { topic: string; reason: string; priority: "high" | "medium" | "low"; }
export interface ContentIntelligenceResult {
  keyword: string;
  intent: ContentIntent;
  score: number;
  metrics: {
    wordCount: number;
    paragraphs: number;
    keywordOccurrences: number;
    keywordDensityPercent: number;
    uniqueTerms: number;
    headingCount: number;
    headingsWithKeyword: number;
    semanticTerms: string[];
    entities: string[];
    internalLinkOpportunities: string[];
  };
  topicCoverage: { covered: string[]; missing: string[] };
  gaps: ContentGap[];
  recommendations: string[];
}

const STOP = new Set("the a an and or but for with from this that your you are was were has have had into onto about after before between through over under is it to of in on as by be do does did can could should will would may might not no yes at we they he she their our its i me my mine them these those how what why when where which who guide tips best review reviews price pricing buy order book booking near cheap services service company official online".split(/\s+/));

function normalize(s: string) { return s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim(); }
function tokens(s: string) { return normalize(s).split(/\s+/).filter(x => x.length >= 3 && !STOP.has(x)); }
function count(text: string, keyword: string) { const t=normalize(text), k=normalize(keyword); return k ? (t.split(k).length-1) : 0; }
function intent(keyword: string): ContentIntent {
  const k=normalize(keyword); const groups=[
    /\b(buy|order|purchase|book|hire|price|pricing|cheap|deal|quote|subscribe)\b/.test(k),
    /\b(best|top|review|reviews|compare|comparison|vs|alternative)\b/.test(k),
    /\b(what|why|how|guide|tutorial|learn|meaning|definition|tips|examples)\b/.test(k),
    /\b(login|signin|official|website|contact|address)\b/.test(k)
  ]; const n=groups.filter(Boolean).length; if(n>1)return "mixed"; if(groups[0])return "transactional"; if(groups[1])return "commercial"; if(groups[2])return "informational"; if(groups[3])return "navigational"; return "mixed";
}

function topTerms(text: string, keyword: string, limit=20): string[] {
  const freq=new Map<string,number>(); for(const t of tokens(text)) freq.set(t,(freq.get(t)||0)+1);
  return [...freq.entries()].filter(([t])=>!normalize(keyword).split(/\s+/).includes(t)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([t])=>t);
}
function extractEntities(crawl: CrawlResult): string[] {
  const out=new Set<string>();
  for(const h of crawl.headingTexts) for(const phrase of h.match(/\b[A-Z][A-Za-z0-9&'’-]{2,}(?:\s+[A-Z][A-Za-z0-9&'’-]{2,}){0,3}/g)||[]) out.add(phrase.trim());
  for(const t of crawl.jsonLdTypes) out.add(t);
  return [...out].slice(0,20);
}
function topicGaps(crawl: CrawlResult, kw: string): {covered:string[];missing:string[]} {
  const i=intent(kw); const required = i==="transactional"?["price","availability","how to order","contact"]:i==="commercial"?["comparison","features","reviews","price"]:i==="informational"?["definition","examples","steps","faq"]:["overview","contact","official"];
  const hay=normalize(crawl.readableText+" "+crawl.headingTexts.join(" ")); const covered=required.filter(x=>hay.includes(x)); return {covered, missing:required.filter(x=>!covered.includes(x))};
}

export function analyzeContent(crawl: CrawlResult, keyword: string): ContentIntelligenceResult {
  const kw=normalize(keyword); if(!kw) throw new Error("Target keyword is required.");
  const text=crawl.readableText; const occurrences=count(text,kw); const density=crawl.wordCount?occurrences/crawl.wordCount*100:0;
  const headings=crawl.headingTexts; const headingMatches=headings.filter(h=>normalize(h).includes(kw)).length; const terms=topTerms(text,kw); const gaps=topicGaps(crawl,kw);
  const paragraphs=text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
  const scoreParts=[crawl.wordCount>=600?20:crawl.wordCount>=300?12:4, occurrences>=3?20:occurrences>=1?10:0, headingMatches>=2?15:headingMatches?9:0, terms.length>=12?15:terms.length>=6?9:4, gaps.missing.length===0?15:Math.max(0,15-gaps.missing.length*4), crawl.internalLinkCount>=3?10:crawl.internalLinkCount?5:0, crawl.h1s.length===1?5:0];
  const score=Math.max(0,Math.min(100,scoreParts.reduce((a,b)=>a+b,0)));
  const contentGaps=gaps.missing.map(topic=>({topic,reason:`The page does not visibly cover the ${topic} topic for the detected ${intent(kw)} intent.`,priority:(topic==="price"||topic==="steps"?"high":"medium") as "high"|"medium"}));
  const recommendations=[`Align the opening section with ${intent(kw)} intent and answer the primary need quickly.`,occurrences?"Keep keyword usage natural and diversify wording with related concepts.":"Introduce the target keyword naturally in the body content.",terms.length?`Expand semantic coverage around: ${terms.slice(0,8).join(", ")}.`:"Add relevant supporting terminology and entities.",gaps.missing.length?`Address missing topic areas: ${gaps.missing.join(", ")}.`:"Maintain broad topic coverage without padding the page.",crawl.internalLinkCount<3?"Add relevant internal links to supporting and related pages.":"Review internal links for topical relevance and descriptive anchor text."];
  return {keyword, intent:intent(kw), score, metrics:{wordCount:crawl.wordCount,paragraphs,keywordOccurrences:occurrences,keywordDensityPercent:Number(density.toFixed(3)),uniqueTerms:terms.length,headingCount:headings.length,headingsWithKeyword:headingMatches,semanticTerms:terms,entities:extractEntities(crawl),internalLinkOpportunities:crawl.linkAnchors.filter(a=>a.length>3).slice(0,15)},topicCoverage:gaps,gaps:contentGaps,recommendations};
}
