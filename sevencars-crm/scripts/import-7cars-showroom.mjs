import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

const baseUrl = "https://7cars.bg";
const listUrl = `${baseUrl}/cars/`;
const actor = "7cars.bg import";
const contactPhone = "0894707690";

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&bull;/g, "-")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function htmlToLines(html) {
  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|tr|td|th)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeUrl(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function extractPagination(html) {
  const pages = [...html.matchAll(/\/cars\/page\/(\d+)\/?/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  return pages.length ? Math.max(...pages) : 1;
}

function extractListingUrls(html) {
  const matches = [
    ...html.matchAll(/href="(\/cars\/(?!page\/|feed\/)[^"#?]+\/?)"/g),
    ...html.matchAll(/href="(https:\/\/7cars\.bg\/cars\/(?!page\/|feed\/)[^"#?]+\/?)"/g),
  ];

  return [...new Set(matches.map((match) => new URL(match[1], baseUrl).toString()))];
}

function lineIndex(lines, label) {
  return lines.findIndex((line) => line === label || line.startsWith(`${label}:`) || line.startsWith(`${label} `));
}

function isMeaningfulTitleCandidate(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return false;
  if (/^[\W_]+$/u.test(normalized)) return false;
  if (normalized.includes("€")) return false;
  if (normalized.startsWith("ID:")) return false;
  return true;
}

function fieldValue(lines, label) {
  const index = lineIndex(lines, label);
  return index >= 0 ? lines[index + 1] ?? "" : "";
}

function textBetween(lines, startLabels, endLabels) {
  const startIndex = startLabels.map((label) => lineIndex(lines, label)).find((index) => index >= 0) ?? -1;
  if (startIndex < 0) return "";
  const endIndex = lines.findIndex((line, index) => index > startIndex && endLabels.some((label) => line === label || line.startsWith(`${label}:`) || line.startsWith(`${label} `)));
  const slice = lines.slice(startIndex + 1, endIndex >= 0 ? endIndex : undefined);
  return slice.join("\n").trim();
}

function inferTitle(lines, brand, model) {
  const topLine = lines[0]?.replace(/\s+на ТОП цена от 7cars BG$/i, "").trim();
  if (isMeaningfulTitleCandidate(topLine) && (brand ? topLine.toLowerCase().includes(brand.toLowerCase()) : true)) {
    return topLine;
  }

  const descriptionIndex = ["Описание на автомобила:", "🚀 Описание:", "Описание:"]
    .map((label) => lineIndex(lines, label))
    .find((index) => index >= 0) ?? -1;
  if (descriptionIndex > 0) {
    const title = lines[descriptionIndex - 1]?.trim();
    if (isMeaningfulTitleCandidate(title)) return title;
  }
  const statusIndex = ["Наличен", "Продаден", "Промо"].map((label) => lineIndex(lines, label)).find((index) => index >= 0) ?? -1;
  if (statusIndex >= 0) {
    for (let index = statusIndex + 1; index < Math.min(lines.length, statusIndex + 6); index += 1) {
      const candidate = lines[index];
      if (isMeaningfulTitleCandidate(candidate)) {
        return candidate;
      }
    }
  }
  return [brand, model].filter(Boolean).join(" ").trim() || "7cars vehicle";
}

function parseVehicle(detailHtml, url) {
  const lines = htmlToLines(detailHtml);
  const sold = lines.includes("Продаден");
  const brand = fieldValue(lines, "Марка");
  const model = fieldValue(lines, "Модел");
  const year = fieldValue(lines, "Година").replace(/\D/g, "").slice(0, 4);
  const mileage = fieldValue(lines, "Пробег").replace(/[^\d]/g, "");
  const vin = fieldValue(lines, "Рама");
  const fuel = fieldValue(lines, "Двигател");
  const ownershipRaw = fieldValue(lines, "Собственост");
  const servicedRaw = fieldValue(lines, "Обслужена");
  const title = inferTitle(lines, brand, model);
  const description = textBetween(lines, ["Описание на автомобила:", "🚀 Описание:", "Описание:"], ["За нас:", "📞 За повече информация:", "Не намираш точния автомобил?"]);

  return {
    url,
    sold,
    title,
    brand,
    model,
    year,
    mileage,
    vin,
    fuel,
    description,
    ownership: ownershipRaw === "Клиент" ? "Client" : "Own",
    serviced: /^да$/i.test(servicedRaw) ? "Yes" : "No",
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; 7cars-crm-import/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function mapPool(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, () => worker()));
  return results;
}

function importedPayload(vehicle, createdAtIso, id) {
  return {
    id,
    fullName: vehicle.title,
    phone: contactPhone,
    email: "orders@7cars.bg",
    vehicleRequest: [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" "),
    contractLink: vehicle.url,
    handoverNote: "Imported automatically from 7cars.bg",
    handoverDepartment: "showroom",
    isFamily: false,
    lastUpdatedBy: actor,
    brand: vehicle.brand,
    model: vehicle.model,
    engine: vehicle.fuel,
    vin: vehicle.vin,
    serviced: vehicle.serviced,
    purchaseLocation: "7cars.bg showroom",
    showroomOwnership: vehicle.ownership,
    showroomContract: [],
    showroomReserved: "No",
    showroomSold: "No",
    warranty: /гаранц/i.test(vehicle.title) || /гаранц/i.test(vehicle.description) ? "Yes" : "No",
    serviceOfferDetails: vehicle.serviced === "Yes" ? "Обслужена" : "",
    addonOther: vehicle.description,
    firstRegistrationDate: vehicle.year,
    mileage: vehicle.mileage,
    inspection: "No",
    source: "other",
    stage: "New Lead",
    createdAt: createdAtIso,
    history: [
      {
        id: `history_${id}`,
        at: createdAtIso,
        actor,
        action: "created",
        message: `Imported from 7cars.bg (${vehicle.url}).`,
      },
    ],
    noteEntries: [],
  };
}

async function main() {
  const firstPageHtml = await fetchText(listUrl);
  const totalPages = extractPagination(firstPageHtml);
  const pageUrls = Array.from({ length: totalPages }, (_, index) => (index === 0 ? listUrl : `${listUrl}page/${index + 1}/`));

  const listingPages = await mapPool(pageUrls, 4, (url) => fetchText(url));
  const vehicleUrls = [...new Set(listingPages.flatMap((html) => extractListingUrls(html)).map(normalizeUrl))];

  const existingShowroom = await prisma.crmLead.findMany({ where: { handoverDepartment: "showroom" } });
  const existingLinks = new Set();

  for (const row of existingShowroom) {
    try {
      const payload = JSON.parse(row.payload);
      if (typeof payload.contractLink === "string" && payload.contractLink) {
        existingLinks.add(normalizeUrl(payload.contractLink));
      }
    } catch {
      // Ignore malformed rows and keep importing the rest.
    }
  }

  const fetchedVehicles = await mapPool(vehicleUrls, 8, async (url) => {
    try {
      return parseVehicle(await fetchText(url), normalizeUrl(url));
    } catch (error) {
      console.warn(String(error));
      return null;
    }
  });

  const activeVehicles = fetchedVehicles.filter((vehicle) => vehicle && !vehicle.sold && vehicle.brand && vehicle.model && vehicle.year);
  const newVehicles = activeVehicles.filter((vehicle) => !existingLinks.has(vehicle.url));
  const startedAt = Date.now();

  for (const [index, vehicle] of newVehicles.entries()) {
    const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const createdAtIso = new Date(startedAt + index * 1000).toISOString();
    const payload = importedPayload(vehicle, createdAtIso, id);

    await prisma.crmLead.create({
      data: {
        id,
        createdAt: new Date(createdAtIso),
        handoverDepartment: "showroom",
        stage: "New Lead",
        isFamily: false,
        lastUpdatedBy: actor,
        payload: JSON.stringify(payload),
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        totalPages,
        discoveredListings: vehicleUrls.length,
        activeVehicles: activeVehicles.length,
        imported: newVehicles.length,
        skippedExisting: activeVehicles.length - newVehicles.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
