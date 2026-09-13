import fs from "node:fs";
import path from "node:path";

export type AuditAction =
  | "seo_analysis"
  | "settings_change"
  | "draft_create"
  | "draft_publish"
  | "draft_reject"
  | "calendar_run"
  | "site_audit"
  | "content_intelligence"
  | "content_optimization";

interface AuditEntry {
  id: string;
  action: AuditAction;
  actor: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const file = path.join(process.cwd(), "data", "audit.log.jsonl");

export function writeAudit(entry: Omit<AuditEntry, "id" | "createdAt">) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const full: AuditEntry = { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  fs.appendFileSync(file, JSON.stringify(full) + "\n", { encoding: "utf8", mode: 0o600 });
}
