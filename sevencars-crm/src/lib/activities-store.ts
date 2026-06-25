import { del, get, list, put } from "@vercel/blob";
import { hasBlobStore } from "@/lib/blob-json-store";
import { assertPersistentStore } from "@/lib/persistence";
import { prisma } from "@/lib/prisma";
import type { ActivityDto } from "@/lib/activities";

type ActivityRow = {
  id: string;
  createdAt: Date;
  department: string;
  startsAt: Date;
  status: string;
  payload: string;
};

type ListActivityOptions = {
  ownerUsername?: string;
};

const activitiesBlobPrefix = process.env.ACTIVITIES_BLOB_PREFIX?.trim() || "crm/activities/";

function normalizeActivity(input: Partial<ActivityDto> & Pick<ActivityDto, "id">): ActivityDto {
  return {
    id: input.id,
    title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : "Activity",
    note: typeof input.note === "string" ? input.note.trim() : "",
    startsAt: typeof input.startsAt === "string" && !Number.isNaN(Date.parse(input.startsAt)) ? new Date(input.startsAt).toISOString() : new Date().toISOString(),
    department:
      input.department === "account" || input.department === "logistics" || input.department === "sales"
        ? input.department
        : "sales",
    status: input.status === "done" ? "done" : "planned",
    ownerUsername: typeof input.ownerUsername === "string" ? input.ownerUsername.trim().toLowerCase() : "",
    createdAt: typeof input.createdAt === "string" && !Number.isNaN(Date.parse(input.createdAt)) ? new Date(input.createdAt).toISOString() : new Date().toISOString(),
  };
}

function toRow(activity: ActivityDto) {
  return {
    id: activity.id,
    createdAt: new Date(activity.createdAt),
    department: activity.department,
    startsAt: new Date(activity.startsAt),
    status: activity.status,
    payload: JSON.stringify(activity),
  };
}

function fromRow(row: ActivityRow): ActivityDto {
  let parsed: Partial<ActivityDto> = {};
  try {
    parsed = JSON.parse(row.payload) as Partial<ActivityDto>;
  } catch {
    parsed = {};
  }

  return normalizeActivity({
    ...parsed,
    id: row.id,
    department: row.department as ActivityDto["department"],
    startsAt: row.startsAt.toISOString(),
    status: row.status as ActivityDto["status"],
    createdAt: row.createdAt.toISOString(),
  });
}

async function streamToText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

function activityBlobPath(id: string) {
  return `${activitiesBlobPrefix}${id}.json`;
}

async function readBlobActivity(id: string) {
  const result = await get(activityBlobPath(id), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  try {
    return normalizeActivity(JSON.parse(await streamToText(result.stream)) as ActivityDto);
  } catch {
    return null;
  }
}

let bootstrapPromise: Promise<void> | null = null;

async function ensureCrmActivityTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CrmActivity" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "department" TEXT NOT NULL,
      "startsAt" DATETIME NOT NULL,
      "status" TEXT NOT NULL,
      "payload" TEXT NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CrmActivity_startsAt_createdAt_idx"
    ON "CrmActivity"("startsAt", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CrmActivity_department_startsAt_idx"
    ON "CrmActivity"("department", "startsAt")
  `);
}

async function ensureReady() {
  assertPersistentStore();
  if (!bootstrapPromise) {
    bootstrapPromise = ensureCrmActivityTable();
  }
  await bootstrapPromise;
}

export async function listActivities(options: ListActivityOptions = {}) {
  if (hasBlobStore()) {
    const page = await list({ prefix: activitiesBlobPrefix, limit: 1000 });
    const blobs = await Promise.all(
      page.blobs.map(async (blob) => {
        const result = await get(blob.pathname, { access: "private", useCache: false });
        if (!result || result.statusCode !== 200 || !result.stream) return null;
        try {
          return normalizeActivity(JSON.parse(await streamToText(result.stream)) as ActivityDto);
        } catch {
          return null;
        }
      }),
    );
    const items = blobs.filter((item): item is ActivityDto => Boolean(item));
    const filtered = options.ownerUsername ? items.filter((item) => item.ownerUsername === options.ownerUsername) : items;
    return filtered.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.createdAt.localeCompare(b.createdAt));
  }

  await ensureReady();
  const rows = await prisma.crmActivity.findMany({
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
  });
  const items = rows.map((row: ActivityRow) => fromRow(row));
  return options.ownerUsername ? items.filter((item) => item.ownerUsername === options.ownerUsername) : items;
}

export async function createActivity(input: Omit<ActivityDto, "id" | "createdAt">) {
  const created = normalizeActivity({
    ...input,
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  });

  if (hasBlobStore()) {
    await put(activityBlobPath(created.id), JSON.stringify(created, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
    });
    return created;
  }

  await ensureReady();
  await prisma.crmActivity.create({ data: toRow(created) });
  return created;
}

export async function updateActivity(id: string, patch: Partial<Omit<ActivityDto, "id" | "createdAt">>) {
  if (hasBlobStore()) {
    const current = await readBlobActivity(id);
    if (!current) return null;

    const updated = normalizeActivity({
      ...current,
      ...patch,
      id,
      createdAt: current.createdAt,
    });

    await put(activityBlobPath(id), JSON.stringify(updated, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
    });

    return updated;
  }

  await ensureReady();
  const row = await prisma.crmActivity.findUnique({ where: { id } });
  if (!row) return null;

  const current = fromRow(row);
  const updated = normalizeActivity({
    ...current,
    ...patch,
    id,
    createdAt: current.createdAt,
  });

  await prisma.crmActivity.update({
    where: { id },
    data: {
      department: updated.department,
      startsAt: new Date(updated.startsAt),
      status: updated.status,
      payload: JSON.stringify(updated),
    },
  });

  return updated;
}

export async function deleteActivity(id: string) {
  if (hasBlobStore()) {
    const existing = await readBlobActivity(id);
    if (!existing) return false;
    await del(activityBlobPath(id));
    return true;
  }

  await ensureReady();
  try {
    await prisma.crmActivity.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
