import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { supabaseRest } from "@/lib/db/supabase-rest";
import { decryptSecret } from "@/lib/security/secrets";
import { testWordPressConnection } from "@/lib/publishers/wordpress";
import { testShopifyConnection } from "@/lib/publishers/shopify";
import { testCustomSiteConnection } from "@/lib/publishers/custom-site";
import { testYouTubeConnection } from "@/lib/publishers/youtube";
import { testFacebookConnection } from "@/lib/publishers/facebook";

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (access.authenticated) {
    const permission = await requireWorkspaceRole(req, "editor");
    if (!isRoleResult(permission)) return permission;
  }
  if (!access.authenticated) return NextResponse.json({ results: [] });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });

  const rows = await supabaseRest<any[]>(req, "connections", {}, `?workspace_id=eq.${tenant.workspaceId}&status=neq.revoked`);
  const results = [];
  for (const row of rows) {
    const started = Date.now();
    try {
      const data = JSON.parse(decryptSecret(row.encrypted_credentials));
      let result: any;
      if (row.provider === "wordpress") result = await testWordPressConnection(data);
      else if (row.provider === "shopify") result = await testShopifyConnection(data);
      else if (row.provider === "custom") result = await testCustomSiteConnection(data);
      else if (row.provider === "youtube") result = await testYouTubeConnection(data);
      else if (row.provider === "facebook") result = await testFacebookConnection(data);
      else throw new Error("Unsupported provider");
      const ok = Boolean(result?.ok);
      await supabaseRest(req, "connections", { method:"PATCH", body:JSON.stringify({ status:ok ? "active" : "error", last_checked_at:new Date().toISOString(), last_error:ok ? null : String(result?.message || "Connection failed").slice(0,1000) }), headers:{Prefer:"return=minimal"} }, `?id=eq.${row.id}&workspace_id=eq.${tenant.workspaceId}`);
      results.push({ id:row.id, provider:row.provider, ok, message:result?.message || (ok ? "Connection OK" : "Connection failed"), latencyMs:Date.now()-started });
      if (!ok) continue;
    } catch (e:any) {
      const message = String(e?.message || "Connection failed");
      await supabaseRest(req, "connections", { method:"PATCH", body:JSON.stringify({ status:"error", last_checked_at:new Date().toISOString(), last_error:message.slice(0,1000) }), headers:{Prefer:"return=minimal"} }, `?id=eq.${row.id}&workspace_id=eq.${tenant.workspaceId}`);
      results.push({ id:row.id, provider:row.provider, ok:false, message, latencyMs:Date.now()-started });
    }
  }
  return NextResponse.json({ results });
}
