import type { NextRequest } from "next/server";
import { supabaseRest } from "@/lib/db/supabase-rest";
import type { KeywordCandidate } from "@/lib/keyword-research";

export interface KeywordResearchProject { id:string; workspaceId:string; name:string; seedKeyword:string; targetUrl?:string; status:string; summary:any; createdBy?:string; createdAt:string; updatedAt:string; }
export interface KeywordOpportunity extends KeywordCandidate { id:string; projectId:string; createdAt:string; }

function q(params:Record<string,string>) { return "?" + Object.entries(params).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join("&"); }
function mapProject(r:any):KeywordResearchProject{return{id:r.id,workspaceId:r.workspace_id,name:r.name,seedKeyword:r.seed_keyword,targetUrl:r.target_url??undefined,status:r.status,summary:r.summary??{},createdBy:r.created_by??undefined,createdAt:r.created_at,updatedAt:r.updated_at};}
function mapOpportunity(r:any):KeywordOpportunity{return{id:r.id,projectId:r.project_id,keyword:r.keyword,normalizedKeyword:r.normalized_keyword,source:r.source,intent:r.intent,relevanceScore:r.relevance_score,opportunityScore:r.opportunity_score,difficultyScore:r.difficulty_score,contentFitScore:r.content_fit_score,currentSignalScore:r.current_signal_score,tier:r.tier,recommendedContentType:r.recommended_content_type,recommendation:r.recommendation,createdAt:r.created_at};}

export async function createKeywordResearch(ctx:{req:NextRequest;workspaceId:string}, input:{name:string;seedKeyword:string;targetUrl?:string;status?:string;summary?:any;createdBy?:string}) {
  const [row] = await supabaseRest<any[]>(ctx.req,"keyword_research_projects",{method:"POST",body:JSON.stringify({workspace_id:ctx.workspaceId,name:input.name,seed_keyword:input.seedKeyword,target_url:input.targetUrl||null,status:input.status||"ready",summary:input.summary||{},created_by:input.createdBy||null}),headers:{Prefer:"return=representation"}});
  return mapProject(row);
}
export async function updateKeywordResearch(ctx:{req:NextRequest;workspaceId:string},id:string,patch:Record<string,unknown>) {
  const rows=await supabaseRest<any[]>(ctx.req,"keyword_research_projects",{method:"PATCH",body:JSON.stringify(patch),headers:{Prefer:"return=representation"}},q({workspace_id:`eq.${ctx.workspaceId}`,id:`eq.${id}`}));
  return rows[0]?mapProject(rows[0]):null;
}
export async function listKeywordResearch(ctx:{req:NextRequest;workspaceId:string}) { const rows=await supabaseRest<any[]>(ctx.req,"keyword_research_projects",{},q({workspace_id:`eq.${ctx.workspaceId}`,order:"created_at.desc"})); return rows.map(mapProject); }
export async function getKeywordResearch(ctx:{req:NextRequest;workspaceId:string},id:string) { const rows=await supabaseRest<any[]>(ctx.req,"keyword_research_projects",{},q({workspace_id:`eq.${ctx.workspaceId}`,id:`eq.${id}`,limit:"1"})); return rows[0]?mapProject(rows[0]):null; }
export async function replaceKeywordOpportunities(ctx:{req:NextRequest;workspaceId:string},projectId:string,candidates:KeywordCandidate[]) {
  await supabaseRest(ctx.req,"keyword_opportunities",{method:"DELETE"},q({workspace_id:`eq.${ctx.workspaceId}`,project_id:`eq.${projectId}`}));
  if (!candidates.length) return [];
  const rows=await supabaseRest<any[]>(ctx.req,"keyword_opportunities",{method:"POST",body:JSON.stringify(candidates.map(c=>({workspace_id:ctx.workspaceId,project_id:projectId,keyword:c.keyword,normalized_keyword:c.normalizedKeyword,source:c.source,intent:c.intent,relevance_score:c.relevanceScore,opportunity_score:c.opportunityScore,difficulty_score:c.difficultyScore,content_fit_score:c.contentFitScore,current_signal_score:c.currentSignalScore,tier:c.tier,recommended_content_type:c.recommendedContentType,recommendation:c.recommendation}))),headers:{Prefer:"return=representation"}});
  return rows.map(mapOpportunity);
}
export async function listKeywordOpportunities(ctx:{req:NextRequest;workspaceId:string},projectId:string) { const rows=await supabaseRest<any[]>(ctx.req,"keyword_opportunities",{},q({workspace_id:`eq.${ctx.workspaceId}`,project_id:`eq.${projectId}`,order:"opportunity_score.desc"})); return rows.map(mapOpportunity); }
