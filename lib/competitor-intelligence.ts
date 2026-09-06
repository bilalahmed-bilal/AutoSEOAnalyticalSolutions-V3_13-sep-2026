import { crawlSite, type CrawlResult, type SiteCrawlResult } from "@/lib/seo-crawler";
import type { KeywordOpportunity } from "@/lib/keyword-research-repository";

export type GapType = "keyword" | "content" | "technical";
export interface CompetitorGap { gapType: GapType; keyword?: string; competitorUrl: string; evidenceUrls: string[]; score: number; severity: "high"|"medium"|"low"; recommendation: string; }
export interface CompetitorAnalysis { target: SiteCrawlResult; competitors: Array<{url:string; crawl:SiteCrawlResult}>; summary:{competitors:number; targetPages:number; competitorPages:number; keywordGaps:number; contentGaps:number; technicalGaps:number; opportunityScore:number}; gaps:CompetitorGap[]; recommendations:string[]; }

const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9\s-]/g," ").replace(/\s+/g," ").trim();
const tokens=(s:string)=>new Set(norm(s).split(/\s+/).filter(x=>x.length>2));
function pageCorpus(p:CrawlResult){return [p.title||"",p.metaDescription||"",...p.h1s,...p.headingTexts,p.readableText,...p.linkAnchors].join(" ");}
function covered(keyword:string,pages:CrawlResult[]){const k=tokens(keyword); return pages.filter(p=>{const t=tokens(pageCorpus(p)); let hit=0;k.forEach(x=>{if(t.has(x))hit++;}); return k.size>0 && hit/ k.size >= .7;});}
function bestTechnicalIssues(pages:CrawlResult[]){
 const issues:{key:string;count:number;recommendation:string;severity:"high"|"medium"|"low"}[]=[
  {key:"missing_title",count:pages.filter(p=>!p.title).length,recommendation:"Add a unique, descriptive title to every indexable page.",severity:"high"},
  {key:"missing_meta",count:pages.filter(p=>!p.metaDescription).length,recommendation:"Add unique meta descriptions aligned with search intent.",severity:"medium"},
  {key:"missing_h1",count:pages.filter(p=>p.h1s.length===0).length,recommendation:"Add one clear primary H1 per page.",severity:"high"},
  {key:"missing_canonical",count:pages.filter(p=>!p.hasCanonicalTag).length,recommendation:"Add self-referencing or intentional canonical URLs.",severity:"medium"},
  {key:"missing_schema",count:pages.filter(p=>p.jsonLdCount===0).length,recommendation:"Add relevant structured data where it genuinely describes the page.",severity:"low"},
  {key:"missing_alt",count:pages.reduce((n,p)=>n+p.imagesMissingAlt,0),recommendation:"Add meaningful alt text to informative images.",severity:"low"},
 ]; return issues.filter(x=>x.count>0);
}
export async function analyzeCompetitors(targetUrl:string, competitorUrls:string[], keywordOpportunities:KeywordOpportunity[], maxPages=12):Promise<CompetitorAnalysis>{
 const target=await crawlSite(targetUrl,maxPages);
 const unique=[...new Set(competitorUrls.map(x=>x.trim()).filter(Boolean))].slice(0,5);
 const competitors:Array<{url:string;crawl:SiteCrawlResult}>=[];
 for(const url of unique){const crawl=await crawlSite(url,maxPages);competitors.push({url,crawl});}
 const gaps:CompetitorGap[]=[];
 for(const op of keywordOpportunities.slice(0,100)){
  const targetHits=covered(op.keyword,target.pages); if(targetHits.length) continue;
  const evidence=competitors.flatMap(c=>covered(op.keyword,c.crawl.pages).slice(0,2).map(p=>p.url));
  if(!evidence.length) continue;
  const score=Math.min(100,Math.round(45+op.opportunityScore*.45+Math.min(10,evidence.length*2)));
  gaps.push({gapType:"keyword",keyword:op.keyword,competitorUrl:competitors.find(c=>evidence.some(u=>c.crawl.pages.some(p=>p.url===u)))?.url||competitors[0].url,evidenceUrls:[...new Set(evidence)].slice(0,4),score,severity:score>=80?"high":score>=60?"medium":"low",recommendation:`Consider a dedicated page or meaningful section for “${op.keyword}” if it matches your audience and intent.`});
 }
 const targetHeadings=new Set(target.pages.flatMap(p=>p.headingTexts.map(norm)).filter(Boolean));
 for(const c of competitors){
  for(const p of c.crawl.pages){for(const h of p.headingTexts.filter(Boolean).slice(0,30)){const n=norm(h);if(n.length<5||targetHeadings.has(n))continue; const score=Math.min(100,55+Math.min(30,n.split(" ").length*4));gaps.push({gapType:"content",competitorUrl:c.url,evidenceUrls:[p.url],score,severity:score>=80?"high":score>=65?"medium":"low",recommendation:`Review the competitor topic “${h}” and cover it only if it adds useful, original value for your audience.`});}}
 }
 const targetIssues=bestTechnicalIssues(target.pages); const compIssues=competitors.flatMap(c=>bestTechnicalIssues(c.crawl.pages));
 for(const issue of targetIssues){const targetRate=issue.count/Math.max(1,target.pages.length);const compRate=compIssues.filter(x=>x.key===issue.key).reduce((n)=>n+1,0)/Math.max(1,competitors.length);if(targetRate>=.25){const score=Math.min(100,Math.round(50+targetRate*50+(compRate<targetRate?10:0)));gaps.push({gapType:"technical",competitorUrl:competitors[0]?.url||targetUrl,evidenceUrls:target.pages.filter(p=>{if(issue.key==="missing_title")return !p.title;if(issue.key==="missing_meta")return !p.metaDescription;if(issue.key==="missing_h1")return !p.h1s.length;if(issue.key==="missing_canonical")return !p.hasCanonicalTag;if(issue.key==="missing_schema")return !p.jsonLdCount;return p.imagesMissingAlt>0}).slice(0,4).map(p=>p.url),score,severity:issue.severity,recommendation:issue.recommendation});}}
 const dedup=new Map<string,CompetitorGap>(); for(const g of gaps){const key=`${g.gapType}|${g.keyword||g.recommendation}|${g.evidenceUrls[0]||""}`;if(!dedup.has(key))dedup.set(key,g);} const final=[...dedup.values()].sort((a,b)=>b.score-a.score).slice(0,100);
 const recommendations=[...new Set(final.slice(0,8).map(g=>g.recommendation))];
 return {target,competitors,summary:{competitors:competitors.length,targetPages:target.pages.length,competitorPages:competitors.reduce((n,c)=>n+c.crawl.pages.length,0),keywordGaps:final.filter(g=>g.gapType==="keyword").length,contentGaps:final.filter(g=>g.gapType==="content").length,technicalGaps:final.filter(g=>g.gapType==="technical").length,opportunityScore:final.length?Math.round(final.reduce((n,g)=>n+g.score,0)/final.length):0},gaps:final,recommendations};
}
