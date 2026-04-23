import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { hasBlobStore, readJsonBlob, updateJsonBlob } from "@/lib/blob-json-store";

export type AppRole = "Admin" | "Boss" | "Sales" | "AccountManager" | "TeamLeadAM" | "OperationManager" | "Logistics" | "Service" | "Insurance" | "Showroom";
export type DashboardPreset = "pipeline" | "stats";

export type AppUser = {
  username: string;
  password: string;
  role: AppRole;
  dashboardPreset: DashboardPreset;
  createdAt: string;
  updatedAt: string;
  mustChangePassword: boolean;
};

export type SessionInfo = {
  username: string;
  role: AppRole;
};

const dataDir = process.env.VERCEL ? path.join("/tmp", "sevencars-crm-data") : path.join(process.cwd(), "data");
const usersPath = path.join(dataDir, "users.json");
const usersBlobPath = process.env.USERS_BLOB_PATH?.trim() || "crm/users.json";

export const defaultRoleCredentials: Record<string, AppRole> = {
  admin: "Admin",
  boss: "Boss",
  sales: "Sales",
  accountmanager: "AccountManager",
  teamleadam: "TeamLeadAM",
  operationmanager: "OperationManager",
  logistics: "Logistics",
  service: "Service",
  insurance: "Insurance",
  showroom: "Showroom",
};

export function isAppRole(value: string): value is AppRole {
  return Object.values(defaultRoleCredentials).includes(value as AppRole);
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function defaultPresetByRole(role: AppRole): DashboardPreset {
  if (role === "Boss" || role === "OperationManager") return "stats";
  return "pipeline";
}

function defaultUsers(): AppUser[] {
  const now = new Date().toISOString();
  return Object.entries(defaultRoleCredentials).map(([username, role]) => ({
    username,
    password: username,
    role,
    dashboardPreset: defaultPresetByRole(role),
    createdAt: now,
    updatedAt: now,
    mustChangePassword: false,
  }));
}

async function ensureUsersStore() {
  if (hasBlobStore()) {
    const current = await readJsonBlob<AppUser[]>(usersBlobPath, defaultUsers);
    const parsed = Array.isArray(current.value) ? current.value : [];
    if (!current.exists || parsed.length === 0) {
      await updateJsonBlob<AppUser[]>(usersBlobPath, defaultUsers, () => defaultUsers());
    }
    return;
  }

  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(usersPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      await writeFile(usersPath, JSON.stringify(defaultUsers(), null, 2), "utf8");
    }
  } catch {
    await writeFile(usersPath, JSON.stringify(defaultUsers(), null, 2), "utf8");
  }
}

async function readUsers() {
  await ensureUsersStore();
  const parsed = hasBlobStore()
    ? (await readJsonBlob<AppUser[]>(usersBlobPath, defaultUsers)).value
    : (JSON.parse(await readFile(usersPath, "utf8")) as AppUser[]);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((user) => typeof user === "object" && user !== null)
    .map((user) => {
      const u = user as Partial<AppUser>;
      const role = u.role && isAppRole(u.role) ? u.role : "Sales";
      const username = normalizeUsername(String(u.username ?? ""));
      return {
        username,
        password: String(u.password ?? username),
        role,
        dashboardPreset: u.dashboardPreset === "stats" || u.dashboardPreset === "pipeline" ? u.dashboardPreset : defaultPresetByRole(role),
        createdAt: typeof u.createdAt === "string" ? u.createdAt : new Date().toISOString(),
        updatedAt: typeof u.updatedAt === "string" ? u.updatedAt : new Date().toISOString(),
        mustChangePassword: Boolean(u.mustChangePassword),
      } satisfies AppUser;
    })
    .filter((u) => !!u.username);
}

async function writeUsers(users: AppUser[]) {
  if (hasBlobStore()) {
    await updateJsonBlob<AppUser[]>(usersBlobPath, defaultUsers, () => users);
    return;
  }

  await ensureUsersStore();
  const tmpPath = `${usersPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(users, null, 2), "utf8");
  await rename(tmpPath, usersPath);
}

export async function listUsers() {
  const users = await readUsers();
  return users.sort((a, b) => a.username.localeCompare(b.username));
}

export async function getUser(username: string) {
  const users = await readUsers();
  const normalized = normalizeUsername(username);
  return users.find((user) => user.username === normalized) ?? null;
}

export async function createUser(input: { username: string; password: string; role: AppRole; dashboardPreset?: DashboardPreset }) {
  const users = await readUsers();
  const username = normalizeUsername(input.username);
  if (!username) throw new Error("Username is required.");
  if (users.some((user) => user.username === username)) throw new Error("Username already exists.");
  const now = new Date().toISOString();
  const created: AppUser = {
    username,
    password: input.password.trim(),
    role: input.role,
    dashboardPreset: input.dashboardPreset ?? defaultPresetByRole(input.role),
    createdAt: now,
    updatedAt: now,
    mustChangePassword: true,
  };
  users.push(created);
  await writeUsers(users);
  return created;
}

export async function updateUser(
  username: string,
  patch: Partial<Pick<AppUser, "role" | "dashboardPreset" | "mustChangePassword">>,
) {
  const users = await readUsers();
  const normalized = normalizeUsername(username);
  const idx = users.findIndex((user) => user.username === normalized);
  if (idx === -1) return null;
  const current = users[idx];
  const role = patch.role ?? current.role;
  users[idx] = {
    ...current,
    role,
    dashboardPreset: patch.dashboardPreset ?? current.dashboardPreset ?? defaultPresetByRole(role),
    mustChangePassword: patch.mustChangePassword ?? current.mustChangePassword,
    updatedAt: new Date().toISOString(),
  };
  await writeUsers(users);
  return users[idx];
}

export async function resetUserPassword(username: string, nextPassword: string) {
  const users = await readUsers();
  const normalized = normalizeUsername(username);
  const idx = users.findIndex((user) => user.username === normalized);
  if (idx === -1) return null;
  users[idx] = {
    ...users[idx],
    password: nextPassword.trim(),
    mustChangePassword: true,
    updatedAt: new Date().toISOString(),
  };
  await writeUsers(users);
  return users[idx];
}

export async function deleteUser(username: string) {
  const users = await readUsers();
  const normalized = normalizeUsername(username);
  const next = users.filter((user) => user.username !== normalized);
  if (next.length === users.length) return false;
  await writeUsers(next);
  return true;
}

export async function changeOwnPassword(username: string, currentPassword: string, nextPassword: string) {
  const users = await readUsers();
  const normalized = normalizeUsername(username);
  const idx = users.findIndex((user) => user.username === normalized);
  if (idx === -1) return { ok: false as const, reason: "not_found" as const };
  if (users[idx].password !== currentPassword.trim()) return { ok: false as const, reason: "invalid_current_password" as const };
  users[idx] = {
    ...users[idx],
    password: nextPassword.trim(),
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  };
  await writeUsers(users);
  return { ok: true as const };
}

export async function validateCredentials(username: string, password: string): Promise<(SessionInfo & { mustChangePassword: boolean; dashboardPreset: DashboardPreset }) | null> {
  const user = await getUser(username);
  if (!user) return null;
  if (user.password !== password.trim()) return null;
  return { username: user.username, role: user.role, mustChangePassword: user.mustChangePassword, dashboardPreset: user.dashboardPreset };
}

export function createSessionCookieValue(session: SessionInfo) {
  return `${normalizeUsername(session.username)}::${session.role}`;
}

export function parseSessionCookieValue(value: string | undefined): SessionInfo | null {
  if (!value) return null;
  if (value.includes("::")) {
    const [usernameRaw, roleRaw] = value.split("::");
    const username = normalizeUsername(usernameRaw ?? "");
    const role = roleRaw?.trim();
    if (!username || !role || !isAppRole(role)) return null;
    return { username, role };
  }

  const legacyRole = value.trim();
  if (!isAppRole(legacyRole)) return null;
  const username = normalizeUsername(legacyRole);
  return { username, role: legacyRole };
}
