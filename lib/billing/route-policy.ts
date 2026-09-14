import type { FeatureKey } from "@/lib/product/features";

export type RouteGate = { feature: FeatureKey };

/**
 * Maps customer feature APIs to entitlement keys.
 * Intentional exceptions (auth, admin, worker, cron, workspace, settings,
 * connections, billing, dashboard, jobs, audit log) return null — those routes
 * still authenticate/authorize separately and must not be treated as public.
 */
export function featureGateForPath(pathname: string, method = "GET"): RouteGate | null {
  void method;
  const path = pathname.replace(/\/$/, "") || "/";

  if (
    path.startsWith("/api/auth") ||
    path.startsWith("/api/preferences") ||
    path.startsWith("/api/admin") ||
    path.startsWith("/api/worker") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/oauth/callback") ||
    path.startsWith("/api/workspaces") ||
    path.startsWith("/api/settings") ||
    path.startsWith("/api/billing") ||
    path.startsWith("/api/connections") ||
    path.startsWith("/api/dashboard") ||
    path.startsWith("/api/jobs") ||
    path === "/api/audit" ||
    path.startsWith("/api/queue") ||
    path.startsWith("/api/calendar") ||
    path.startsWith("/api/optimization-versions") ||
    path.startsWith("/api/rollback")
  ) {
    return null;
  }

  if (path.startsWith("/api/oauth/google-youtube")) return { feature: "youtube.connect" };
  if (path.startsWith("/api/oauth/facebook")) return { feature: "facebook.connect" };
  if (path.startsWith("/api/oauth/google-search-console")) return { feature: "website_seo.audit" };

  if (
    path.startsWith("/api/youtube-tools/retention") ||
    path.startsWith("/api/youtube-tools/performance-intelligence")
  ) {
    return { feature: "youtube.analytics" };
  }
  if (path.startsWith("/api/youtube-tools/bulk-optimize")) return { feature: "youtube.bulk" };
  if (path.startsWith("/api/youtube-tools/videos")) return { feature: "youtube.connect" };
  if (path.startsWith("/api/youtube-tools/approvals")) return { feature: "youtube.publish" };
  if (path.startsWith("/api/youtube-tools")) return { feature: "youtube.seo" };

  if (path.startsWith("/api/facebook-tools/posts") || path.startsWith("/api/facebook-tools/audience-insights")) {
    return { feature: "facebook.analytics" };
  }
  if (path.startsWith("/api/facebook-tools/comments") || path.startsWith("/api/facebook-tools/bulk-scheduler")) {
    return { feature: "facebook.publish" };
  }
  if (path.startsWith("/api/facebook-tools")) return { feature: "facebook.connect" };

  if (path.startsWith("/api/analyze") || path.startsWith("/api/site-audit")) return { feature: "website_seo.audit" };
  if (
    path.startsWith("/api/technical-seo") ||
    path.startsWith("/api/site-architecture") ||
    path.startsWith("/api/local-seo") ||
    path.startsWith("/api/seo-fixes")
  ) {
    return { feature: "website_seo.technical" };
  }
  if (path.startsWith("/api/keyword")) return { feature: "keywords.research" };
  if (path.startsWith("/api/generate") || path.startsWith("/api/content-studio"))
    return { feature: "content.generate" };
  if (
    path.startsWith("/api/optimize-content") ||
    path.startsWith("/api/content-quality") ||
    path.startsWith("/api/content-intelligence") ||
    path.startsWith("/api/content-strategy")
  ) {
    return { feature: "content.refresh" };
  }
  if (path.startsWith("/api/strategist")) return { feature: "ai.strategist" };
  if (path.startsWith("/api/os")) return { feature: "ai.action_center" };
  if (path.startsWith("/api/automation") || path.startsWith("/api/experiments")) return { feature: "automation.basic" };
  if (
    path.startsWith("/api/analytics") ||
    path.startsWith("/api/monitoring") ||
    path.startsWith("/api/report") ||
    path.startsWith("/api/trends")
  ) {
    return { feature: "website_seo.audit" };
  }
  if (path.startsWith("/api/competitors")) return { feature: "website_seo.audit" };

  return null;
}

export function publishFeatureForChannel(channel: string): FeatureKey | null {
  if (channel === "youtube") return "youtube.publish";
  if (channel === "facebook") return "facebook.publish";
  if (channel === "website") return "website_seo.audit";
  return null;
}
