import { cookies } from "next/headers";
import { createUser, listUsers, parseSessionCookieValue, type AppRole, type DashboardPreset } from "@/lib/auth";
import { NextResponse } from "next/server";

async function assertAdmin() {
  const sessionRaw = (await cookies()).get("sevencars_session")?.value;
  const session = parseSessionCookieValue(sessionRaw);
  return session?.role === "Admin" ? session : null;
}

export async function GET() {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const users = await listUsers();
  return NextResponse.json(
    users.map((user) => ({
      username: user.username,
      role: user.role,
      dashboardPreset: user.dashboardPreset,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      mustChangePassword: user.mustChangePassword,
    })),
  );
}

export async function POST(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json()) as { username?: string; password?: string; role?: AppRole; dashboardPreset?: DashboardPreset };
  const username = body.username?.trim() ?? "";
  const password = body.password?.trim() ?? "";
  if (!username || !password || !body.role) {
    return NextResponse.json({ error: "Username, password and role are required." }, { status: 400 });
  }
  try {
    const created = await createUser({
      username,
      password,
      role: body.role,
      dashboardPreset: body.dashboardPreset ?? "pipeline",
    });
    return NextResponse.json({
      username: created.username,
      role: created.role,
      dashboardPreset: created.dashboardPreset,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      mustChangePassword: created.mustChangePassword,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
