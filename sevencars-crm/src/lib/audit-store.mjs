import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { hasBlobStore, readJsonBlob, updateJsonBlob } from "./blob-json-store.mjs";

const dataDir = process.env.VERCEL ? path.join("/tmp", "sevencars-crm-data") : path.join(process.cwd(), "data");
const auditPath = path.join(dataDir, "audit-log.json");
const auditBlobPath = process.env.AUDIT_BLOB_PATH?.trim() || "crm/audit-log.json";
const maxAuditEvents = Number.parseInt(process.env.AUDIT_LOG_MAX_EVENTS || "5000", 10);

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeComparable(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

function makeAuditId() {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function fallbackAuditEvents() {
  return [];
}

async function ensureLocalAuditStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(auditPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("invalid audit store");
  } catch {
    await writeFile(auditPath, JSON.stringify([], null, 2), "utf8");
  }
}

async function readAuditEvents() {
  if (hasBlobStore()) {
    const current = await readJsonBlob(auditBlobPath, fallbackAuditEvents);
    return Array.isArray(current.value) ? current.value : [];
  }
  await ensureLocalAuditStore();
  const raw = await readFile(auditPath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeAuditEvents(events) {
  const bounded = events.slice(0, Number.isFinite(maxAuditEvents) && maxAuditEvents > 0 ? maxAuditEvents : 5000);
  if (hasBlobStore()) {
    await updateJsonBlob(auditBlobPath, fallbackAuditEvents, () => bounded);
    return bounded;
  }
  await ensureLocalAuditStore();
  const tmpPath = `${auditPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(bounded, null, 2), "utf8");
  await rename(tmpPath, auditPath);
  return bounded;
}

export function summarizeAuditPatch(before = {}, after = {}) {
  const changes = [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of keys) {
    const from = normalizeComparable(before?.[key]);
    const to = normalizeComparable(after?.[key]);
    if (to === undefined) continue;
    if (from === to) continue;
    changes.push({ field: key, from, to });
  }
  return changes;
}

export async function appendAuditEvent(input) {
  const event = {
    id: input.id || makeAuditId(),
    at: input.at || new Date().toISOString(),
    actorUsername: normalizeText(input.actor?.username || input.actorUsername || "system") || "system",
    actorRole: normalizeText(input.actor?.role || input.actorRole || "System") || "System",
    action: normalizeText(input.action),
    entityType: normalizeText(input.entityType),
    entityId: normalizeText(input.entityId),
    entityLabel: normalizeText(input.entityLabel),
    summary: normalizeText(input.summary),
    changes: Array.isArray(input.changes) ? input.changes : [],
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
  const events = await readAuditEvents();
  await writeAuditEvents([event, ...events]);
  return event;
}

export async function listAuditEvents({ limit = 100, entityType, entityId, actorUsername, action } = {}) {
  const events = await readAuditEvents();
  const normalizedLimit = Math.min(Math.max(Number.parseInt(String(limit), 10) || 100, 1), 500);
  return events
    .filter((event) => !entityType || event.entityType === entityType)
    .filter((event) => !entityId || event.entityId === entityId)
    .filter((event) => !actorUsername || event.actorUsername === actorUsername)
    .filter((event) => !action || event.action === action)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, normalizedLimit);
}
