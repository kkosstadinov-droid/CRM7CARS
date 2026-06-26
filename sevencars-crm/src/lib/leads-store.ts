import { mkdir } from "node:fs/promises";
import path from "node:path";
import { get, list, put } from "@vercel/blob";
import { hasBlobStore } from "@/lib/blob-json-store";
import { assertPersistentStore } from "@/lib/persistence";
import { prisma } from "@/lib/prisma";
import type { ContractPackage, LeadDocument, LeadDto, LeadHistoryEvent, LeadNoteEntry, LeadSourceInput, MemoStatus, MemoSubject, RegistrationStatus, ShowroomOwnership, ShowroomPackage, YesNo } from "@/lib/leads";

const dataDir = process.env.DATA_DIR?.trim() || (process.env.VERCEL ? path.join("/tmp", "sevencars-crm-data") : path.join(process.cwd(), "data"));
const leadsBlobPrefix = process.env.LEADS_BLOB_PREFIX?.trim() || "crm/leads/";
let bootstrapPromise: Promise<void> | null = null;

const validSources: LeadSourceInput[] = ["call", "mail", "whatsapp", "viber", "facebook", "instagram", "other"];

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

function leadBlobPath(id: string) {
  return `${leadsBlobPrefix}${id}.json`;
}

function normalizeStage(stage: string | undefined): LeadDto["stage"] {
  const s = String(stage ?? "").trim().toLowerCase();
  if (s === "new lead" || s === "new leed") return "New Lead";
  if (s === "potential" || s === "potentiall" || s === "searching") return "Potential";
  if (s === "w/o potential" || s === "without potential" || s === "failed" || s === "faild") return "W/o Potential";
  if (s === "need time" || s === "needtime" || s === "contacted") return "Need Time";
  if (s === "no answer" || s === "noanswer") return "No Answer";
  if (s === "message") return "Message";
  if (s === "contract" || s === "sent to accountmanager") return "Contract";
  return "New Lead";
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

function normalizeMemoSubject(value: string | undefined): MemoSubject {
  if (value === "Buy car" || value === "Complain") return value;
  return "";
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

function normalizeShowroomOwnership(value: string | undefined): ShowroomOwnership {
  return value === "Client" ? "Client" : "Own";
}

function normalizeShowroomPackage(value: string | undefined): ShowroomPackage {
  return value === "Basic" || value === "Standart" || value === "VIP" ? value : "";
}

function normalizeSource(value: string | undefined): LeadSourceInput {
  return validSources.includes(value as LeadSourceInput) ? (value as LeadSourceInput) : "other";
}

function normalizeHistory(input: LeadDto["history"] | undefined): LeadHistoryEvent[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => typeof item === "object" && item !== null)
    .map((item) => {
      const event = item as Partial<LeadHistoryEvent>;
      return {
        id: typeof event.id === "string" && event.id ? event.id : `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        at: typeof event.at === "string" && !Number.isNaN(Date.parse(event.at)) ? new Date(event.at).toISOString() : new Date().toISOString(),
        actor: typeof event.actor === "string" ? event.actor : "",
        action: event.action === "created" || event.action === "updated" || event.action === "transferred" || event.action === "returned" || event.action === "memo" ? event.action : "updated",
        message: typeof event.message === "string" ? event.message : "",
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

function normalizeNoteEntries(input: LeadDto["noteEntries"] | undefined): LeadNoteEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => typeof item === "object" && item !== null)
    .map((item) => {
      const entry = item as Partial<LeadNoteEntry>;
      return {
        id: typeof entry.id === "string" && entry.id ? entry.id : `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        at: typeof entry.at === "string" && !Number.isNaN(Date.parse(entry.at)) ? new Date(entry.at).toISOString() : new Date().toISOString(),
        actor: typeof entry.actor === "string" ? entry.actor : "",
        note: typeof entry.note === "string" ? entry.note : "",
      };
    })
    .filter((entry) => entry.note.trim().length > 0)
    .sort((a, b) => b.at.localeCompare(a.at));
}

function normalizeDocuments(input: LeadDto["accountDocuments"] | undefined): LeadDocument[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => typeof item === "object" && item !== null)
    .map((item) => {
      const document = item as Partial<LeadDocument>;
      return {
        id: typeof document.id === "string" && document.id ? document.id : `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: typeof document.name === "string" ? document.name : "Document",
        url: typeof document.url === "string" ? document.url : "",
        pathname: typeof document.pathname === "string" ? document.pathname : "",
        uploadedAt: typeof document.uploadedAt === "string" && !Number.isNaN(Date.parse(document.uploadedAt)) ? new Date(document.uploadedAt).toISOString() : new Date().toISOString(),
        size: typeof document.size === "number" && Number.isFinite(document.size) ? document.size : 0,
      };
    })
    .filter((document) => document.url || document.pathname)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
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
    salesOwner: input.salesOwner ?? input.assignedTo ?? input.lastUpdatedBy ?? "",
    assignedTo: input.assignedTo ?? input.salesOwner ?? input.lastUpdatedBy ?? "",
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
    payoffDate: input.payoffDate ?? "",
    aftersalesWarranty: normalizeYesNo(input.aftersalesWarranty),
    aftersalesWarrantyDate: input.aftersalesWarrantyDate ?? "",
    aftersalesWarrantyMileage: input.aftersalesWarrantyMileage ?? "",
    purchaseLocation: input.purchaseLocation ?? "",
    vatKey: input.vatKey ?? "",
    deliveryPrice: input.deliveryPrice ?? "",
    showroomOwnership: normalizeShowroomOwnership(input.showroomOwnership),
    showroomPackage: normalizeShowroomPackage(input.showroomPackage),
    showroomContract: normalizeDocuments(input.showroomContract),
    showroomReserved: normalizeYesNo(input.showroomReserved),
    showroomSold: normalizeYesNo(input.showroomSold),
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
    memoSubject: normalizeMemoSubject(input.memoSubject),
    memoContractLink: input.memoContractLink ?? "",
    memoDescription: input.memoDescription ?? "",
    memoAccountSubmittedAt: input.memoAccountSubmittedAt ?? "",
    memoTeamLeadComment: input.memoTeamLeadComment ?? "",
    memoTeamLeadDecisionAt: input.memoTeamLeadDecisionAt ?? "",
    memoOperationComment: input.memoOperationComment ?? "",
    memoOperationDecisionAt: input.memoOperationDecisionAt ?? "",
    memoEvents: Array.isArray(input.memoEvents) ? input.memoEvents : [],
    callbackAt: input.callbackAt ?? "",
    callbackNotes: input.callbackNotes ?? "",
    callbackActivityId: input.callbackActivityId ?? "",
    familyFollowUpActivityId: input.familyFollowUpActivityId ?? "",
    pickupDate: input.pickupDate ?? "",
    pickupActivityId: input.pickupActivityId ?? "",
    accountDocuments: normalizeDocuments(input.accountDocuments),
    returnToSalesComment: input.returnToSalesComment ?? "",
    noteEntries: normalizeNoteEntries(input.noteEntries),
    history: normalizeHistory(input.history),
    transferredToAccountAt: input.transferredToAccountAt ?? "",
    transferredToLogisticsAt: input.transferredToLogisticsAt ?? "",
    operationApprovedAt: input.operationApprovedAt ?? "",
    serviceOfferUploadedAt: input.serviceOfferUploadedAt ?? "",
    inspectionProtocolUploadedAt: input.inspectionProtocolUploadedAt ?? "",
    insuranceTouchedAt: input.insuranceTouchedAt ?? "",
    serviceTouchedAt: input.serviceTouchedAt ?? "",
    source: normalizeSource(input.source),
    stage: normalizeStage(input.stage),
    archivedAt: typeof input.archivedAt === "string" ? input.archivedAt : undefined,
    archivedBy: typeof input.archivedBy === "string" ? input.archivedBy : undefined,
    archiveReason: typeof input.archiveReason === "string" ? input.archiveReason : undefined,
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

function buildHistoryEvent(action: LeadHistoryEvent["action"], actor: string, message: string): LeadHistoryEvent {
  return {
    id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    actor,
    action,
    message,
  };
}

function buildNoteEntry(actor: string, note: string): LeadNoteEntry {
  return {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    actor,
    note,
  };
}

function summarizeChangedFields(current: LeadDto, merged: LeadDto) {
  const labels: Record<string, string> = {
    fullName: "Client name",
    phone: "Phone",
    email: "Email",
    egn: "EGN",
    address: "Address",
    vehicleRequest: "Vehicle request",
    contractLink: "Contract link",
    handoverNote: "Handover note",
    handoverDepartment: "Department",
    stage: "Status",
    budget: "Budget",
    car: "Automobile",
    purchaseDate: "Purchase date",
    am: "Account manager",
    referral: "Referral",
    discount: "Discount",
    clientDiscount: "Client discount",
    brand: "Brand",
    model: "Model",
    engine: "Engine",
    vin: "VIN",
    payoffDate: "Payoff date",
    aftersalesWarranty: "AfterSales warranty",
    aftersalesWarrantyDate: "AfterSales warranty date",
    aftersalesWarrantyMileage: "AfterSales warranty mileage",
    showroomOwnership: "Showroom ownership",
    showroomPackage: "Showroom package",
    showroomReserved: "Reserved",
    showroomSold: "Sold",
    callbackAt: "Callback date/time",
    callbackNotes: "Callback notes",
    pickupDate: "PickUp date",
    returnToSalesComment: "Return comment",
    memoSubject: "Memo subject",
    memoContractLink: "Memo contract link",
    memoDescription: "Memo description",
    memoStatus: "Memo status",
  };

  const changed: string[] = [];
  for (const key of Object.keys(labels)) {
    const nextKey = key as keyof LeadDto;
    const before = current[nextKey];
    const after = merged[nextKey];
    const same = JSON.stringify(before) === JSON.stringify(after);
    if (!same) changed.push(labels[key]);
  }
  return changed;
}

async function ensureCrmLeadTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CrmLead" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "handoverDepartment" TEXT NOT NULL,
      "stage" TEXT NOT NULL,
      "isFamily" BOOLEAN NOT NULL DEFAULT 0,
      "lastUpdatedBy" TEXT NOT NULL DEFAULT '',
      "payload" TEXT NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CrmLead_handoverDepartment_createdAt_idx"
    ON "CrmLead"("handoverDepartment", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CrmLead_isFamily_createdAt_idx"
    ON "CrmLead"("isFamily", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CrmLead_sales_stage_idx"
    ON "CrmLead"("handoverDepartment", "isFamily", "stage")
  `);
}

async function seedLeadsIfNeeded() {
  await mkdir(dataDir, { recursive: true });
  await ensureCrmLeadTable();
}

async function ensureReady() {
  assertPersistentStore();
  if (!bootstrapPromise) {
    bootstrapPromise = hasBlobStore() ? seedBlobLeadsIfNeeded() : seedLeadsIfNeeded();
  }
  await bootstrapPromise;
}

type ListLeadOptions = {
  department?: "sales" | "account" | "logistics" | "showroom";
  includeShowroom?: boolean;
  customerType?: "new" | "existing";
  includeArchived?: boolean;
  limit?: number;
};

function applyListFilters(leads: LeadDto[], options: ListLeadOptions) {
  let filtered = options.includeArchived ? leads : leads.filter((lead) => !lead.archivedAt);

  if (options.customerType === "new") {
    filtered = filtered.filter((lead) => !lead.isFamily);
  } else if (options.customerType === "existing") {
    filtered = filtered.filter((lead) => lead.isFamily);
  }

  if (options.department) {
    filtered = filtered.filter((lead) => {
      if (options.department === "sales" && options.includeShowroom) {
        return lead.handoverDepartment === "sales" || lead.handoverDepartment === "showroom";
      }
      return lead.handoverDepartment === options.department;
    });
  }

  filtered = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (options.limit && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

async function listLeadsFromBlob(options: ListLeadOptions = {}) {
  const page = await list({ prefix: leadsBlobPrefix, limit: 5000 });
  const blobs = await Promise.all(
    page.blobs.map(async (blob) => {
      const result = await get(blob.pathname, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      try {
        return normalizeLead(JSON.parse(await streamToText(result.stream)) as LeadDto);
      } catch {
        return null;
      }
    }),
  );
  const normalized = blobs.filter((item): item is LeadDto => Boolean(item));
  return applyListFilters(normalized, options);
}

async function readLeadFromBlob(id: string) {
  const result = await get(leadBlobPath(id), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  try {
    return normalizeLead(JSON.parse(await streamToText(result.stream)) as LeadDto);
  } catch {
    return null;
  }
}

async function seedBlobLeadsIfNeeded() {
  await Promise.resolve();
}

export async function listLeads(options: ListLeadOptions = {}) {
  await ensureReady();
  if (hasBlobStore()) {
    return listLeadsFromBlob(options);
  }

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

  return applyListFilters(rows.map((row: LeadRow) => fromRow(row)), { ...options, department: undefined, customerType: undefined, includeShowroom: undefined });
}

export async function getLead(id: string) {
  await ensureReady();
  if (hasBlobStore()) return readLeadFromBlob(id);

  const row = await prisma.crmLead.findUnique({ where: { id } });
  return row ? fromRow(row) : null;
}

export async function createLead(lead: Omit<LeadDto, "id" | "createdAt"> & { createdAt?: string }) {
  await ensureReady();
  const actor = lead.lastUpdatedBy || "system";
  const created = normalizeLead({
    ...lead,
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: lead.createdAt,
  });
  created.history = [buildHistoryEvent("created", actor, "Lead created."), ...created.history];
  if (created.callbackNotes.trim()) {
    created.noteEntries = [buildNoteEntry(actor, created.callbackNotes.trim()), ...created.noteEntries];
  }

  if (hasBlobStore()) {
    await put(leadBlobPath(created.id), JSON.stringify(created, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
    });
    return created;
  }

  await prisma.crmLead.create({ data: toRow(created) });
  return created;
}

export async function updateLead(id: string, patch: Partial<Omit<LeadDto, "id">>) {
  await ensureReady();

  if (hasBlobStore()) {
    const current = await readLeadFromBlob(id);
    if (!current) return null;

    const merged = normalizeLead({
      ...current,
      ...patch,
      id,
      createdAt: patch.createdAt ?? current.createdAt,
    });

    const actor = merged.lastUpdatedBy || current.lastUpdatedBy || "system";
    if (merged.callbackNotes.trim() && merged.callbackNotes.trim() !== current.callbackNotes.trim()) {
      merged.noteEntries = [buildNoteEntry(actor, merged.callbackNotes.trim()), ...current.noteEntries];
    } else {
      merged.noteEntries = current.noteEntries;
    }

    const changedFields = summarizeChangedFields(current, merged);
    if (changedFields.length > 0) {
      const action =
        current.handoverDepartment !== merged.handoverDepartment && merged.handoverDepartment === "sales"
          ? "returned"
          : current.handoverDepartment !== merged.handoverDepartment
            ? "transferred"
            : current.memoStatus !== merged.memoStatus || current.memoSubject !== merged.memoSubject
              ? "memo"
              : "updated";
      const message =
        action === "returned"
          ? `Returned to Sales. ${merged.returnToSalesComment ? `Comment: ${merged.returnToSalesComment}` : ""}`.trim()
          : action === "transferred"
            ? `Transferred to ${merged.handoverDepartment}.`
            : action === "memo"
              ? `Memo updated: ${changedFields.join(", ")}.`
              : `Updated: ${changedFields.join(", ")}.`;
      merged.history = [buildHistoryEvent(action, actor, message), ...current.history];
    } else {
      merged.history = current.history;
    }

    await put(leadBlobPath(id), JSON.stringify(merged, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
    });

    return merged;
  }

  const row = await prisma.crmLead.findUnique({ where: { id } });
  if (!row) return null;
  const current = fromRow(row);
  const merged = normalizeLead({
    ...current,
    ...patch,
    id,
    createdAt: patch.createdAt ?? current.createdAt,
  });

  const actor = merged.lastUpdatedBy || current.lastUpdatedBy || "system";
  if (merged.callbackNotes.trim() && merged.callbackNotes.trim() !== current.callbackNotes.trim()) {
    merged.noteEntries = [buildNoteEntry(actor, merged.callbackNotes.trim()), ...current.noteEntries];
  } else {
    merged.noteEntries = current.noteEntries;
  }
  const changedFields = summarizeChangedFields(current, merged);
  if (changedFields.length > 0) {
    const action =
      current.handoverDepartment !== merged.handoverDepartment && merged.handoverDepartment === "sales"
        ? "returned"
        : current.handoverDepartment !== merged.handoverDepartment
          ? "transferred"
          : current.memoStatus !== merged.memoStatus || current.memoSubject !== merged.memoSubject
            ? "memo"
            : "updated";
    const message =
      action === "returned"
        ? `Returned to Sales. ${merged.returnToSalesComment ? `Comment: ${merged.returnToSalesComment}` : ""}`.trim()
        : action === "transferred"
          ? `Transferred to ${merged.handoverDepartment}.`
          : action === "memo"
            ? `Memo updated: ${changedFields.join(", ")}.`
            : `Updated: ${changedFields.join(", ")}.`;
    merged.history = [buildHistoryEvent(action, actor, message), ...current.history];
  } else {
    merged.history = current.history;
  }

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

export async function archiveLead(id: string, actor = "system", reason = "Deleted from CRM UI") {
  await ensureReady();
  const current = await getLead(id);
  if (!current) return null;
  if (current.archivedAt) return current;
  return updateLead(id, {
    archivedAt: new Date().toISOString(),
    archivedBy: actor,
    archiveReason: reason,
    lastUpdatedBy: actor,
  });
}

export async function deleteLead(id: string) {
  const archived = await archiveLead(id);
  return Boolean(archived);
}
