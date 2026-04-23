import { NextResponse } from "next/server";
import { createActivity, listActivities } from "@/lib/activities-store";

type CreateActivityBody = {
  title?: string;
  note?: string;
  startsAt?: string;
  department?: "sales" | "account" | "logistics";
  ownerUsername?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerUsername = searchParams.get("ownerUsername")?.trim().toLowerCase() ?? "";
  const activities = await listActivities({
    ownerUsername: ownerUsername || undefined,
  });
  return NextResponse.json(activities);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateActivityBody;

    const title = body.title?.trim() ?? "";
    const note = body.note?.trim() ?? "";
    const startsAt = body.startsAt?.trim() ?? "";

    if (!title || !startsAt || Number.isNaN(Date.parse(startsAt))) {
      return NextResponse.json({ error: "Valid title and date/time are required." }, { status: 400 });
    }

    const created = await createActivity({
      title,
      note,
      startsAt: new Date(startsAt).toISOString(),
      status: "planned",
      department:
        body.department === "account" || body.department === "logistics" || body.department === "sales"
          ? body.department
          : "sales",
      ownerUsername: body.ownerUsername?.trim().toLowerCase() ?? "",
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Failed to create activity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
