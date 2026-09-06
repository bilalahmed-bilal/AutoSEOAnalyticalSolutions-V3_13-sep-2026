import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { createMonitoringProfile, listMonitoringProfiles, listMonitoringSnapshots, saveMonitoringSnapshot } from "@/lib/monitoring/repository";
import { runSeoMonitoring } from "@/lib/monitoring/engine";

export async function GET(req:NextRequest){
 const access=await requireApiAccess(req); if(!access)return unauthorizedResponse(); const tenant=access.authenticated?await getTenantContext(req):null; if(access.authenticated&&!tenant)return NextResponse.json({error:"Valid x-workspace-id required."},{status:400});
 if(!tenant)return NextResponse.json({profiles:[],snapshots:[]});
 const profiles=await listMonitoringProfiles({req,workspaceId:tenant.workspaceId}); const profileId=new URL(req.url).searchParams.get("profileId")||undefined; const snapshots=await listMonitoringSnapshots(tenant.workspaceId,profileId); return NextResponse.json({profiles,snapshots});
}
export async function POST(req:NextRequest){
 const access=await requireApiAccess(req); if(!access)return unauthorizedResponse(); const tenant=access.authenticated?await getTenantContext(req):null; if(access.authenticated&&!tenant)return NextResponse.json({error:"Valid x-workspace-id required."},{status:400}); if(!tenant)return NextResponse.json({error:"Monitoring requires authenticated workspace."},{status:400});
 const permission=await requireWorkspaceRole(req,"editor"); if(!isRoleResult(permission))return permission;
 const body=await req.json().catch(()=>({}));
 if(body.action==="run"){
   const profileId=String(body.profileId||""); if(!profileId)return NextResponse.json({error:"profileId required."},{status:400});
   const profiles=await listMonitoringProfiles({req,workspaceId:tenant.workspaceId}); const profile=profiles.find((p:any)=>p.id===profileId); if(!profile)return NextResponse.json({error:"Monitoring profile not found."},{status:404});
   const snaps=await listMonitoringSnapshots(tenant.workspaceId,profileId); const previous=snaps[0]||null; const result=await runSeoMonitoring(String(profile.target_url), previous, tenant.workspaceId); const snapshot=await saveMonitoringSnapshot(tenant.workspaceId,profileId,result); return NextResponse.json({result,snapshot});
 }
 const name=String(body.name||"").trim(),targetUrl=String(body.targetUrl||"").trim(); if(!name||!targetUrl)return NextResponse.json({error:"name and targetUrl are required."},{status:400});
 const profile=await createMonitoringProfile({req,workspaceId:tenant.workspaceId},{name,targetUrl,frequency:String(body.frequency||"daily"),createdBy:access.user.id}); return NextResponse.json({profile});
}
