import { NextRequest } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { getTechnicalAudit } from "@/lib/technical-seo-repository";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){const access=await requireApiAccess(req);if(!access)return unauthorizedResponse();const tenant=await getTenantContext(req);if(!tenant)return Response.json({error:"Workspace access required."},{status:403});const {id}=await params;try{const audit=await getTechnicalAudit({req,workspaceId:tenant.workspaceId},id);if(!audit)return Response.json({error:"Audit not found."},{status:404});return Response.json({audit});}catch(e:any){return Response.json({error:e.message||"Unable to load audit."},{status:500});}}
