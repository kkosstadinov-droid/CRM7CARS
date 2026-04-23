import { get, list, put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });
const leadsBlobPrefix = process.env.LEADS_BLOB_PREFIX?.trim() || "crm/leads/";

function blobPath(id) {
  return `${leadsBlobPrefix}${id}.json`;
}

function normalizeUrl(url) {
  return String(url ?? "").trim().replace(/\/$/, "");
}

async function readBlobLeadLinks() {
  const page = await list({ prefix: leadsBlobPrefix, limit: 5000 });
  const links = new Set();

  for (const blob of page.blobs) {
    const result = await get(blob.pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) continue;
    const raw = await new Response(result.stream).text();
    try {
      const payload = JSON.parse(raw);
      if (payload.handoverDepartment === "showroom" && payload.contractLink) {
        links.add(normalizeUrl(payload.contractLink));
      }
    } catch {
      // Skip malformed blob entries.
    }
  }

  return links;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required.");
  }

  const rows = await prisma.crmLead.findMany({
    where: {
      handoverDepartment: "showroom",
      lastUpdatedBy: "7cars.bg import",
    },
    orderBy: { createdAt: "asc" },
  });

  const existingLinks = await readBlobLeadLinks();
  let uploaded = 0;
  let skipped = 0;

  for (const row of rows) {
    const payload = JSON.parse(row.payload);
    const link = normalizeUrl(payload.contractLink);

    if (link && existingLinks.has(link)) {
      skipped += 1;
      continue;
    }

    await put(blobPath(row.id), JSON.stringify(payload, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
    });

    if (link) {
      existingLinks.add(link);
    }
    uploaded += 1;
  }

  console.log(JSON.stringify({ sourceRows: rows.length, uploaded, skipped }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
