import {NextRequest,NextResponse} from "next/server";
import {requireApiAccess,unauthorizedResponse} from "@/lib/auth/api-access";
import {getTenantContext} from "@/lib/tenant";
import {requireWorkspaceRole,isRoleResult} from "@/lib/auth/rbac";
import {buildOperatingCycle} from "@/lib/os/engine";
import {createOperatingRun,listOperatingRuns} from "@/lib/os/repository";
import {buildStrategyPlan} from "@/lib/strategist/engine";
import {listMonitoringProfiles,listMonitoringSnapshots} from "@/lib/monitoring/repository";
import {buildAdvancedAnalytics} from "@/lib/analytics/advanced";
import {supabaseRest} from "@/lib/db/supabase-rest";
export async function GET(req:NextRequest){const a=await requireApiAccess(req);if(!a)return unauthorizedResponse();const t=await getTenantContext(req);if(!t)return NextResponse.json({error:"Workspace access required."},{status:403});return NextResponse.json({runs:await listOperatingRuns({req,workspaceId:t.workspaceId})});}
export async function POST(req:NextRequest){const a=await requireApiAccess(req);if(!a||!a.authenticated)return unauthorizedResponse();const t=await getTenantContext(req);if(!t)return NextResponse.json({error:"Workspace access required."},{status:403});const p=await requireWorkspaceRole(req,"editor");if(!isRoleResult(p))return p;const b=await req.json().catch(()=>({}));const targetUrl=String(b.targetUrl||"").trim();if(!targetUrl)return NextResponse.json({error:"targetUrl is required."},{status:400});
 let strategy:any=null;try{strategy=buildStrategyPlan({});}catch{};
 try{const profiles=await listMonitoringProfiles({req,workspaceId:t.workspaceId});const profile=profiles.find((x:any)=>String(x.target_url||x.targetUrl||"").replace(/\/$/,"")===targetUrl.replace(/\/$/,""))||profiles[0];let alertCount=0;if(profile){const snaps=await listMonitoringSnapshots(t.workspaceId,profile.id);alertCount=Array.isArray(snaps[0]?.alerts)?snaps[0].alerts.length:0;}let analytics:any=null;try{analytics=await buildAdvancedAnalytics(req,t.workspaceId);}catch{} const jobs=await supabaseRest<any[]>(req,"jobs",{},`?workspace_id=eq.${t.workspaceId}&select=status&limit=1000`);const queueFailed=jobs.filter((j:any)=>j.status==="failed").length;const cycle=buildOperatingCycle({strategy,alertCount,queueFailed,unhealthyConnections:0,analytics});const run=await createOperatingRun({req,workspaceId:t.workspaceId},{targetUrl,cycle,createdBy:a.user.id});return NextResponse.json({cycle,run},{status:201});}catch(e:any){return NextResponse.json({error:e?.message||"Operating cycle failed."},{status:400});}}
