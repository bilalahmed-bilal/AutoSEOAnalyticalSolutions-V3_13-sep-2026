import type { KeywordOpportunity } from "@/lib/keyword-research-repository";

export type StrategyContentType = "pillar" | "cluster-article" | "landing-page" | "comparison" | "faq" | "local-page";
export type StrategyPriority = "critical" | "high" | "medium" | "low";
export interface StrategyItem { keyword:string; intent:string; contentType:StrategyContentType; topic:string; cluster:string; priority:StrategyPriority; score:number; rationale:string; suggestedTitle:string; internalLinkTargets:string[]; }
export interface ContentStrategy { summary:{items:number;clusters:number;priority:number;high:number;medium:number;low:number;pillarPages:number;supportingPages:number}; clusters:Array<{name:string;primaryKeyword:string;keywords:string[];score:number;contentType:StrategyContentType}>; items:StrategyItem[]; cannibalization:string[]; recommendations:string[]; }

const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9\s-]/g," ").replace(/\s+/g," ").trim();
const words=(s:string)=>norm(s).split(/\s+/).filter(Boolean);
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
function clusterName(k:string){const w=words(k).filter(x=>!new Set(["the","and","for","with","near","best","how","what","is","in","to","of","on","a","an"]).has(x));return w.slice(0,3).join(" ")||k;}
function titleFor(k:string,type:StrategyContentType){if(type==="pillar")return `${k}: Complete Guide`;if(type==="landing-page")return `${k} — Services, Pricing & Options`;if(type==="comparison")return `${k}: Comparison & Best Options`;if(type==="faq")return `${k}: Frequently Asked Questions`;if(type==="local-page")return `${k} — Local Guide & Services`;return `${k}: Practical Guide`}
function typeFor(o:KeywordOpportunity):StrategyContentType { if(o.recommendedContentType==="landing-page")return "landing-page";if(o.recommendedContentType==="comparison")return "comparison";if(o.recommendedContentType==="faq")return "faq";if(o.recommendedContentType==="local-page")return "local-page";return "cluster-article"; }
export function buildContentStrategy(opps:KeywordOpportunity[], competitorGaps:any[]=[]):ContentStrategy{
 const ranked=[...opps].sort((a,b)=>b.opportunityScore-a.opportunityScore).slice(0,80); const map=new Map<string,StrategyItem>();
 for(const o of ranked){const c=clusterName(o.keyword);const gap=competitorGaps.find(g=>g.gapType==="keyword"&&norm(g.keyword||"")===norm(o.keyword));const boost=gap?10:0;const score=clamp(o.opportunityScore+boost);const type=typeFor(o);const priority:StrategyPriority=score>=85?"critical":score>=72?"high":score>=58?"medium":"low";const existing=map.get(norm(o.keyword));if(!existing)map.set(norm(o.keyword),{keyword:o.keyword,intent:o.intent,contentType:type,topic:o.keyword,cluster:c,priority,score,rationale:gap?"High-value keyword opportunity reinforced by competitor coverage gap.":o.recommendation,suggestedTitle:titleFor(o.keyword,type),internalLinkTargets:[]});}
 const items=[...map.values()]; const groups=new Map<string,StrategyItem[]>();for(const i of items)groups.set(i.cluster,[...(groups.get(i.cluster)||[]),i]);
 const clusters=[...groups.entries()].map(([name,list])=>{list.sort((a,b)=>b.score-a.score);const primary=list[0];const keywords=list.map(x=>x.keyword);list.forEach((x,idx)=>{x.contentType=idx===0&&x.score>=72?"pillar":x.contentType;if(x.contentType==="pillar")x.suggestedTitle=titleFor(x.keyword,"pillar");x.internalLinkTargets=list.filter(y=>y!==x).slice(0,3).map(y=>y.keyword);});return{name,primaryKeyword:primary.keyword,keywords,score:clamp(list.reduce((n,x)=>n+x.score,0)/list.length),contentType:list.length>1?"pillar":primary.contentType};}).sort((a,b)=>b.score-a.score).slice(0,20);
 const cannibalization:string[]=[];for(const [,list] of groups){if(list.length>3)cannibalization.push(`Cluster “${list[0].cluster}” has ${list.length} related targets; assign one primary intent/page and make the rest clearly supporting content.`);}
 const recommendations=[...new Set(clusters.slice(0,6).map(c=>`Build a topic cluster around “${c.primaryKeyword}” with one authoritative pillar and supporting pages for distinct search intents.`))];
 const priority=items.filter(x=>x.priority==="critical").length, high=items.filter(x=>x.priority==="high").length, medium=items.filter(x=>x.priority==="medium").length, low=items.filter(x=>x.priority==="low").length;
 return{summary:{items:items.length,clusters:clusters.length,priority,high,medium,low,pillarPages:items.filter(x=>x.contentType==="pillar").length,supportingPages:items.filter(x=>x.contentType!=="pillar").length},clusters,items,cannibalization,recommendations};
}
