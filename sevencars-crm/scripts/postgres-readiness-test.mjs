import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const docPath = "docs/production-readiness.md";
const schemaPath = "prisma/schema.prisma";
const packagePath = "package.json";

const [doc, schema, packageRaw] = await Promise.all([
  readFile(docPath, "utf8"),
  readFile(schemaPath, "utf8"),
  readFile(packagePath, "utf8"),
]);
const pkg = JSON.parse(packageRaw);

for (const required of [
  "DATABASE_URL",
  "BLOB_READ_WRITE_TOKEN",
  "npm run backup:export",
  "npm run users:provision",
  "Neon or Supabase",
  "sqlite",
  "postgresql",
  "mustChangePassword=true",
  "CRM7CARS daily production backup",
]) {
  assert.ok(doc.includes(required), `production-readiness doc must mention ${required}`);
}

for (const username of [
  "sales",
  "sales1",
  "sales2",
  "sales3",
  "accountmanager",
  "accountmanager5",
  "teamleadam",
  "operationmanager1",
  "showroom1",
]) {
  assert.ok(doc.includes(username), `placeholder policy must mention ${username}`);
}

assert.match(schema, /datasource db \{\s*provider = "sqlite"/s, "Current Prisma datasource should remain sqlite until a real Postgres DATABASE_URL/provider is configured");
assert.equal(pkg.scripts["postgres:readiness"], "node scripts/postgres-readiness-test.mjs", "postgres readiness script should be registered");
assert.equal(pkg.scripts["backup:export"], "node scripts/export-crm-backup.mjs", "backup export script should remain registered");
assert.equal(pkg.scripts["users:provision"], "node scripts/provision-placeholder-users.mjs", "user provisioning script should remain registered");

console.log(JSON.stringify({
  ok: true,
  docPath,
  currentDatasource: "sqlite",
  postgresMigrationBlockedUntil: ["DATABASE_URL", "managed provider", "backup", "migration branch"],
}, null, 2));
