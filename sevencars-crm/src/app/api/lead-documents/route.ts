import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import type { LeadDocument } from "@/lib/leads";
import { canSeeDocuments } from "@/lib/permissions.mjs";
import { appendAuditEvent } from "@/lib/audit-store.mjs";

export const runtime = "nodejs";

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

async function storeFileLocally(file: File, leadId: string) {
  const folder = safeSegment(leadId || "general");
  const fileName = `${Date.now()}-${safeSegment(file.name)}`;
  const relativePath = path.posix.join("uploads", "lead-documents", folder, fileName);
  const outputPath = path.join(process.cwd(), "public", ...relativePath.split("/"));

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(await file.arrayBuffer()));

  return {
    url: `/${relativePath}`,
    pathname: relativePath,
  };
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canSeeDocuments(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const formData = await request.formData();
  const file = formData.get("file");
  const leadId = String(formData.get("leadId") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json({ error: "Document uploads on Vercel require BLOB_READ_WRITE_TOKEN." }, { status: 503 });
  }

  try {
    const uploaded = process.env.BLOB_READ_WRITE_TOKEN?.trim()
      ? await put(`crm/documents/${safeSegment(leadId || "general")}/${Date.now()}-${safeSegment(file.name)}`, file, {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: file.type || "application/octet-stream",
        })
      : await storeFileLocally(file, leadId);

    const document: LeadDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      url: uploaded.url,
      pathname: uploaded.pathname,
      uploadedAt: timestamp,
      size: file.size,
    };

    await appendAuditEvent({
      actor: session,
      action: "document.upload",
      entityType: "lead",
      entityId: leadId || "general",
      entityLabel: file.name,
      summary: `Uploaded document ${file.name}`,
      changes: [],
      metadata: { documentId: document.id, pathname: document.pathname, size: document.size },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Document upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

