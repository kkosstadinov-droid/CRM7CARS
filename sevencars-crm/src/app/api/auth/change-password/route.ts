import { cookies } from "next/headers";
import { changeOwnPassword, parseSessionCookieValue } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const sessionRaw = (await cookies()).get("sevencars_session")?.value;
  const session = parseSessionCookieValue(sessionRaw);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  const currentPassword = body.currentPassword?.trim() ?? "";
  const newPassword = body.newPassword?.trim() ?? "";
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
  }
  if (newPassword.length < 4) {
    return NextResponse.json({ error: "New password must be at least 4 characters." }, { status: 400 });
  }

  const changed = await changeOwnPassword(session.username, currentPassword, newPassword);
  if (!changed.ok) {
    return NextResponse.json({ error: "Invalid current password." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
