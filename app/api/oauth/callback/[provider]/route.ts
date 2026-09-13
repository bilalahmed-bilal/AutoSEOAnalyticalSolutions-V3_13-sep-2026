import { NextRequest, NextResponse } from "next/server";
import { consumeOAuthState } from "@/lib/oauth/state";
import { completeOAuth } from "@/lib/oauth/provider";
import type { OAuthProvider } from "@/lib/oauth/config";
import { errorMessage } from "@/lib/unknown";

const providers = new Set<OAuthProvider>(["google-youtube", "google-search-console", "facebook"]);
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const target = new URL("/", req.url);
  if (!providers.has(provider as OAuthProvider)) {
    target.searchParams.set("oauth", "error");
    target.searchParams.set("message", "Unsupported provider");
    return NextResponse.redirect(target);
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  if (error || !code || !state) {
    target.searchParams.set("oauth", "error");
    target.searchParams.set("message", error || "OAuth callback incomplete");
    return NextResponse.redirect(target);
  }
  try {
    const consumed = await consumeOAuthState(state, provider as OAuthProvider);
    const result = await completeOAuth(provider as OAuthProvider, code, consumed.workspace_id);
    target.searchParams.set("oauth", "success");
    target.searchParams.set("provider", result.provider);
    target.searchParams.set("workspace", consumed.workspace_id);
  } catch (e: unknown) {
    target.searchParams.set("oauth", "error");
    target.searchParams.set("message", errorMessage(e, "OAuth connection failed"));
  }
  return NextResponse.redirect(target);
}
