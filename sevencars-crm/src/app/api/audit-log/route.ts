import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { assertPersistentStore, persistentStoreErrorResponse } from "@/lib/persistence";
import { canSeeDashboard } from "@/lib/permissions.mjs";
import { listAuditEvents } from "@/lib/audit-store.mjs";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canSeeDashboard(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    assertPersistentStore();
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get("limit") ?? "100", 10);
    const filters = {
      limit,
      entityType: searchParams.get("entityType") ?? undefined,
      entityId: searchParams.get("entityId") ?? undefined,
      actorUsername: searchParams.get("actorUsername") ?? undefined,
      action: searchParams.get("action") ?? undefined,
    } as Parameters<typeof listAuditEvents>[0] & Record<string, unknown>;
    const events = await listAuditEvents(filters);
    return NextResponse.json(events);
  } catch (error) {
    const response = persistentStoreErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
