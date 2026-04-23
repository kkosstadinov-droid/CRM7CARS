import { get, list, put } from "@vercel/blob";

const activitiesBlobPrefix = process.env.ACTIVITIES_BLOB_PREFIX?.trim() || "crm/activities/";

const defaultOwnerByDepartment = {
  sales: "sales",
  account: "accountmanager",
  logistics: "logistics",
};

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required.");
  }

  const page = await list({ prefix: activitiesBlobPrefix, limit: 5000 });
  let updated = 0;
  let skipped = 0;

  for (const blob of page.blobs) {
    const result = await get(blob.pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      skipped += 1;
      continue;
    }

    const raw = await new Response(result.stream).text();
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      skipped += 1;
      continue;
    }

    if (typeof payload.ownerUsername === "string" && payload.ownerUsername.trim()) {
      skipped += 1;
      continue;
    }

    payload.ownerUsername = defaultOwnerByDepartment[payload.department] ?? "";

    await put(blob.pathname, JSON.stringify(payload, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
    });

    updated += 1;
  }

  console.log(JSON.stringify({ updated, skipped }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
