import { NextResponse } from "next/server";
import { createActivity, listActivities } from "@/lib/activities-store";

type CreateActivityBody = {
  title?: string;
  note?: string;
  startsAt?: string;
  department?: "sales" | "account" | "logistics";
};

export async function GET() {
  const activities = await listActivities();
  return NextResponse.json(activities);
}

export async function POST(request: Request) {
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
  });

  return NextResponse.json(created, { status: 201 });
}
