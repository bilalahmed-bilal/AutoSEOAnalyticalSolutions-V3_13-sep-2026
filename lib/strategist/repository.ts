import { supabaseAdmin } from "@/lib/db/supabase-rest";
import type { StrategyPlan } from "./engine";
const q=(p:Record<string,string>)=>"?"+new URLSearchParams(p).toString();
export async function createStrategyRun(input:{workspaceId:string;targetUrl:string;plan:StrategyPlan;createdBy?:string;aiSummary?:string|null}){const [r]=await supabaseAdmin<any[]>("strategy_runs",{method:"POST",body:JSON.stringify({workspace_id:input.workspaceId,target_url:input.targetUrl,overall_priority:input.plan.overallPriority,confidence:input.plan.confidence,summary:input.plan.summary,plan:input.plan,ai_summary:input.aiSummary||null,created_by:input.createdBy||null}),headers:{Prefer:"return=representation"}},"");return r||null;}
export async function listStrategyRuns(workspaceId:string){return supabaseAdmin<any[]>("strategy_runs",{},q({workspace_id:`eq.${workspaceId}`,order:"created_at.desc",limit:"25"}));}
export async function getStrategyRun(workspaceId:string,id:string){const r=await supabaseAdmin<any[]>("strategy_runs",{},q({workspace_id:`eq.${workspaceId}`,id:`eq.${id}`,limit:"1"}));return r[0]||null;}
