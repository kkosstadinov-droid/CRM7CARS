import { NextResponse } from "next/server";
import { createSessionCookieValue, validateCredentials } from "@/lib/auth";
import { persistentStoreErrorResponse } from "@/lib/persistence";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };

  let session;
  try {
    session = await validateCredentials(body.username ?? "", body.password ?? "");
  } catch (error) {
    const response = persistentStoreErrorResponse(error);
    if (response) return response;
    throw error;
  }

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
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return response;
}

