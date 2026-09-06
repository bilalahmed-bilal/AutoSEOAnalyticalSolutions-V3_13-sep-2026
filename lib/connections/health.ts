import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { decryptSecret } from "@/lib/security/secrets";
import { refreshConnectionIfNeeded, markConnectionHealth } from "@/lib/oauth/lifecycle";
import { testYouTubeConnection } from "@/lib/publishers/youtube";
import { testFacebookConnection } from "@/lib/publishers/facebook";
import { listSearchConsoleSites } from "@/lib/analytics/search-console";

export async function checkConnection(connection: any) {
  try {
    const credentials = await refreshConnectionIfNeeded(connection);
    let result: { ok: boolean; message: string } = { ok: true, message: "Connection active." };
    if (connection.provider === "youtube") result = await testYouTubeConnection({ accessToken: credentials.accessToken });
    else if (connection.provider === "facebook") result = await testFacebookConnection({ pageId: credentials.pageId, pageAccessToken: credentials.pageAccessToken });
    else if (connection.provider === "google-search-console") {
      const sites = await listSearchConsoleSites(credentials.accessToken);
      result = { ok: sites.length > 0, message: sites.length ? `${sites.length} Search Console properties available.` : "No Search Console properties available." };
    }
    await markConnectionHealth(connection.id, result.ok, result.message);
    return { ...result, connectionId: connection.id, provider: connection.provider };
  } catch (error: any) {
    const message = String(error?.message || "Connection health check failed.");
    await markConnectionHealth(connection.id, false, message).catch(() => undefined);
    return { ok: false, message, connectionId: connection.id, provider: connection.provider };
  }
}

export async function checkWorkspaceConnections(workspaceId: string) {
  const rows = await supabaseAdmin<any[]>("connections", {}, `?workspace_id=eq.${encodeURIComponent(workspaceId)}&status=neq.revoked`);
  const results = [];
  for (const connection of rows) results.push(await checkConnection(connection));
  return results;
}
