export type Tab =
  | "dashboard"
  | "connections"
  | "subscription"
  | "generate"
  | "analyze"
  | "websiteOverview"
  | "publish"
  | "analytics"
  | "keywords"
  | "competitors"
  | "strategy"
  | "studio"
  | "quality"
  | "technical"
  | "architecture"
  | "local"
  | "experiments"
  | "monitoring"
  | "advancedAnalytics"
  | "strategist"
  | "operatingSystem"
  | "automation"
  | "system"
  | "ytKeywordResearch"
  | "ytSeoStudio"
  | "ytTagGenerator"
  | "ytChannelAudit"
  | "ytThumbnailAB"
  | "ytBulkOptimizer"
  | "ytCommunityPosts"
  | "ytPerformanceAnalytics"
  | "ytCompetitorTracking"
  | "ytRetentionInsights"
  | "ytPerformanceIntelligence"
  | "fbPageSeo"
  | "fbHashtagResearch"
  | "fbPostAB"
  | "fbBulkScheduler"
  | "fbEngagementAssistant"
  | "fbPostAnalytics"
  | "fbCompetitorTracking"
  | "fbAudienceInsights"
  | "websiteBuilder"
  | "instagram"
  | "whatsappMarketing"
  | "whatsappCampaigns"
  | "whatsappAutomation"
  | "whatsappAiReplies"
  | "whatsappBroadcasts"
  | "whatsappAnalytics";

export type NavIcon =
  | "home"
  | "globe"
  | "shield"
  | "search"
  | "pen"
  | "youtube"
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "chart"
  | "users"
  | "file"
  | "spark"
  | "cpu"
  | "send"
  | "calendar"
  | "workflow"
  | "check"
  | "plug"
  | "team"
  | "usage"
  | "credit"
  | "settings"
  | "grid";

export interface NavChild {
  id: Tab;
  label: string;
  group?: string;
}

export interface NavItem {
  id: Tab;
  label: string;
  icon: NavIcon;
  children?: NavChild[];
  navigateOnToggle?: boolean;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export const SIDEBAR_SECTIONS: NavSection[] = [
  {
    id: "start",
    label: "Start",
    items: [{ id: "dashboard", label: "Dashboard", icon: "home" }],
  },
  {
    id: "channels",
    label: "Channels",
    items: [
      {
        id: "websiteOverview",
        label: "Websites",
        icon: "globe",
        children: [
          { id: "websiteOverview", label: "Website Overview" },
          { id: "analyze", label: "SEO Health" },
          { id: "keywords", label: "Keyword Opportunities" },
          { id: "technical", label: "Technical Issues" },
          { id: "architecture", label: "Internal Linking" },
          { id: "local", label: "Local SEO" },
          { id: "quality", label: "Quality & Fact Check" },
          { id: "experiments", label: "SEO Experiments" },
          { id: "monitoring", label: "Monitoring & Alerts" },
          { id: "websiteBuilder", label: "Website Builder · Coming Soon" },
        ],
      },
      {
        id: "ytKeywordResearch",
        label: "YouTube",
        icon: "youtube",
        children: [
          { id: "ytKeywordResearch", label: "Keyword Research" },
          { id: "ytSeoStudio", label: "Video SEO Studio" },
          { id: "ytTagGenerator", label: "Tag Generator" },
          { id: "ytChannelAudit", label: "Channel Audit" },
          { id: "ytThumbnailAB", label: "Thumbnail & Title A/B" },
          { id: "ytBulkOptimizer", label: "Bulk Video Optimizer" },
          { id: "ytCommunityPosts", label: "Community Posts · Generation only" },
          { id: "ytPerformanceAnalytics", label: "Video Analytics" },
          { id: "ytCompetitorTracking", label: "Competitor Channels" },
          { id: "ytRetentionInsights", label: "Watch Time & Retention" },
          { id: "ytPerformanceIntelligence", label: "Performance Intelligence" },
        ],
      },
      {
        id: "fbPageSeo",
        label: "Facebook",
        icon: "facebook",
        children: [
          { id: "fbPageSeo", label: "Page & Post Discovery" },
          { id: "fbHashtagResearch", label: "Hashtag Research" },
          { id: "fbPostAB", label: "Post A/B Testing" },
          { id: "fbBulkScheduler", label: "Bulk Post Scheduler" },
          { id: "fbEngagementAssistant", label: "Engagement Assistant" },
          { id: "fbPostAnalytics", label: "Post Analytics" },
          { id: "fbCompetitorTracking", label: "Competitor Pages" },
          { id: "fbAudienceInsights", label: "Audience Insights" },
        ],
      },
      {
        id: "instagram",
        label: "Instagram",
        icon: "instagram",
        children: [{ id: "instagram", label: "Instagram · Coming Soon" }],
      },
      {
        id: "whatsappMarketing",
        label: "WhatsApp",
        icon: "whatsapp",
        children: [
          { id: "whatsappMarketing", label: "Marketing · Coming Soon" },
          { id: "whatsappCampaigns", label: "Campaigns · Coming Soon" },
          { id: "whatsappAutomation", label: "Automation · Coming Soon" },
          { id: "whatsappAiReplies", label: "AI Replies · Coming Soon" },
          { id: "whatsappBroadcasts", label: "Broadcasts · Coming Soon" },
          { id: "whatsappAnalytics", label: "Analytics · Coming Soon" },
        ],
      },
    ],
  },
  {
    id: "explore",
    label: "Explore",
    items: [
      {
        id: "analytics",
        label: "More Tools",
        icon: "grid",
        navigateOnToggle: false,
        children: [
          { id: "keywords", label: "Keywords", group: "SEO & Growth" },
          { id: "competitors", label: "Competitors", group: "SEO & Growth" },
          { id: "technical", label: "Advanced SEO", group: "SEO & Growth" },
          { id: "monitoring", label: "Monitoring", group: "SEO & Growth" },
          { id: "strategist", label: "AI Strategist", group: "AI" },
          { id: "operatingSystem", label: "AI Operating System", group: "AI" },
          { id: "generate", label: "Content Generator", group: "AI" },
          { id: "studio", label: "AI Content Studio", group: "AI" },
          { id: "automation", label: "Automation", group: "Operations" },
          { id: "publish", label: "Approvals", group: "Operations" },
          { id: "publish", label: "Publishing", group: "Operations" },
          { id: "advancedAnalytics", label: "Reports", group: "Operations" },
          { id: "strategy", label: "Content Strategy", group: "Operations" },
          { id: "analytics", label: "Analytics", group: "Operations" },
          { id: "connections", label: "Connections", group: "Management" },
          { id: "system", label: "Team", group: "Management" },
          { id: "subscription", label: "Usage", group: "Management" },
          { id: "subscription", label: "Subscription", group: "Management" },
        ],
      },
      { id: "system", label: "Settings", icon: "settings" },
    ],
  },
];

export function navItemIsActive(item: NavItem, tab: Tab) {
  if (item.children?.length) return item.children.some((child) => child.id === tab);
  return item.id === tab;
}

export function pageTitleForTab(tab: Tab) {
  for (const section of SIDEBAR_SECTIONS) {
    for (const item of section.items) {
      const child = item.children?.find((entry) => entry.id === tab);
      if (child) return child.label;
      if (!item.children && item.id === tab) return item.label;
    }
  }
  return "AIBISORA";
}
