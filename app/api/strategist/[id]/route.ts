import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getTenantContext } from "@/lib/tenant";
import { getStrategyRun } from "@/lib/strategist/repository";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){const a=await requireApiAccess(req);if(!a?.authenticated)return unauthorizedResponse();const p=await requireWorkspaceRole(req,"viewer");if(!isRoleResult(p))return p;const t=await getTenantContext(req);if(!t)return NextResponse.json({error:"Valid workspace required."},{status:400});const {id}=await params;const run=await getStrategyRun(t.workspaceId,id);if(!run)return NextResponse.json({error:"Strategy run not found."},{status:404});return NextResponse.json({run});}
