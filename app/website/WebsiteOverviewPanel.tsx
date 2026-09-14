"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { NavIcon, Tab } from "@/lib/ui/nav";

const OVERVIEW_TOOLS: {
  id: Tab;
  icon: NavIcon;
  title: string;
  description: string;
  status?: "coming-soon";
}[] = [
  {
    id: "analyze",
    icon: "shield",
    title: "SEO Health",
    description: "Crawl a live page, score on-page health, and list issues to fix.",
  },
  {
    id: "keywords",
    icon: "search",
    title: "Keyword Opportunities",
    description: "Research target keywords from the site and related topics you already manage.",
  },
  {
    id: "technical",
    icon: "cpu",
    title: "Technical Issues",
    description: "Audit technical SEO problems and review a prioritized remediation plan.",
  },
  {
    id: "generate",
    icon: "pen",
    title: "Content",
    description: "Generate website copy, then send drafts through human approval before publish.",
  },
  {
    id: "competitors",
    icon: "users",
    title: "Competitors",
    description: "Compare your site against competitors you add. No invented competitor scores.",
  },
  {
    id: "analytics",
    icon: "chart",
    title: "Analytics",
    description: "View SEO history and connected-channel performance from real workspace data.",
  },
  {
    id: "strategist",
    icon: "spark",
    title: "AI Recommendations",
    description: "Turn existing SEO signals into a next-best-action plan. Nothing publishes itself.",
  },
  {
    id: "websiteBuilder",
    icon: "globe",
    title: "Website Builder",
    description: "Create a website inside AIBISORA. This capability is not implemented in Free Beta.",
    status: "coming-soon",
  },
];

export default function WebsiteOverviewPanel({ onNavigate }: { onNavigate?: (tab: Tab) => void }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website channel"
        title="Website Overview"
        description="Website is the primary entry channel. Open a tool below to work with a site you already manage. AIBISORA does not invent scores or sample findings."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {OVERVIEW_TOOLS.map((tool) => (
          <Card key={tool.id} className="flex h-full flex-col justify-between gap-4">
            <div>
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-line bg-elevated text-primary">
                  <Icon name={tool.icon} className="h-5 w-5" />
                </span>
                {tool.status === "coming-soon" ? <Badge tone="warning">Coming Soon</Badge> : null}
              </div>
              <h2 className="mt-4 text-base font-semibold tracking-[-0.02em] text-ink">{tool.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--nx-text-secondary)]">{tool.description}</p>
            </div>
            {onNavigate ? (
              <Button
                variant={tool.status === "coming-soon" ? "secondary" : "primary"}
                onClick={() => onNavigate(tool.id)}
              >
                {tool.status === "coming-soon" ? "View status" : `Open ${tool.title}`}
              </Button>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
