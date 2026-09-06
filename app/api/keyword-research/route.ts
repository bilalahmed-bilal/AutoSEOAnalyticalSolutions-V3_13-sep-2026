import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getTenantContext } from "@/lib/tenant";
import { crawlSite } from "@/lib/seo-crawler";
import { generateKeywordCandidates, summarizeKeywordResearch } from "@/lib/keyword-research";
import { createKeywordResearch, listKeywordResearch, replaceKeywordOpportunities } from "@/lib/keyword-research-repository";
import { getSearchConsoleKeywordQueries } from "@/lib/analytics/search-console-keywords";

export async function GET(req:NextRequest){
  const access=await requireApiAccess(req); if(!access)return unauthorizedResponse();
  if(!access.authenticated)return NextResponse.json({projects:[]});
  const p=await requireWorkspaceRole(req,"viewer"); if(!isRoleResult(p))return p;
  return NextResponse.json({projects:await listKeywordResearch({req,workspaceId:p.tenant.workspaceId})});
}
export async function POST(req:NextRequest){
  const access=await requireApiAccess(req); if(!access)return unauthorizedResponse();
  if(!access.authenticated)return unauthorizedResponse();
  const p=await requireWorkspaceRole(req,"editor"); if(!isRoleResult(p))return p;
  const body=await req.json();
  const seed=String(body.seedKeyword||"").trim(); const targetUrl=String(body.targetUrl||"").trim();
  if(!seed)return NextResponse.json({error:"seedKeyword is required."},{status:400});
  let crawl:any=null;
  if(targetUrl){try{crawl=(await crawlSite(targetUrl,1)).pages?.[0] || null;}catch(e:any){return NextResponse.json({error:`Target URL crawl failed: ${e?.message||"Unable to crawl URL."}`},{status:400});}}
  let gscQueries:string[]=[]; let gscConnected=false;
  try{const end=new Date(Date.now()-3*86400000);const start=new Date(end.getTime()-28*86400000);const r=await getSearchConsoleKeywordQueries(p.tenant.workspaceId,start.toISOString().slice(0,10),end.toISOString().slice(0,10),seed);gscQueries=r.queries.map(String);gscConnected=r.connected;}catch{ /* GSC is optional; local discovery remains usable. */ }
  const candidates=generateKeywordCandidates(seed,crawl,gscQueries);
  const summary={...summarizeKeywordResearch(candidates),gscConnected,gscQueryCount:gscQueries.length,targetUrl:targetUrl||null};
  const project=await createKeywordResearch({req,workspaceId:p.tenant.workspaceId},{name:String(body.name||`${seed} keyword research`).trim(),seedKeyword:seed,targetUrl,status:"ready",summary,createdBy:p.tenant.user.id});
  const opportunities=await replaceKeywordOpportunities({req,workspaceId:p.tenant.workspaceId},project.id,candidates);
  return NextResponse.json({project,opportunities},{status:201});
}
