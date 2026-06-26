import { cookies } from "next/headers";
import { deleteUser, listUsers, parseSessionCookieValue, resetUserPassword, type AppRole, type DashboardPreset, updateUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { canCreateUsers } from "@/lib/permissions.mjs";
import { appendAuditEvent, summarizeAuditPatch } from "@/lib/audit-store.mjs";

async function assertUserManager() {
  const sessionRaw = (await cookies()).get("sevencars_session")?.value;
  const session = parseSessionCookieValue(sessionRaw);
  return canCreateUsers(session) ? session : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const manager = await assertUserManager();
  if (!manager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { username } = await params;
  const body = (await request.json()) as { role?: AppRole; dashboardPreset?: DashboardPreset; mustChangePassword?: boolean };
  const users = await listUsers();
  const current = users.find((u) => u.username === username.trim().toLowerCase());
  const updated = await updateUser(username, {
    role: body.role,
    dashboardPreset: body.dashboardPreset,
    mustChangePassword: body.mustChangePassword,
  });
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const changes = summarizeAuditPatch(
    current ? { role: current.role, dashboardPreset: current.dashboardPreset, mustChangePassword: current.mustChangePassword } : {},
    { role: updated.role, dashboardPreset: updated.dashboardPreset, mustChangePassword: updated.mustChangePassword },
  );
  await appendAuditEvent({
    actor: manager,
    action: "user.update",
    entityType: "user",
    entityId: updated.username,
    entityLabel: updated.username,
    summary: changes.length ? `Updated user ${updated.username}: ${changes.map((change) => change.field).join(", ")}` : `Updated user ${updated.username}`,
    changes,
  });
  return NextResponse.json({
    username: updated.username,
    role: updated.role,
    dashboardPreset: updated.dashboardPreset,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    mustChangePassword: updated.mustChangePassword,
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const manager = await assertUserManager();
  if (!manager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { username } = await params;
  const users = await listUsers();
  const target = users.find((u) => u.username === username.trim().toLowerCase());
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.username === manager.username) {
    return NextResponse.json({ error: "User manager cannot delete own account." }, { status: 400 });
  }
  await deleteUser(target.username);
  await appendAuditEvent({
    actor: manager,
    action: "user.delete",
    entityType: "user",
    entityId: target.username,
    entityLabel: target.username,
    summary: `Deleted user ${target.username} (${target.role})`,
    changes: [],
    metadata: { role: target.role, dashboardPreset: target.dashboardPreset },
  });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const manager = await assertUserManager();
  if (!manager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { username } = await params;
  const body = (await request.json()) as { action?: string; newPassword?: string };
  if (body.action !== "reset_password") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }
  const nextPassword = body.newPassword?.trim() ?? "";
  if (!nextPassword || nextPassword.length < 4) {
    return NextResponse.json({ error: "New password must be at least 4 characters." }, { status: 400 });
  }
  const updated = await resetUserPassword(username, nextPassword);
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
  await appendAuditEvent({
    actor: manager,
    action: "user.reset_password",
    entityType: "user",
    entityId: updated.username,
    entityLabel: updated.username,
    summary: `Reset password for user ${updated.username}`,
    changes: [{ field: "password", from: "********", to: "********" }],
    metadata: { mustChangePassword: updated.mustChangePassword },
  });
  return NextResponse.json({ ok: true });
}
