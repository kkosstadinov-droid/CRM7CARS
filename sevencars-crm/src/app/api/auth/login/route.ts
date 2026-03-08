import { NextResponse } from "next/server";
import { createSessionCookieValue, validateCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };

  const session = await validateCredentials(body.username ?? "", body.password ?? "");

  if (!session) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    role: session.role,
    username: session.username,
    mustChangePassword: session.mustChangePassword,
    dashboardPreset: session.dashboardPreset,
  });

  response.cookies.set("sevencars_session", createSessionCookieValue({ username: session.username, role: session.role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return response;
}
