import { NextRequest } from "next/server";
import { supabaseRest } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

type Ctx = { req: NextRequest; workspaceId: string };

export interface SocialCompetitor {
  id: string;
  platform: "youtube" | "facebook";
  channelIdOrHandle: string;
  addedAt: string;
}

export async function listSocialCompetitors(ctx: Ctx, platform?: SocialCompetitor["platform"]) {
  const params: Record<string, string> = {
    workspace_id: `eq.${ctx.workspaceId}`,
    order: "created_at.asc",
  };
  if (platform) params.platform = `eq.${platform}`;
  const rows = await supabaseRest<UnknownRecord[]>(
    ctx.req,
    "social_competitors",
    {},
    `?${new URLSearchParams(params).toString()}`
  );
  return rows.map(mapRow);
}

export async function addSocialCompetitor(ctx: Ctx, platform: SocialCompetitor["platform"], channelIdOrHandle: string) {
  const [row] = await supabaseRest<UnknownRecord[]>(ctx.req, "social_competitors", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: ctx.workspaceId,
      platform,
      channel_id_or_handle: channelIdOrHandle,
    }),
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
  });
  if (!row) {
    const existing = await listSocialCompetitors(ctx, platform);
    const found = existing.find((x) => x.channelIdOrHandle === channelIdOrHandle);
    if (found) return found;
    throw new Error("Competitor pehle se maujood hai.");
  }
  return mapRow(row);
}

export async function removeSocialCompetitor(ctx: Ctx, id: string) {
  await supabaseRest(
    ctx.req,
    "social_competitors",
    { method: "DELETE" },
    `?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(ctx.workspaceId)}`
  );
}

function mapRow(r: UnknownRecord): SocialCompetitor {
  return {
    id: r.id,
    platform: r.platform,
    channelIdOrHandle: r.channel_id_or_handle,
    addedAt: r.created_at,
  };
}
