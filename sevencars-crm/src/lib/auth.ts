import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { hasBlobStore, readJsonBlob, updateJsonBlob } from "@/lib/blob-json-store";
import { assertPersistentStore } from "@/lib/persistence";

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
  deactivatedAt?: string;
  deactivatedBy?: string;
};

export type SessionInfo = {
  username: string;
  role: AppRole;
};

const dataDir = process.env.VERCEL ? path.join("/tmp", "sevencars-crm-data") : path.join(process.cwd(), "data");
const usersPath = path.join(dataDir, "users.json");
const usersBlobPath = process.env.USERS_BLOB_PATH?.trim() || "crm/users.json";

const scrypt = promisify(scryptCallback);
const passwordHashPrefix = "scrypt";

function getSessionSecret() {
  const secret = process.env.SEVENCARS_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret?.trim()) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing SEVENCARS_SESSION_SECRET/AUTH_SECRET for signed CRM sessions.");
  }
  return "dev-only-sevencars-session-secret-change-before-production";
}

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function isPasswordHash(value: string) {
  return value.startsWith(`${passwordHashPrefix}$`);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password.trim(), salt, 64)) as Buffer;
  return `${passwordHashPrefix}$${salt}$${derived.toString("base64url")}`;
}

async function verifyPassword(storedPassword: string, inputPassword: string) {
  const input = inputPassword.trim();
  if (!isPasswordHash(storedPassword)) return storedPassword === input;

  const [, salt, hash] = storedPassword.split("$");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = (await scrypt(input, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

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
  assertPersistentStore();
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
      const normalized: AppUser = {
        username,
        password: String(u.password ?? username),
        role,
        dashboardPreset: u.dashboardPreset === "stats" || u.dashboardPreset === "pipeline" ? u.dashboardPreset : defaultPresetByRole(role),
        createdAt: typeof u.createdAt === "string" ? u.createdAt : new Date().toISOString(),
        updatedAt: typeof u.updatedAt === "string" ? u.updatedAt : new Date().toISOString(),
        mustChangePassword: Boolean(u.mustChangePassword),
      };
      if (typeof u.deactivatedAt === "string") normalized.deactivatedAt = u.deactivatedAt;
      if (typeof u.deactivatedBy === "string") normalized.deactivatedBy = u.deactivatedBy;
      return normalized;
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
    password: await hashPassword(input.password),
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
    password: await hashPassword(nextPassword),
    mustChangePassword: true,
    updatedAt: new Date().toISOString(),
  };
  await writeUsers(users);
  return users[idx];
}

export async function deactivateUser(username: string, actor = "system") {
  const users = await readUsers();
  const normalized = normalizeUsername(username);
  const idx = users.findIndex((user) => user.username === normalized);
  if (idx === -1) return null;
  users[idx] = {
    ...users[idx],
    deactivatedAt: users[idx].deactivatedAt ?? new Date().toISOString(),
    deactivatedBy: users[idx].deactivatedBy ?? actor,
    updatedAt: new Date().toISOString(),
  };
  await writeUsers(users);
  return users[idx];
}

export async function deleteUser(username: string) {
  return Boolean(await deactivateUser(username));
}

export async function changeOwnPassword(username: string, currentPassword: string, nextPassword: string) {
  const users = await readUsers();
  const normalized = normalizeUsername(username);
  const idx = users.findIndex((user) => user.username === normalized);
  if (idx === -1) return { ok: false as const, reason: "not_found" as const };
  if (!(await verifyPassword(users[idx].password, currentPassword))) return { ok: false as const, reason: "invalid_current_password" as const };
  users[idx] = {
    ...users[idx],
    password: await hashPassword(nextPassword),
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  };
  await writeUsers(users);
  return { ok: true as const };
}

export async function validateCredentials(username: string, password: string): Promise<(SessionInfo & { mustChangePassword: boolean; dashboardPreset: DashboardPreset }) | null> {
  const user = await getUser(username);
  if (!user || user.deactivatedAt) return null;
  if (!(await verifyPassword(user.password, password))) return null;
  if (!isPasswordHash(user.password)) {
    await resetUserPassword(user.username, password);
    await updateUser(user.username, { mustChangePassword: user.mustChangePassword });
  }
  return { username: user.username, role: user.role, mustChangePassword: user.mustChangePassword, dashboardPreset: user.dashboardPreset };
}

export function createSessionCookieValue(session: SessionInfo) {
  const payload = base64UrlEncode(
    JSON.stringify({
      username: normalizeUsername(session.username),
      role: session.role,
      issuedAt: Date.now(),
    }),
  );
  const signature = signSessionPayload(payload);
  return `${payload}.${signature}`;
}

export function parseSessionCookieValue(value: string | undefined): SessionInfo | null {
  if (!value) return null;

  const [payload, signature, ...extra] = value.split(".");
  if (!payload || !signature || extra.length > 0) return null;

  const expected = signSessionPayload(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as Partial<SessionInfo>;
    const username = normalizeUsername(String(parsed.username ?? ""));
    const role = String(parsed.role ?? "");
    if (!username || !isAppRole(role)) return null;
    return { username, role };
  } catch {
    return null;
  }
}

