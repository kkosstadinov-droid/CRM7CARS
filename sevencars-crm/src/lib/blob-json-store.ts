import { BlobNotFoundError, BlobPreconditionFailedError, get, put } from "@vercel/blob";

type Factory<T> = () => T;

function resolveValue<T>(value: T | Factory<T>) {
  return typeof value === "function" ? (value as Factory<T>)() : value;
}

async function streamToText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

export function hasBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export async function readJsonBlob<T>(pathname: string, fallback: T | Factory<T>) {
  let result: Awaited<ReturnType<typeof get>>;
  try {
    result = await get(pathname, { access: "private", useCache: false });
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { value: resolveValue(fallback), etag: null as string | null, exists: false };
    }
    throw error;
  }

  if (!result || result.statusCode !== 200 || !result.stream) {
    return { value: resolveValue(fallback), etag: null as string | null, exists: false };
  }

  const raw = await streamToText(result.stream);
  try {
    return { value: JSON.parse(raw) as T, etag: result.blob.etag, exists: true };
  } catch {
    return { value: resolveValue(fallback), etag: result.blob.etag, exists: true };
  }
}

export async function writeJsonBlob<T>(pathname: string, value: T, etag?: string | null) {
  const uploaded = await put(pathname, JSON.stringify(value, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    ...(etag ? { ifMatch: etag } : {}),
  });

  return uploaded.etag;
}

export async function updateJsonBlob<T>(
  pathname: string,
  fallback: T | Factory<T>,
  updater: (current: T) => T | Promise<T>,
  retries = 15,
) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const current = await readJsonBlob(pathname, fallback);
    const next = await updater(current.value);

    try {
      const etag = await writeJsonBlob(pathname, next, current.etag);
      return { value: next, etag, existed: current.exists };
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError && attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to update blob ${pathname} after ${retries} attempts.`);
}
