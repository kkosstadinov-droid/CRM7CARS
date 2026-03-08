import { cookies } from "next/headers";
import { deleteUser, listUsers, parseSessionCookieValue, resetUserPassword, type AppRole, type DashboardPreset, updateUser } from "@/lib/auth";
import { NextResponse } from "next/server";

async function assertAdmin() {
  const sessionRaw = (await cookies()).get("sevencars_session")?.value;
  const session = parseSessionCookieValue(sessionRaw);
  return session?.role === "Admin" ? session : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { username } = await params;
  const body = (await request.json()) as { role?: AppRole; dashboardPreset?: DashboardPreset; mustChangePassword?: boolean };
  const updated = await updateUser(username, {
    role: body.role,
    dashboardPreset: body.dashboardPreset,
    mustChangePassword: body.mustChangePassword,
  });
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
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
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { username } = await params;
  const users = await listUsers();
  const target = users.find((u) => u.username === username.trim().toLowerCase());
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.username === admin.username) {
    return NextResponse.json({ error: "Admin cannot delete own account." }, { status: 400 });
  }
  await deleteUser(target.username);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  return NextResponse.json({ ok: true });
}
