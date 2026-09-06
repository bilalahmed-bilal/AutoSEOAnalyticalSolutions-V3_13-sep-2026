import { crawlSite, type CrawlResult, type SiteCrawlResult } from "@/lib/seo-crawler";
import type { KeywordOpportunity } from "@/lib/keyword-research-repository";

export type LinkOpportunityType = "contextual" | "hub" | "orphan" | "anchor";
export interface LinkOpportunity { type: LinkOpportunityType; sourceUrl: string; targetUrl: string; anchorSuggestion: string; score: number; severity: "high"|"medium"|"low"; reason: string; }
export interface SiteArchitectureAnalysis {
  site: SiteCrawlResult;
  summary: { pages:number; internalLinks:number; orphanPages:number; linkOpportunities:number; hubPages:number; weakPages:number; architectureScore:number };
  orphanPages: string[];
  hubs: Array<{url:string; score:number; incoming:number; outgoing:number}>;
  opportunities: LinkOpportunity[];
  recommendations: string[];
}

const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9\s-]/g," ").replace(/\s+/g," ").trim();
const tokens=(s:string)=>new Set(norm(s).split(/\s+/).filter(x=>x.length>2));
const path=(u:string)=>{try{return new URL(u).pathname.replace(/\/$/,"")||"/"}catch{return u}};
const corpus=(p:CrawlResult)=>[p.title||"",p.metaDescription||"",...p.h1s,...p.headingTexts,p.readableText,...p.linkAnchors].join(" ");
function similarity(a:string,b:string){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let hit=0;A.forEach(x=>{if(B.has(x))hit++});return hit/Math.max(1,Math.min(A.size,B.size));}
function anchorFor(source:CrawlResult,target:CrawlResult,keywords:KeywordOpportunity[]){
  const targetText=norm(corpus(target));
  const kw=keywords.find(k=>{const t=tokens(k.keyword);let h=0;t.forEach(x=>{if(targetText.includes(x))h++});return t.size&&h/t.size>=.6});
  if(kw) return kw.keyword;
  return target.h1s[0]||target.title||path(target.url).split("/").filter(Boolean).pop()||"Learn more";
}
function isIndexable(p:CrawlResult){return !p.noindex && p.statusCode>=200 && p.statusCode<400;}

export async function analyzeSiteArchitecture(targetUrl:string, keywordOpportunities:KeywordOpportunity[]=[], maxPages=30):Promise<SiteArchitectureAnalysis>{
  const site=await crawlSite(targetUrl,Math.min(60,Math.max(5,maxPages)));
  const pages=site.pages.filter(isIndexable);
  const byUrl=new Map(pages.map(p=>[p.url,p]));
  const incoming=new Map<string,number>(pages.map(p=>[p.url,0]));
  let internalLinks=0;
  for(const p of pages){
    for(const a of p.linkAnchors) void a;
    internalLinks+=p.internalLinkCount;
    // CrawlResult exposes counts but not link destinations; derive destinations from readable page HTML is intentionally avoided.
    // We use crawler-discovered page URLs and title/topic similarity for safe, reviewable opportunities.
  }
  const orphanPages=pages.filter(p=>p.url!==site.startUrl && (p.internalLinkCount===0 || ![...pages].some(x=>x.url!==p.url && similarity(corpus(x),corpus(p))>.72))).map(p=>p.url);
  // Approximate inbound strength from co-topic relationships, not claims about actual anchor graph.
  const hubs=pages.map(p=>{const score=Math.round(Math.min(100,p.internalLinkCount*8+Math.min(40,p.headingTexts.length*4)+(p.wordCount>800?20:0)));return {url:p.url,score,incoming:incoming.get(p.url)||0,outgoing:p.internalLinkCount};}).sort((a,b)=>b.score-a.score).slice(0,10);
  const opportunities:LinkOpportunity[]=[];
  for(const source of pages){
    for(const target of pages){
      if(source.url===target.url)continue;
      const sim=similarity(corpus(source),corpus(target));
      if(sim<.18)continue;
      const targetOrphan=orphanPages.includes(target.url);
      const score=Math.min(100,Math.round(35+sim*55+(targetOrphan?15:0)+(target.wordCount<300?5:0)));
      if(score<55)continue;
      opportunities.push({type:targetOrphan?"orphan":"contextual",sourceUrl:source.url,targetUrl:target.url,anchorSuggestion:anchorFor(source,target,keywordOpportunities),score,severity:score>=80?"high":score>=65?"medium":"low",reason:targetOrphan?"The target page appears weakly connected to the crawled site; add a contextual link from a closely related page.":"The source and target have meaningful topical overlap; a contextual internal link may improve discovery and topic relationships."});
    }
  }
  const dedup=new Map<string,LinkOpportunity>();for(const o of opportunities){const k=`${o.sourceUrl}|${o.targetUrl}`;if(!dedup.has(k))dedup.set(k,o)}
  const final=[...dedup.values()].sort((a,b)=>b.score-a.score).slice(0,120);
  const weakPages=pages.filter(p=>p.internalLinkCount<2 || p.wordCount<250).map(p=>p.url);
  const architectureScore=Math.max(0,Math.min(100,Math.round(100-(orphanPages.length/Math.max(1,pages.length))*35-(weakPages.length/Math.max(1,pages.length))*20-(pages.length>0&&internalLinks/pages.length<2?20:0))));
  const recommendations=[
    ...(orphanPages.length?[`Prioritize ${orphanPages.length} weakly connected page(s) and add relevant contextual links from established pages.`]:[]),
    ...(weakPages.length?[`Review ${weakPages.length} page(s) with very few internal links or thin crawlable content.`]:[]),
    ...(hubs.length?[`Use strong hub pages such as “${hubs[0].url}” to distribute links to closely related supporting pages.`]:[]),
    "Keep anchor text descriptive and natural; avoid repetitive exact-match anchors.",
    "Use internal links to clarify topic relationships, not simply to increase link counts."
  ];
  return {site,summary:{pages:pages.length,internalLinks,orphanPages:orphanPages.length,linkOpportunities:final.length,hubPages:hubs.length,weakPages:weakPages.length,architectureScore},orphanPages,hubs,opportunities:final,recommendations:[...new Set(recommendations)]};
}
