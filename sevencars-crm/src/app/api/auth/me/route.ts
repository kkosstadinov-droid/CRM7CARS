import { cookies } from "next/headers";
import { getUser, parseSessionCookieValue } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const sessionRaw = (await cookies()).get("sevencars_session")?.value;
  const session = parseSessionCookieValue(sessionRaw);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUser(session.username);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    username: user.username,
    role: user.role,
    dashboardPreset: user.dashboardPreset,
    mustChangePassword: user.mustChangePassword,
  });
}
