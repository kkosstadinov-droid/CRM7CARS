import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { ContractPackage, LeadDto, LeadSourceInput, MemoStatus, RegistrationStatus, YesNo } from "@/lib/leads";

const dataDir = process.env.DATA_DIR?.trim() || (process.env.VERCEL ? path.join("/tmp", "sevencars-crm-data") : path.join(process.cwd(), "data"));
const leadsPath = path.join(dataDir, "leads.json");
const maxSeedImportBytes = 20 * 1024 * 1024;
const pipelineStages: LeadDto["stage"][] = ["New leed", "Contacted", "No Answer", "Faild", "Potential", "Contract"];

let bootstrapPromise: Promise<void> | null = null;

const validSources: LeadSourceInput[] = ["call", "mail", "whatsapp", "viber", "facebook", "instagram", "other"];

function normalizeStage(stage: string | undefined): LeadDto["stage"] {
  const s = String(stage ?? "").trim().toLowerCase();
  if (s === "new leed" || s === "new lead") return "New leed";
  if (s === "contacted") return "Contacted";
  if (s === "no answer" || s === "noanswer") return "No Answer";
  if (s === "faild" || s === "failed") return "Faild";
  if (s === "potential" || s === "searching") return "Potential";
  if (s === "contract" || s === "sent to accountmanager") return "Contract";
  return "New leed";
}

function normalizeDepartment(value: string | undefined): LeadDto["handoverDepartment"] {
  if (value === "sales" || value === "account" || value === "logistics" || value === "showroom") return value;
  return "sales";
}

function normalizeMemoStatus(value: string | undefined): MemoStatus {
  if (value === "pending_teamlead" || value === "rejected_by_teamlead" || value === "pending_operation" || value === "rejected_by_operation" || value === "approved") {
    return value;
  }
  return "none";
}

function normalizeYesNo(value: string | undefined): YesNo {
  return value === "Yes" ? "Yes" : "No";
}

function normalizeRegistration(value: string | undefined): RegistrationStatus {
  return value === "Yes" || value === "Yes transit" ? value : "No";
}

function normalizePackage(value: string | undefined): ContractPackage {
  return value === "Auction" || value === "Plus" || value === "Diamond" ? value : "";
}

function normalizeSource(value: string | undefined): LeadSourceInput {
  return validSources.includes(value as LeadSourceInput) ? (value as LeadSourceInput) : "other";
}

function normalizeLead(input: Partial<LeadDto> & Pick<LeadDto, "id">): LeadDto {
  const createdAtIso = input.createdAt && !Number.isNaN(Date.parse(input.createdAt)) ? new Date(input.createdAt).toISOString() : new Date().toISOString();
  return {
    id: input.id,
    fullName: input.fullName ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    egn: input.egn ?? "",
    address: input.address ?? "",
    vehicleRequest: input.vehicleRequest ?? "",
    contractLink: input.contractLink ?? "",
    handoverNote: input.handoverNote ?? "",
    handoverDepartment: normalizeDepartment(input.handoverDepartment),
    isFamily: input.isFamily === true,
    familyAt: input.familyAt ?? "",
    lastUpdatedBy: input.lastUpdatedBy ?? "",
    car: input.car ?? "",
    purchaseDate: input.purchaseDate ?? "",
    am: input.am ?? "",
    referral: input.referral ?? "",
    discount: input.discount ?? "",
    clientDiscount: input.clientDiscount ?? "",
    budget: input.budget ?? "",
    contractPackage: normalizePackage(input.contractPackage),
    contractPrice: input.contractPrice ?? "",
    brand: input.brand ?? "",
    model: input.model ?? "",
    engine: input.engine ?? "",
    keylessStart: normalizeYesNo(input.keylessStart),
    weight: input.weight ?? "",
    color: input.color ?? "",
    powerKw: input.powerKw ?? "",
    powerHp: input.powerHp ?? "",
    seatsCount: input.seatsCount ?? "",
    doorsCount: input.doorsCount ?? "",
    vin: input.vin ?? "",
    serviced: normalizeYesNo(input.serviced),
    servicedDate: input.servicedDate ?? "",
    secondKey: normalizeYesNo(input.secondKey),
    secondTireSet: normalizeYesNo(input.secondTireSet),
    purchaseLocation: input.purchaseLocation ?? "",
    vatKey: input.vatKey ?? "",
    deliveryPrice: input.deliveryPrice ?? "",
    warranty: normalizeYesNo(input.warranty),
    insuranceInfo: input.insuranceInfo ?? "",
    insuranceGoPrice: input.insuranceGoPrice ?? "",
    insuranceCascoPrice: input.insuranceCascoPrice ?? "",
    insuranceAccepted: normalizeYesNo(input.insuranceAccepted),
    registrationInfo: input.registrationInfo ?? "",
    registrationAccepted: normalizeYesNo(input.registrationAccepted),
    serviceOfferDetails: input.serviceOfferDetails ?? "",
    serviceCostPrice: input.serviceCostPrice ?? "",
    servicePrice: input.servicePrice ?? "",
    serviceOfferAccepted: normalizeYesNo(input.serviceOfferAccepted),
    detailingInfo: input.detailingInfo ?? "",
    detailingPrice: input.detailingPrice ?? "",
    detailingAccepted: normalizeYesNo(input.detailingAccepted),
    tiresAccepted: normalizeYesNo(input.tiresAccepted),
    registrationStatus: normalizeRegistration(input.registrationStatus),
    cascoPhotos: normalizeYesNo(input.cascoPhotos),
    inspection: normalizeYesNo(input.inspection),
    serviceOffer: normalizeYesNo(input.serviceOffer),
    serviceOfferLink: input.serviceOfferLink ?? "",
    inspectionProtocolLink: input.inspectionProtocolLink ?? "",
    detailing: input.detailing ?? "",
    tiresInfo: input.tiresInfo ?? "",
    tiresCostPrice: input.tiresCostPrice ?? "",
    tiresPrice: input.tiresPrice ?? "",
    wheelsInfo: input.wheelsInfo ?? "",
    addonOther: input.addonOther ?? "",
    firstRegistrationDate: input.firstRegistrationDate ?? "",
    mileage: input.mileage ?? "",
    memoStatus: normalizeMemoStatus(input.memoStatus),
    memoContractLink: input.memoContractLink ?? "",
    memoDescription: input.memoDescription ?? "",
    memoAccountSubmittedAt: input.memoAccountSubmittedAt ?? "",
    memoTeamLeadComment: input.memoTeamLeadComment ?? "",
    memoTeamLeadDecisionAt: input.memoTeamLeadDecisionAt ?? "",
    memoOperationComment: input.memoOperationComment ?? "",
    memoOperationDecisionAt: input.memoOperationDecisionAt ?? "",
    memoEvents: Array.isArray(input.memoEvents) ? input.memoEvents : [],
    transferredToAccountAt: input.transferredToAccountAt ?? "",
    transferredToLogisticsAt: input.transferredToLogisticsAt ?? "",
    operationApprovedAt: input.operationApprovedAt ?? "",
    serviceOfferUploadedAt: input.serviceOfferUploadedAt ?? "",
    inspectionProtocolUploadedAt: input.inspectionProtocolUploadedAt ?? "",
    insuranceTouchedAt: input.insuranceTouchedAt ?? "",
    serviceTouchedAt: input.serviceTouchedAt ?? "",
    source: normalizeSource(input.source),
    stage: normalizeStage(input.stage),
    createdAt: createdAtIso,
  };
}

function toRow(lead: LeadDto) {
  return {
    id: lead.id,
    createdAt: new Date(lead.createdAt),
    handoverDepartment: lead.handoverDepartment,
    stage: lead.stage,
    isFamily: lead.isFamily,
    lastUpdatedBy: lead.lastUpdatedBy,
    payload: JSON.stringify(lead),
  };
}

function fromRow(row: { id: string; createdAt: Date; handoverDepartment: string; stage: string; isFamily: boolean; lastUpdatedBy: string; payload: string }): LeadDto {
  let parsed: Partial<LeadDto> = {};
  try {
    parsed = JSON.parse(row.payload) as Partial<LeadDto>;
  } catch {
    parsed = {};
  }
  return normalizeLead({
    ...parsed,
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    handoverDepartment: normalizeDepartment(row.handoverDepartment),
    stage: normalizeStage(row.stage),
    isFamily: row.isFamily,
    lastUpdatedBy: row.lastUpdatedBy,
  });
}

type LeadRow = {
  id: string;
  createdAt: Date;
  handoverDepartment: string;
  stage: string;
  isFamily: boolean;
  lastUpdatedBy: string;
  payload: string;
};

function demoLeads(): LeadDto[] {
  const base = new Date("2026-01-01T08:00:00.000Z").getTime();
  const firstNames = ["Ivan", "Nikolay", "Elena", "Georgi", "Mila", "Petar", "Teodora", "Martin", "Raya", "Deyan"];
  const lastNames = ["Petrov", "Georgiev", "Dimitrova", "Marinov", "Stoyanova", "Ivanov", "Koleva", "Todorov", "Nikolova", "Hristov"];
  const brands = ["BMW", "Audi", "Mercedes", "VW", "Toyota", "Skoda"];
  const models = ["X5", "A6", "GLC", "Tiguan", "RAV4", "Kodiaq"];
  const leads: LeadDto[] = [];

  for (let stageIndex = 0; stageIndex < pipelineStages.length; stageIndex += 1) {
    const stage = pipelineStages[stageIndex];
    for (let i = 0; i < 10; i += 1) {
      const idx = stageIndex * 10 + i;
      const firstName = firstNames[(stageIndex + i) % firstNames.length];
      const lastName = lastNames[(stageIndex * 2 + i) % lastNames.length];
      const brand = brands[idx % brands.length];
      const model = models[(idx + 1) % models.length];
      const year = 2018 + ((idx + 2) % 8);
      const createdAt = new Date(base + idx * 10 * 60_000).toISOString();

      leads.push(
        normalizeLead({
          id: `demo_lead_${stageIndex + 1}_${i + 1}`,
          fullName: `${firstName} ${lastName}`,
          phone: `+35988${String(1000000 + idx).slice(-7)}`,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${idx}@example.com`,
          egn: `90010${String(1000 + idx).slice(-4)}`,
          address: "Sofia",
          vehicleRequest: `${brand} ${model} ${year}`,
          source: validSources[idx % validSources.length],
          stage,
          createdAt,
          handoverDepartment: "sales",
          handoverNote: `Demo lead for ${stage}`,
        }),
      );
    }
  }

  return leads;
}

async function topUpPipelineStages() {
  const stageRows = await prisma.crmLead.findMany({
    where: {
      isFamily: false,
      handoverDepartment: "sales",
      stage: { in: pipelineStages },
    },
    select: { stage: true },
  });
  const counts = Object.fromEntries(pipelineStages.map((stage) => [stage, 0])) as Record<LeadDto["stage"], number>;
  for (const row of stageRows) {
    const stage = normalizeStage(row.stage);
    counts[stage] += 1;
  }

  const templates = demoLeads();
  const additions: ReturnType<typeof toRow>[] = [];
  const now = Date.now();

  for (let stageIndex = 0; stageIndex < pipelineStages.length; stageIndex += 1) {
    const stage = pipelineStages[stageIndex];
    const missing = Math.max(0, 10 - counts[stage]);
    if (missing === 0) continue;
    const stageTemplates = templates.filter((lead) => lead.stage === stage);
    for (let i = 0; i < missing; i += 1) {
      const sourceLead = stageTemplates[i % stageTemplates.length];
      const offset = additions.length + i;
      const seeded = normalizeLead({
        ...sourceLead,
        id: `seed_${Date.now()}_${stageIndex}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        fullName: `${sourceLead.fullName} Seed ${counts[stage] + i + 1}`,
        createdAt: new Date(now + offset * 60_000).toISOString(),
      });
      additions.push(toRow(seeded));
    }
  }

  if (additions.length > 0) {
    await prisma.crmLead.createMany({ data: additions });
  }
}

async function importFromJsonIfNeeded() {
  await mkdir(dataDir, { recursive: true });
  const count = await prisma.crmLead.count();
  if (count > 0) {
    await topUpPipelineStages();
    return;
  }

  let imported = false;
  try {
    const fileInfo = await stat(leadsPath);
    if (fileInfo.size > maxSeedImportBytes) {
      throw new Error("seed file too large");
    }

    const raw = await readFile(leadsPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize);
        const rows = chunk.map((item) => {
          const id = typeof item?.id === "string" && item.id ? item.id : `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const lead = normalizeLead({ ...(item as Partial<LeadDto>), id });
          return toRow(lead);
        });
        await prisma.crmLead.createMany({ data: rows });
      }
      imported = true;
    }
  } catch {
    // fall through to demo seed
  }

  if (!imported) {
    const rows = demoLeads().map(toRow);
    await prisma.crmLead.createMany({ data: rows });
  }
  await topUpPipelineStages();
}

async function ensureReady() {
  if (!bootstrapPromise) {
    bootstrapPromise = importFromJsonIfNeeded();
  }
  await bootstrapPromise;
}

type ListLeadOptions = {
  department?: "sales" | "account" | "logistics" | "showroom";
  includeShowroom?: boolean;
  customerType?: "new" | "existing";
  limit?: number;
};

export async function listLeads(options: ListLeadOptions = {}) {
  await ensureReady();
  const where: {
    handoverDepartment?: { in: string[] } | string;
    isFamily?: boolean;
  } = {};

  if (options.customerType === "new") where.isFamily = false;
  if (options.customerType === "existing") where.isFamily = true;

  if (options.department) {
    if (options.department === "sales" && options.includeShowroom) {
      where.handoverDepartment = { in: ["sales", "showroom"] };
    } else {
      where.handoverDepartment = options.department;
    }
  }

  const rows = await prisma.crmLead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(options.limit && options.limit > 0 ? { take: options.limit } : {}),
  });

  return rows.map((row: LeadRow) => fromRow(row));
}

export async function createLead(lead: Omit<LeadDto, "id" | "createdAt"> & { createdAt?: string }) {
  await ensureReady();
  const created = normalizeLead({
    ...lead,
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: lead.createdAt,
  });
  await prisma.crmLead.create({ data: toRow(created) });
  return created;
}

export async function updateLead(id: string, patch: Partial<Omit<LeadDto, "id">>) {
  await ensureReady();
  const row = await prisma.crmLead.findUnique({ where: { id } });
  if (!row) return null;
  const current = fromRow(row);
  const merged = normalizeLead({
    ...current,
    ...patch,
    id,
    createdAt: patch.createdAt ?? current.createdAt,
  });
  await prisma.crmLead.update({
    where: { id },
    data: {
      createdAt: new Date(merged.createdAt),
      handoverDepartment: merged.handoverDepartment,
      stage: merged.stage,
      isFamily: merged.isFamily,
      lastUpdatedBy: merged.lastUpdatedBy,
      payload: JSON.stringify(merged),
    },
  });
  return merged;
}

export async function deleteLead(id: string) {
  await ensureReady();
  try {
    await prisma.crmLead.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
