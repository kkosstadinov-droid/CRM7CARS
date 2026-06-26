import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const backupArg = process.argv.find((arg) => arg.startsWith("--file="));
const backupDir = "backups";

async function latestBackupPath() {
  if (backupArg) return backupArg.slice("--file=".length);
  const entries = await readdir(backupDir).catch(() => []);
  const backups = entries.filter((name) => /^crm-backup-.*\.json$/.test(name)).sort();
  assert.ok(backups.length > 0, "No backup files found under backups/. Run npm run backup:export first.");
  return path.join(backupDir, backups.at(-1));
}

function assertArrayWithCount(data, key) {
  assert.ok(Array.isArray(data[key]), `${key} must be an array`);
  assert.equal(data.counts?.[key], data[key].length, `${key} count must match payload length`);
}

function assertPublicUser(user) {
  assert.equal(typeof user.username, "string", "user.username must be string");
  assert.ok(user.username.length > 0, "user.username must not be empty");
  assert.equal(typeof user.role, "string", `${user.username}.role must be string`);
  assert.ok(["Admin", "Boss", "Sales", "AccountManager", "TeamLeadAM", "OperationManager", "Logistics", "Service", "Insurance", "Showroom"].includes(user.role), `${user.username}.role must be a known role`);
}

function assertRestoreUser(user) {
  assertPublicUser(user);
  assert.ok(user.password, `${user.username}.password must exist in usersRestore so restore can preserve auth`);
}

function assertLead(lead) {
  assert.equal(typeof lead.id, "string", "lead.id must be string");
  assert.ok(lead.id.length > 0, "lead.id must not be empty");
  assert.equal(typeof lead.createdAt, "string", `${lead.id}.createdAt must be string`);
  if (lead.updatedAt !== undefined) assert.equal(typeof lead.updatedAt, "string", `${lead.id}.updatedAt must be string when present`);
}

function assertActivity(activity) {
  assert.equal(typeof activity.id, "string", "activity.id must be string");
  assert.ok(activity.id.length > 0, "activity.id must not be empty");
}

function assertAuditEvent(event) {
  assert.equal(typeof event.id, "string", "audit event id must be string");
  assert.equal(typeof event.action, "string", `${event.id}.action must be string`);
  assert.equal(typeof (event.createdAt ?? event.at), "string", `${event.id}.createdAt/at must be string`);
}

const backupPath = await latestBackupPath();
const raw = await readFile(backupPath, "utf8");
const data = JSON.parse(raw);

assert.equal(typeof data.exportedAt, "string", "backup exportedAt must be string");
assert.equal(typeof data.baseUrl, "string", "backup baseUrl must be string");
assert.ok(data.counts && typeof data.counts === "object", "backup counts must exist");
for (const key of ["users", "leads", "activities", "auditLog"]) assertArrayWithCount(data, key);
assert.ok(Array.isArray(data.usersRestore), "usersRestore must be present for full auth restore");
assert.equal(data.counts?.usersRestore, data.usersRestore.length, "usersRestore count must match payload length");
assert.equal(data.usersRestore.length, data.users.length, "usersRestore should match public users count");

assert.ok(data.users.length >= 24, "backup should contain the provisioned placeholder users");
for (const user of data.users) assertPublicUser(user);
for (const user of data.usersRestore) assertRestoreUser(user);
for (const lead of data.leads) assertLead(lead);
for (const activity of data.activities) assertActivity(activity);
for (const event of data.auditLog) assertAuditEvent(event);

const usersByName = new Map(data.users.map((user) => [user.username, user]));
for (const [username, role] of [["admin", "Admin"], ["boss", "Boss"], ["sales", "Sales"], ["sales3", "Sales"], ["accountmanager5", "AccountManager"], ["operationmanager1", "OperationManager"]]) {
  assert.equal(usersByName.get(username)?.role, role, `${username} must be restorable with role ${role}`);
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), "crm-restore-test-"));
try {
  await writeFile(path.join(tempDir, "users.json"), JSON.stringify(data.usersRestore, null, 2));
  await writeFile(path.join(tempDir, "users-public.json"), JSON.stringify(data.users, null, 2));
  await writeFile(path.join(tempDir, "leads.json"), JSON.stringify(data.leads, null, 2));
  await writeFile(path.join(tempDir, "activities.json"), JSON.stringify(data.activities, null, 2));
  await writeFile(path.join(tempDir, "audit-log.json"), JSON.stringify(data.auditLog, null, 2));
  const restoredUsers = JSON.parse(await readFile(path.join(tempDir, "users.json"), "utf8"));
  const restoredLeads = JSON.parse(await readFile(path.join(tempDir, "leads.json"), "utf8"));
  const restoredActivities = JSON.parse(await readFile(path.join(tempDir, "activities.json"), "utf8"));
  const restoredAudit = JSON.parse(await readFile(path.join(tempDir, "audit-log.json"), "utf8"));
  assert.equal(restoredUsers.length, data.users.length, "restored users length must match");
  assert.equal(restoredLeads.length, data.leads.length, "restored leads length must match");
  assert.equal(restoredActivities.length, data.activities.length, "restored activities length must match");
  assert.equal(restoredAudit.length, data.auditLog.length, "restored audit length must match");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  backupPath,
  counts: data.counts,
  restoreMode: "dry-temp-json-roundtrip",
}, null, 2));
