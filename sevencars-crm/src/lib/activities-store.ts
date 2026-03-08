import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ActivityDto } from "@/lib/activities";

const dataDir = process.env.DATA_DIR?.trim() || (process.env.VERCEL ? path.join("/tmp", "sevencars-crm-data") : path.join(process.cwd(), "data"));
const activitiesPath = path.join(dataDir, "activities.json");

function demoActivities(): ActivityDto[] {
  const now = new Date("2026-03-01T08:00:00.000Z").getTime();
  const rows: Array<Omit<ActivityDto, "id" | "createdAt">> = [
    {
      title: "Account review Konstantin Kostadinov",
      note: "Review Opel Manta sourcing scope and budget.",
      startsAt: new Date(now + 1 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000).toISOString(),
      status: "planned",
      department: "account",
    },
    {
      title: "Account call Elena Dimitrova",
      note: "Prepare Mercedes GLC buying shortlist.",
      startsAt: new Date(now + 2 * 24 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000).toISOString(),
      status: "planned",
      department: "account",
    },
    {
      title: "Account follow-up Rosen Tanev",
      note: "Discuss Audi Q7 contract handover details.",
      startsAt: new Date(now + 3 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(),
      status: "planned",
      department: "account",
    },
    {
      title: "Sales callback Georgi Marinov",
      note: "Pre-qualification update before contract stage.",
      startsAt: new Date(now + 4 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000).toISOString(),
      status: "planned",
      department: "sales",
    },
    {
      title: "Logistics prep Desislava Ilieva",
      note: "Prepare transport and registration checklist.",
      startsAt: new Date(now + 5 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000).toISOString(),
      status: "planned",
      department: "logistics",
    },
  ];

  return rows.map((row, i) => ({
    ...row,
    id: `demo_activity_${i + 1}`,
    createdAt: new Date(now - (i + 1) * 60 * 60 * 1000).toISOString(),
  }));
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    const existing = await readFile(activitiesPath, "utf8");
    const parsed = JSON.parse(existing) as ActivityDto[];
    const hasAccount = Array.isArray(parsed) && parsed.some((item) => item.department === "account" || item.title.toLowerCase().includes("account"));
    if (!Array.isArray(parsed) || parsed.length < 5 || !hasAccount) {
      await writeFile(activitiesPath, JSON.stringify(demoActivities(), null, 2), "utf8");
    }
  } catch {
    await writeFile(activitiesPath, JSON.stringify(demoActivities(), null, 2), "utf8");
  }
}

async function readActivities() {
  await ensureStore();
  const raw = await readFile(activitiesPath, "utf8");
  const parsed = JSON.parse(raw) as ActivityDto[];
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => ({
    ...item,
    department:
      item.department === "sales" || item.department === "account" || item.department === "logistics"
        ? item.department
        : item.title.toLowerCase().includes("account")
          ? "account"
          : item.title.toLowerCase().includes("logistics")
            ? "logistics"
            : "sales",
    note: item.note ?? "",
    title: item.title ?? "Activity",
    startsAt: item.startsAt ?? new Date().toISOString(),
    status: (item.status === "done" ? "done" : "planned") as ActivityDto["status"],
    createdAt: item.createdAt ?? new Date().toISOString(),
  }));
}

async function writeActivities(items: ActivityDto[]) {
  await ensureStore();
  await writeFile(activitiesPath, JSON.stringify(items, null, 2), "utf8");
}

export async function listActivities() {
  const items = await readActivities();
  return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function createActivity(input: Omit<ActivityDto, "id" | "createdAt">) {
  const items = await readActivities();
  const created: ActivityDto = {
    ...input,
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  items.push(created);
  items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  await writeActivities(items);
  return created;
}

export async function updateActivity(id: string, patch: Partial<Omit<ActivityDto, "id" | "createdAt">>) {
  const items = await readActivities();
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) return null;

  const updated: ActivityDto = {
    ...items[idx],
    ...patch,
  };
  items[idx] = updated;
  items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  await writeActivities(items);
  return updated;
}

export async function deleteActivity(id: string) {
  const items = await readActivities();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return false;
  await writeActivities(next);
  return true;
}
