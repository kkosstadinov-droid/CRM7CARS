import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const [persistence, leadsRoute, activitiesRoute, auth, readme] = await Promise.all([
  read("src/lib/persistence.ts").catch(() => ""),
  read("src/app/api/leads/route.ts"),
  read("src/app/api/activities/route.ts"),
  read("src/lib/auth.ts"),
  read("README.md"),
]);

assert(persistence.includes("assertPersistentStore"), "Missing assertPersistentStore guard.");
assert(persistence.includes("BLOB_READ_WRITE_TOKEN"), "Persistence guard must mention BLOB_READ_WRITE_TOKEN.");
assert(persistence.includes("process.env.VERCEL"), "Persistence guard must protect Vercel deployments.");
assert(leadsRoute.includes("assertPersistentStore"), "Leads API must check persistent storage before using the store.");
assert(activitiesRoute.includes("assertPersistentStore"), "Activities API must check persistent storage before using the store.");
assert(auth.includes("assertPersistentStore"), "User/auth store must check persistent storage before writes/reads in Vercel.");
assert(readme.includes("Required Vercel environment variables"), "README must document required Vercel env vars.");
assert(readme.includes("BLOB_READ_WRITE_TOKEN"), "README must document BLOB_READ_WRITE_TOKEN.");
assert(readme.includes("npm run migrate:blob"), "README must document the Blob migration command.");

console.log("storage config checks passed");
