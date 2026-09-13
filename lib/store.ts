import fs from "fs";
import path from "path";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

// Phase 3/4 note: this is a simple local JSON file store — enough to make the
// approval-queue workflow real and testable for a single user. Section 5.3
// of the Master Requirements Document specifies Postgres for the real
// multi-tenant database; that replaces this file when the platform becomes
// multi-tenant, without changing these data shapes.

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

export type Channel = "website" | "youtube" | "facebook";
export type DraftStatus = "pending" | "approved" | "published" | "rejected" | "failed";

// Permission model per Section 3: Off / Suggest (manual approval) / Auto
// (execute immediately, still logged). Kept simple here as one mode per
// platform rather than per fine-grained action category — a reasonable v1
// simplification of the full risk-tier matrix in the Master Requirements Doc.
export type PermissionMode = "off" | "suggest" | "auto";

export type DraftKind = "new_content" | "seo_fix";

export interface ContentDraft {
  id: string;
  channel: Channel;
  kind: DraftKind;
  title: string;
  body: string;
  metaDescription?: string;
  videoId?: string; // youtube only — the existing video being re-optimized
  targetUrl?: string; // website + kind="seo_fix" only — the existing page being fixed
  suggestedHeadings?: string[]; // website + kind="seo_fix" only
  schemaJsonLd?: string; // website + kind="seo_fix" only
  status: DraftStatus;
  createdAt: string;
  publishedUrl?: string;
  errorMessage?: string;
}

export interface WordPressSettings {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface CustomSiteSettings {
  webhookUrl: string;
  apiKey: string;
}

export interface ShopifySettings {
  shopDomain: string;
  accessToken: string;
}

export interface YouTubeSettings {
  accessToken: string;
  scope?: string;
}

export interface FacebookSettings {
  pageId: string;
  pageAccessToken: string;
}

export type WebsitePlatformType = "wordpress" | "shopify" | "custom";

export interface PublishSettings {
  website?: {
    platformType: WebsitePlatformType;
    wordpress?: WordPressSettings;
    shopify?: ShopifySettings;
    custom?: CustomSiteSettings;
    permission: PermissionMode;
  };
  youtube?: {
    settings: YouTubeSettings;
    permission: PermissionMode;
  };
  facebook?: {
    settings: FacebookSettings;
    permission: PermissionMode;
  };
}

interface DbShape {
  drafts: ContentDraft[];
  publishSettings: PublishSettings;
  seoScoreHistory: SeoScoreEntry[];
  calendarItems: CalendarItem[];
  competitorChannels: CompetitorChannel[];
}

export interface CompetitorChannel {
  id: string;
  platform: "youtube" | "facebook";
  channelIdOrHandle: string;
  addedAt: string;
}

export interface SeoScoreEntry {
  url: string;
  score: number;
  date: string;
}

export type CalendarItemStatus = "planned" | "generated" | "failed";

export interface CalendarItem {
  id: string;
  channel: Channel;
  topic: string;
  scheduledDate: string; // ISO date, e.g. "2026-09-10"
  status: CalendarItemStatus;
  createdAt: string;
  resultDraftId?: string;
  errorMessage?: string;
}

function ensureDb(): DbShape {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial: DbShape = {
      drafts: [],
      publishSettings: {},
      seoScoreHistory: [],
      calendarItems: [],
      competitorChannels: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  const parsed = JSON.parse(raw) as DbShape;
  // Backfill for dbs created before these fields existed, or by an earlier
  // version of this file's schema where publishSettings could be null
  // (this caused "Cannot read properties of null" once youtube/facebook
  // fields were added — this line is what fixes that for existing users).
  if (!parsed.publishSettings) parsed.publishSettings = {};
  if (!parsed.seoScoreHistory) parsed.seoScoreHistory = [];
  if (!parsed.calendarItems) parsed.calendarItems = [];
  if (!parsed.competitorChannels) parsed.competitorChannels = [];
  return parsed;
}

function saveDb(db: DbShape) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function listDrafts(): ContentDraft[] {
  return ensureDb().drafts.slice().reverse(); // newest first
}

export function addDraft(draft: Omit<ContentDraft, "id" | "status" | "createdAt">): ContentDraft {
  const db = ensureDb();
  const newDraft: ContentDraft = {
    ...draft,
    id: crypto.randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  db.drafts.push(newDraft);
  saveDb(db);
  return newDraft;
}

export function updateDraft(id: string, patch: Partial<ContentDraft>): ContentDraft | null {
  const db = ensureDb();
  const idx = db.drafts.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  db.drafts[idx] = { ...db.drafts[idx], ...patch };
  saveDb(db);
  return db.drafts[idx];
}

function decryptPublishSettings(settings: PublishSettings): PublishSettings {
  const copy = structuredClone(settings);
  if (copy.website?.wordpress) {
    copy.website.wordpress.applicationPassword = decryptSecret(copy.website.wordpress.applicationPassword);
  }
  if (copy.website?.shopify) {
    copy.website.shopify.accessToken = decryptSecret(copy.website.shopify.accessToken);
  }
  if (copy.website?.custom) {
    copy.website.custom.apiKey = decryptSecret(copy.website.custom.apiKey);
  }
  if (copy.youtube) {
    copy.youtube.settings.accessToken = decryptSecret(copy.youtube.settings.accessToken);
  }
  if (copy.facebook) {
    copy.facebook.settings.pageAccessToken = decryptSecret(copy.facebook.settings.pageAccessToken);
  }
  return copy;
}

function encryptPublishSettings(settings: PublishSettings): PublishSettings {
  const copy = structuredClone(settings);
  if (copy.website?.wordpress) {
    copy.website.wordpress.applicationPassword = encryptSecret(copy.website.wordpress.applicationPassword);
  }
  if (copy.website?.shopify) {
    copy.website.shopify.accessToken = encryptSecret(copy.website.shopify.accessToken);
  }
  if (copy.website?.custom) {
    copy.website.custom.apiKey = encryptSecret(copy.website.custom.apiKey);
  }
  if (copy.youtube) {
    copy.youtube.settings.accessToken = encryptSecret(copy.youtube.settings.accessToken);
  }
  if (copy.facebook) {
    copy.facebook.settings.pageAccessToken = encryptSecret(copy.facebook.settings.pageAccessToken);
  }
  return copy;
}

export function getPublishSettings(): PublishSettings {
  return decryptPublishSettings(ensureDb().publishSettings);
}

export function savePublishSettings(partial: Partial<PublishSettings>) {
  const db = ensureDb();
  const current = decryptPublishSettings(db.publishSettings);
  db.publishSettings = encryptPublishSettings({ ...current, ...partial });
  saveDb(db);
}

export function recordSeoScore(url: string, score: number) {
  const db = ensureDb();
  db.seoScoreHistory.push({ url, score, date: new Date().toISOString() });
  saveDb(db);
}

export function getSeoScoreHistory(url?: string): SeoScoreEntry[] {
  const history = ensureDb().seoScoreHistory;
  return url ? history.filter((h) => h.url === url) : history;
}

export function listCalendarItems(): CalendarItem[] {
  return ensureDb()
    .calendarItems.slice()
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}

export function addCalendarItem(item: Omit<CalendarItem, "id" | "status" | "createdAt">): CalendarItem {
  const db = ensureDb();
  const newItem: CalendarItem = {
    ...item,
    id: crypto.randomUUID(),
    status: "planned",
    createdAt: new Date().toISOString(),
  };
  db.calendarItems.push(newItem);
  saveDb(db);
  return newItem;
}

export function updateCalendarItem(id: string, patch: Partial<CalendarItem>): CalendarItem | null {
  const db = ensureDb();
  const idx = db.calendarItems.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  db.calendarItems[idx] = { ...db.calendarItems[idx], ...patch };
  saveDb(db);
  return db.calendarItems[idx];
}

export function getDueCalendarItems(): CalendarItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return ensureDb().calendarItems.filter((c) => c.status === "planned" && c.scheduledDate <= today);
}

export function listCompetitorChannels(platform?: "youtube" | "facebook"): CompetitorChannel[] {
  const list = ensureDb().competitorChannels;
  return platform ? list.filter((c) => c.platform === platform) : list;
}

export function addCompetitorChannel(platform: "youtube" | "facebook", channelIdOrHandle: string): CompetitorChannel {
  const db = ensureDb();
  const entry: CompetitorChannel = {
    id: crypto.randomUUID(),
    platform,
    channelIdOrHandle,
    addedAt: new Date().toISOString(),
  };
  db.competitorChannels.push(entry);
  saveDb(db);
  return entry;
}

export function removeCompetitorChannel(id: string) {
  const db = ensureDb();
  db.competitorChannels = db.competitorChannels.filter((c) => c.id !== id);
  saveDb(db);
}
