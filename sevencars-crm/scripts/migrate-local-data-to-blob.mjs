import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const root = process.cwd();
const usersBlobPath = process.env.USERS_BLOB_PATH?.trim() || "crm/users.json";
const leadsBlobPrefix = process.env.LEADS_BLOB_PREFIX?.trim() || "crm/leads/";
const activitiesBlobPrefix = process.env.ACTIVITIES_BLOB_PREFIX?.trim() || "crm/activities/";

function requireBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to migrate local CRM data to Vercel Blob.");
  }
}

async function readJsonIfExists(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function uploadJson(pathname, value) {
  await put(pathname, JSON.stringify(value, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
  });
}

function blobPath(prefix, id) {
  return `${prefix}${id}.json`;
}

async function main() {
  requireBlobToken();

  const databaseUrl = process.env.DATABASE_URL?.trim() || "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl.replace(/^file:/, "") });
  const prisma = new PrismaClient({ adapter });

  try {
    const usersPath = path.join(root, "data", "users.json");
    const users = await readJsonIfExists(usersPath, []);
    if (Array.isArray(users) && users.length > 0) {
      await uploadJson(usersBlobPath, users);
    }

    let leadRows = [];
    let activityRows = [];
    try {
      leadRows = await prisma.crmLead.findMany({ orderBy: { createdAt: "asc" } });
    } catch {
      leadRows = [];
    }
    try {
      activityRows = await prisma.crmActivity.findMany({ orderBy: { createdAt: "asc" } });
    } catch {
      activityRows = [];
    }

    let uploadedLeads = 0;
    for (const row of leadRows) {
      const payload = JSON.parse(row.payload);
      await uploadJson(blobPath(leadsBlobPrefix, row.id), payload);
      uploadedLeads += 1;
    }

    let uploadedActivities = 0;
    for (const row of activityRows) {
      const payload = JSON.parse(row.payload);
      await uploadJson(blobPath(activitiesBlobPrefix, row.id), payload);
      uploadedActivities += 1;
    }

    const legacyActivitiesPath = path.join(root, "data", "activities.json");
    const legacyActivities = await readJsonIfExists(legacyActivitiesPath, []);
    let uploadedLegacyActivities = 0;
    if (Array.isArray(legacyActivities) && activityRows.length === 0) {
      for (const item of legacyActivities) {
        if (!item?.id) continue;
        await uploadJson(blobPath(activitiesBlobPrefix, item.id), item);
        uploadedLegacyActivities += 1;
      }
    }

    console.log(JSON.stringify({
      usersUploaded: Array.isArray(users) && users.length > 0,
      leadsUploaded: uploadedLeads,
      activitiesUploaded: uploadedActivities,
      legacyActivitiesUploaded: uploadedLegacyActivities,
      usersBlobPath,
      leadsBlobPrefix,
      activitiesBlobPrefix,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
