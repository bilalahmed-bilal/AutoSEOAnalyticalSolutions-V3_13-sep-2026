import type { NextRequest } from "next/server";
import { supabaseRest } from "@/lib/db/supabase-rest";

function q(params: Record<string,string>) { return "?" + new URLSearchParams(params).toString(); }
export async function saveTechnicalAudit(ctx:{req:NextRequest;workspaceId:string}, input:{targetUrl:string;score:number;summary:any;report:any;createdBy?:string}) {
  const [row] = await supabaseRest<any[]>(ctx.req,"technical_seo_audits",{method:"POST",body:JSON.stringify({workspace_id:ctx.workspaceId,target_url:input.targetUrl,score:input.score,summary:input.summary,report:input.report,created_by:input.createdBy||null}),headers:{Prefer:"return=representation"}});
  return row;
}
export async function listTechnicalAudits(ctx:{req:NextRequest;workspaceId:string}) { return supabaseRest<any[]>(ctx.req,"technical_seo_audits",{},q({workspace_id:`eq.${ctx.workspaceId}`,order:"created_at.desc",limit:"25"})); }
export async function getTechnicalAudit(ctx:{req:NextRequest;workspaceId:string},id:string) { const rows=await supabaseRest<any[]>(ctx.req,"technical_seo_audits",{},q({workspace_id:`eq.${ctx.workspaceId}`,id:`eq.${id}`,limit:"1"})); return rows[0]||null; }
