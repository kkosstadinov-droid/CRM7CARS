import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { deleteActivity, updateActivity } from "@/lib/activities-store";
import type { ActivityDto } from "@/lib/activities";

type UpdateActivityBody = {
  title?: string;
  note?: string;
  startsAt?: string;
  status?: ActivityDto["status"];
  ownerUsername?: string;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateActivityBody;

    const patch: Partial<Omit<ActivityDto, "id" | "createdAt">> = {};
    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.note === "string") patch.note = body.note.trim();
    if (typeof body.status === "string" && (body.status === "planned" || body.status === "done")) patch.status = body.status;
    if (typeof body.ownerUsername === "string") patch.ownerUsername = body.ownerUsername.trim().toLowerCase();
    if (typeof body.startsAt === "string" && !Number.isNaN(Date.parse(body.startsAt))) {
      patch.startsAt = new Date(body.startsAt).toISOString();
    }

    const updated = await updateActivity(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Activity not found." }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Failed to update activity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const deleted = await deleteActivity(id);
    if (!deleted) {
      return NextResponse.json({ error: "Activity not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Failed to delete activity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

