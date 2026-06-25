import { cookies } from "next/headers";
import { parseSessionCookieValue, type SessionInfo } from "@/lib/auth";

export async function getCurrentSession(): Promise<SessionInfo | null> {
  const sessionRaw = (await cookies()).get("sevencars_session")?.value;
  return parseSessionCookieValue(sessionRaw);
}
