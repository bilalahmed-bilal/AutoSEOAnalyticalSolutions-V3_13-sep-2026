import { NextRequest } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { runTechnicalAudit, summarizeTechnicalAudit } from "@/lib/technical-seo";
import { saveTechnicalAudit, listTechnicalAudits } from "@/lib/technical-seo-repository";

export async function GET(req: NextRequest) {
  const access=await requireApiAccess(req); if(!access) return unauthorizedResponse();
  const tenant=await getTenantContext(req); if(!tenant) return Response.json({error:"Workspace access required."},{status:403});
  try { return Response.json({audits:await listTechnicalAudits({req,workspaceId:tenant.workspaceId})}); } catch(e:any){ return Response.json({error:e.message||"Unable to load audits."},{status:500}); }
}
export async function POST(req: NextRequest) {
  const access=await requireApiAccess(req); if(!access) return unauthorizedResponse();
  const tenant=await getTenantContext(req); if(!tenant) return Response.json({error:"Workspace access required."},{status:403});
  const body=await req.json().catch(()=>({}));
  if(typeof body.url!=="string"||!body.url.trim()) return Response.json({error:"url is required."},{status:400});
  try {
    const result=await runTechnicalAudit(body.url.trim(), Number(body.maxPages)||25);
    const summary=summarizeTechnicalAudit(result.site,result.fixes);
    const saved=await saveTechnicalAudit({req,workspaceId:tenant.workspaceId},{targetUrl:result.site.startUrl,score:result.score,summary,report:{site:result.site,fixes:result.fixes},createdBy:access.user.id});
    return Response.json({audit:{id:saved.id,targetUrl:saved.target_url,score:saved.score,summary:saved.summary,report:saved.report,createdAt:saved.created_at}});
  } catch(e:any){ return Response.json({error:e.message||"Technical SEO audit failed."},{status:400}); }
}
