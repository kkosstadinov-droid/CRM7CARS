import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { hasBlobStore, readJsonBlob } from "../src/lib/blob-json-store.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const baseUrl = process.env.BASE_URL || "https://sevencars-crm.vercel.app";
const username = process.env.CRM_BACKUP_USERNAME || process.env.CRM_ADMIN_USERNAME || "admin";
const password = process.env.CRM_BACKUP_PASSWORD || process.env.CRM_ADMIN_PASSWORD || "admin";
const outputDir = process.env.CRM_BACKUP_DIR || path.join(process.cwd(), "backups");
const usersBlobPath = process.env.USERS_BLOB_PATH?.trim() || "crm/users.json";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseSetCookie(setCookie) {
  if (!setCookie) return "";
  return setCookie.split(";")[0];
}

async function request(pathname, init = {}, cookie = "") {
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${baseUrl}${pathname}`, { ...init, headers });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { response, json, text };
}

async function login() {
  const result = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert(result.response.ok, `Backup login failed: ${result.response.status}`);
  const cookie = parseSetCookie(result.response.headers.get("set-cookie"));
  assert(cookie.includes("sevencars_session="), "Backup login did not return a session cookie");
  return cookie;
}

async function getJson(pathname, cookie) {
  const result = await request(pathname, {}, cookie);
  assert(result.response.ok, `GET ${pathname} failed: ${result.response.status}`);
  return result.json;
}

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

if (dryRun) {
  console.log(JSON.stringify({
    mode: "dry-run",
    baseUrl,
    username,
    outputDir,
    endpoints: ["/api/admin/users", "/api/leads?limit=10000", "/api/activities", "/api/audit-log?limit=10000"],
    note: "No network request or file write was performed.",
  }, null, 2));
  process.exit(0);
}

const cookie = await login();
const [users, leads, activities, auditLog] = await Promise.all([
  getJson("/api/admin/users", cookie),
  getJson("/api/leads?limit=10000", cookie),
  getJson("/api/activities", cookie),
  getJson("/api/audit-log?limit=10000", cookie),
]);

let usersRestore = null;
let usersRestoreSource = "unavailable";
if (hasBlobStore()) {
  const rawUsers = await readJsonBlob(usersBlobPath, []);
  if (Array.isArray(rawUsers.value) && rawUsers.value.length > 0) {
    usersRestore = rawUsers.value;
    usersRestoreSource = `blob:${usersBlobPath}`;
  }
}
if (!Array.isArray(usersRestore) || usersRestore.length === 0) {
  usersRestore = Array.isArray(users)
    ? users.map((user) => ({
        ...user,
        password: user.username,
        mustChangePassword: true,
        restoredPasswordPolicy: "temporary-password-equals-username",
      }))
    : [];
  usersRestoreSource = "api-public-users-with-temporary-password-reset-policy";
}

const backup = {
  exportedAt: new Date().toISOString(),
  baseUrl,
  counts: {
    users: count(users),
    usersRestore: count(usersRestore),
    leads: count(leads),
    activities: count(activities),
    auditLog: count(auditLog),
  },
  users,
  usersRestore,
  usersRestoreSource,
  leads,
  activities,
  auditLog,
};

await mkdir(outputDir, { recursive: true });
const filePath = path.join(outputDir, `crm-backup-${backup.exportedAt.replaceAll(":", "-")}.json`);
await writeFile(filePath, JSON.stringify(backup, null, 2));
console.log(JSON.stringify({ ok: true, filePath, counts: backup.counts }, null, 2));
