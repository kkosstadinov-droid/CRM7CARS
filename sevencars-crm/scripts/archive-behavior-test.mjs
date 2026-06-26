import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const store = await readFile("src/lib/leads-store.ts", "utf8");
const apiRoute = await readFile("src/app/api/leads/[id]/route.ts", "utf8");
const usersRoute = await readFile("src/app/api/admin/users/[username]/route.ts", "utf8");
const auth = await readFile("src/lib/auth.ts", "utf8");
const types = await readFile("src/lib/leads.ts", "utf8");

assert.match(types, /archivedAt\?: string/, "LeadDto must include archivedAt");
assert.match(types, /archivedBy\?: string/, "LeadDto must include archivedBy");
assert.match(types, /archiveReason\?: string/, "LeadDto must include archiveReason");
assert.match(store, /includeArchived\?: boolean/, "listLeads should support includeArchived");
assert.match(store, /lead\.archivedAt/, "list filters should look at archivedAt");
assert.match(store, /archiveLead\(/, "store should expose archiveLead");
assert.match(store, /archivedAt: new Date\(\)\.toISOString\(\)/, "archive should timestamp archivedAt");
assert.doesNotMatch(store, /await del\(leadBlobPath\(id\)\)/, "deleteLead must not physically delete blob leads");
assert.doesNotMatch(store, /prisma\.crmLead\.delete/, "deleteLead must not physically delete sqlite leads");
assert.match(apiRoute, /archiveLead/, "DELETE route should call archiveLead");
assert.match(apiRoute, /action: "lead\.archive"/, "audit action should be lead.archive");
assert.match(auth, /deactivatedAt\?: string/, "AppUser must include deactivatedAt");
assert.match(auth, /deactivateUser\(/, "auth store should expose deactivateUser");
assert.match(auth, /user\.deactivatedAt/, "validateCredentials should reject deactivated users");
assert.match(usersRoute, /deactivateUser/, "admin user DELETE route should call deactivateUser");
assert.match(usersRoute, /action: "user\.archive"/, "user audit action should be user.archive");

console.log(JSON.stringify({ ok: true, behavior: "lead/user delete archives records and default lead list hides archived leads" }, null, 2));
