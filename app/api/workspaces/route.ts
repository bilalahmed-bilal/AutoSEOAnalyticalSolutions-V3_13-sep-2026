import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/supabase";
import { supabaseRpc } from "@/lib/db/supabase-rpc";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) throw new Error("Supabase URL/anon key configured nahi hain.");
  return { url: url.replace(/\/$/, ""), anonKey, serviceRole };
}

async function supabaseRest(
  req: NextRequest,
  path: string,
  init: RequestInit = {},
  useServiceRole = false,
) {
  const { url, anonKey, serviceRole } = supabaseConfig();
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const key = useServiceRole ? serviceRole : anonKey;
  if (!key) throw new Error("Supabase service role key configured nahi hai.");

  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${useServiceRole ? key : token || anonKey}`);
  headers.set("Content-Type", "application/json");
  headers.set("Prefer", headers.get("Prefer") || "return=representation");

  return fetch(`${url}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET(req: NextRequest) {
  const rate = checkRateLimit(req, "workspaces-list");
  if (!rate.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const response = await supabaseRest(
      req,
      `workspace_members?user_id=eq.${encodeURIComponent(user.id)}&select=role,workspace:workspaces(id,name,slug,created_at)&order=created_at.asc`,
    );
    const text = await response.text();
    if (!response.ok) return NextResponse.json({ error: "Workspaces load nahi ho sakin.", details: text }, { status: response.status });
    const rows = JSON.parse(text) as Array<{ role: string; workspace: unknown }>;
    return NextResponse.json({
      workspaces: rows.map((row) => ({ ...(row.workspace as object), role: row.role })),
    });
  } catch (error) {
    console.error("workspace list error:", error);
    return NextResponse.json({ error: "Workspaces load nahi ho sakin." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "workspace-create");
  if (!rate.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = (await req.json()) as { name?: string; slug?: string };
    const name = body.name?.trim();
    if (!name || name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Workspace name 2 se 80 characters ka hona chahiye." }, { status: 400 });
    }

    const slug = slugify(body.slug || name);
    if (!slug) return NextResponse.json({ error: "Valid workspace slug zaroori hai." }, { status: 400 });

    const workspace = await supabaseRpc<Array<{ id: string; name: string; slug: string; created_at: string }>>(
      req,
      "create_workspace_atomic",
      { workspace_name: name, workspace_slug: slug },
    );
    const created = Array.isArray(workspace) ? workspace[0] : workspace;
    if (!created?.id) return NextResponse.json({ error: "Workspace ID return nahi hui." }, { status: 500 });

    return NextResponse.json({ workspace: { ...created, role: "owner" } }, { status: 201 });
  } catch (error: any) {
    console.error("workspace create error:", error);
    const message = String(error?.message || "Workspace create nahi ho saka.");
    const status = /duplicate|unique/i.test(message) ? 409 : /invalid workspace|invalid workspace slug/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: status === 409 ? "Workspace slug already use ho raha hai." : "Workspace create nahi ho saka." }, { status });
  }
}
