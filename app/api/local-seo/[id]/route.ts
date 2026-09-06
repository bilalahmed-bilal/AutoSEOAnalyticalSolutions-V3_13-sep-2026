import { NextRequest } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { getLocalSeoProject } from "@/lib/local-seo/repository";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){const access=await requireApiAccess(req);if(!access)return unauthorizedResponse();const tenant=await getTenantContext(req);if(!tenant)return Response.json({error:"Workspace access required."},{status:403});try{const {id}=await params;const project=await getLocalSeoProject({req,workspaceId:tenant.workspaceId},id);if(!project)return Response.json({error:"Project not found."},{status:404});return Response.json({project});}catch(e:any){return Response.json({error:e.message||"Unable to load project."},{status:500});}}
