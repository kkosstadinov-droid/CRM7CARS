import { NextResponse } from "next/server";
import { hasBlobStore } from "@/lib/blob-json-store";

export class PersistentStoreUnavailableError extends Error {
  constructor() {
    super("Persistent CRM storage is not configured. Set BLOB_READ_WRITE_TOKEN in Vercel before using CRM data APIs.");
    this.name = "PersistentStoreUnavailableError";
  }
}

export function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

export function hasPersistentStore() {
  if (hasBlobStore()) return true;
  return !isVercelRuntime();
}

export function assertPersistentStore() {
  if (!hasPersistentStore()) {
    throw new PersistentStoreUnavailableError();
  }
}

export function persistentStoreErrorResponse(error: unknown) {
  if (error instanceof PersistentStoreUnavailableError) {
    return NextResponse.json(
      {
        error: error.message,
        requiredEnv: "BLOB_READ_WRITE_TOKEN",
      },
      { status: 503 },
    );
  }
  return null;
}
