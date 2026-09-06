import type { NextRequest } from "next/server";
import { supabaseRest } from "@/lib/db/supabase-rest";
const q=(p:Record<string,string>)=>"?"+new URLSearchParams(p).toString();
export async function createOperatingRun(ctx:{req:NextRequest;workspaceId:string},input:{targetUrl:string;cycle:any;createdBy?:string}){const [r]=await supabaseRest<any[]>(ctx.req,"operating_runs",{method:"POST",body:JSON.stringify({workspace_id:ctx.workspaceId,target_url:input.targetUrl,score:input.cycle.score,status:input.cycle.status,summary:input.cycle.summary,cycle:input.cycle,created_by:input.createdBy||null}),headers:{Prefer:"return=representation"}});return r||null;}
export async function listOperatingRuns(ctx:{req:NextRequest;workspaceId:string}){return supabaseRest<any[]>(ctx.req,"operating_runs",{},q({workspace_id:`eq.${ctx.workspaceId}`,order:"created_at.desc",limit:"25"}));}
