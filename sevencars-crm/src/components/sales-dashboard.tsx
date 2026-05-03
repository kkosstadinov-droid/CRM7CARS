"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type HTMLInputTypeAttribute, type ReactNode } from "react";
import type { ActivityDto } from "@/lib/activities";
import type { AppRole } from "@/lib/auth";
import { callbackStages, type ContractPackage, type LeadDocument, type LeadDto, type LeadHistoryEvent, type LeadNoteEntry, type LeadSourceInput, type LeadStage, type MemoEvent, type MemoStatus, type MemoSubject, type RegistrationStatus, type ShowroomOwnership, type ShowroomPackage, type YesNo } from "@/lib/leads";

type SearchMode = "all" | "name" | "email" | "phone";
type MemoSearchMode = "name" | "egn" | "phone" | "vin";
type AddLeadWindowKind = "sales" | "showroom" | null;
type LeadDraft = {
  fullName: string;
  phone: string;
  email: string;
  egn: string;
  address: string;
  vehicleRequest: string;
  source: LeadSourceInput;
  createdAt: string;
  contractLink: string;
  handoverNote: string;
  car: string;
  purchaseDate: string;
  am: string;
  referral: string;
  discount: string;
  clientDiscount: string;
  budget: string;
  contractPackage: ContractPackage;
  contractPrice: string;
  brand: string;
  model: string;
  engine: string;
  powerHp: string;
  vin: string;
  serviced: YesNo;
  servicedDate: string;
  secondKey: YesNo;
  secondTireSet: YesNo;
  purchaseLocation: string;
  vatKey: string;
  deliveryPrice: string;
  showroomOwnership: ShowroomOwnership;
  showroomPackage: ShowroomPackage;
  showroomContract: LeadDocument[];
  showroomReserved: YesNo;
  showroomSold: YesNo;
  showroomDescription: string;
  showroomGoPrice: string;
  showroomCascoPrice: string;
  tiresInfo: string;
  warranty: YesNo;
  firstRegistrationDate: string;
  mileage: string;
  serviceOfferDetails: string;
  inspection: YesNo;
  inspectionProtocolLink: string;
  serviceOfferLink: string;
};

const leadSourceOptions: LeadSourceInput[] = ["call", "mail", "whatsapp", "viber", "facebook", "instagram", "other"];
const stageOptions: LeadStage[] = ["New Lead", "Potential", "W/o Potential", "Need Time", "No Answer", "Message", "Contract"];
const contractPackageOptions: ContractPackage[] = ["", "Auction", "Plus", "Diamond"];
const showroomPackageOptions: ShowroomPackage[] = ["", "Basic", "Standart", "VIP"];
const memoSubjectOptions: MemoSubject[] = ["", "Buy car", "Complain"];
const yesNoOptions: YesNo[] = ["No", "Yes"];
const registrationOptions: RegistrationStatus[] = ["No", "Yes", "Yes transit"];
const detailingOptions = ["", "Пастиране", "Полиране", "Пране", "Керамика", "Комплексно", "Детайлно"];
const activityMinutes = ["00", "15", "30", "45"];
const activityHours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const next30Dates = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return formatLocalDateInput(d);
});
const leadsPerPage = 10;
const uiLocale = "bg-BG";
const uiTimeZone = "Europe/Sofia";
const requestTimeoutMs = 20000;
const dashboardPollMs = 10000;

function createEmptyLeadDraft(): LeadDraft {
  return {
    fullName: "",
    phone: "",
    email: "",
    egn: "",
    address: "",
    vehicleRequest: "",
    source: "call",
    createdAt: toLocal(new Date().toISOString()),
    contractLink: "",
    handoverNote: "",
    car: "",
    purchaseDate: "",
    am: "",
    referral: "",
    discount: "",
    clientDiscount: "",
    budget: "",
    contractPackage: "",
    contractPrice: "",
    brand: "",
    model: "",
    engine: "",
    powerHp: "",
    vin: "",
    serviced: "No",
    servicedDate: "",
    secondKey: "No",
    secondTireSet: "No",
    purchaseLocation: "",
    vatKey: "",
    deliveryPrice: "",
    showroomOwnership: "Own",
    showroomPackage: "",
    showroomContract: [],
    showroomReserved: "No",
    showroomSold: "No",
    showroomDescription: "",
    showroomGoPrice: "",
    showroomCascoPrice: "",
    tiresInfo: "",
    warranty: "No",
    firstRegistrationDate: "",
    mileage: "",
    serviceOfferDetails: "",
    inspection: "No",
    inspectionProtocolLink: "",
    serviceOfferLink: "",
  };
}

function formatLocalDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = requestTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function toLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function startsAt(date: string, hour: string, minute: string) {
  return new Date(`${date}T${hour}:${minute}:00`).toISOString();
}
function dateOnlyToIso(date: string, hour = 9, minute = 0) {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`).toISOString();
}
function addDays(dateIso: string, days: number) {
  const date = new Date(dateIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
function isCallbackStage(stage: LeadStage) {
  return callbackStages.includes(stage);
}
function makeGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const cells = Math.ceil((offset + last.getDate()) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => {
    const day = i - offset + 1;
    if (day < 1 || day > last.getDate()) return { day: null as number | null, iso: null as string | null };
    const d = new Date(date.getFullYear(), date.getMonth(), day);
    return { day, iso: formatLocalDateInput(d) };
  });
}

function normalizeShowroomYear(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 4);
}

function isClientOwnedShowroomVehicle(ownership: ShowroomOwnership) {
  return ownership === "Client";
}

function buildShowroomVehicleRequest(draft: Pick<LeadDraft, "brand" | "model" | "firstRegistrationDate">) {
  return [draft.brand.trim(), draft.model.trim(), draft.firstRegistrationDate.trim()].filter(Boolean).join(" ");
}

function showroomLeadDescription(lead: Pick<LeadDto, "addonOther"> | Pick<LeadDraft, "showroomDescription">) {
  return "addonOther" in lead ? lead.addonOther : lead.showroomDescription;
}

function showroomSortValue(lead: LeadDto) {
  if (lead.showroomSold === "Yes") return 2;
  if (lead.showroomReserved === "Yes") return 1;
  return 0;
}

function compareShowroomLeads(a: LeadDto, b: LeadDto) {
  const priority = showroomSortValue(a) - showroomSortValue(b);
  if (priority !== 0) return priority;
  return a.createdAt.localeCompare(b.createdAt);
}

function asNumber(value: string | null | undefined) {
  const normalized = String(value ?? "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
}

function formatEuroAmount(value: number, hasInput: boolean) {
  if (!hasInput) return "";
  return new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(value);
}

function formatUiDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(uiLocale, { dateStyle: "short", timeStyle: "short", timeZone: uiTimeZone }).format(date);
}

function formatUiMonth(date: Date) {
  return new Intl.DateTimeFormat(uiLocale, { month: "long", year: "numeric", timeZone: uiTimeZone }).format(date);
}

function toUiDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: uiTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeSearchValue(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function valueMatchesSelectedOption(value: string | null | undefined, filter: string) {
  const normalizedFilter = normalizeSearchValue(filter);
  if (!normalizedFilter) return true;
  return normalizeSearchValue(value) === normalizedFilter;
}

function matchesLeadSearch(lead: LeadDto, query: string, mode: SearchMode | MemoSearchMode) {
  const q = normalizeSearchValue(query);
  if (!q) return true;

  const name = normalizeSearchValue(lead.fullName);
  const email = normalizeSearchValue(lead.email);
  const phone = normalizeSearchValue(lead.phone);
  const egn = normalizeSearchValue(lead.egn);
  const vin = normalizeSearchValue(lead.vin);
  const vehicle = normalizeSearchValue(lead.vehicleRequest);

  if (mode === "name") return name.includes(q);
  if (mode === "email") return email.includes(q);
  if (mode === "phone") return phone.includes(q);
  if (mode === "egn") return egn.includes(q);
  if (mode === "vin") return vin.includes(q);

  return [name, email, phone, egn, vin, vehicle].some((value) => value.includes(q));
}

function roleDepartment(role: AppRole): "sales" | "account" | "logistics" | "all" {
  if (role === "Boss") return "all";
  if (role === "Sales") return "sales";
  if (role === "Showroom") return "sales";
  if (role === "AccountManager") return "account";
  if (role === "TeamLeadAM") return "account";
  if (role === "Logistics" || role === "Service" || role === "Insurance") return "logistics";
  if (role === "OperationManager") return "all";
  return "all";
}

function roleLabel(role: AppRole) {
  if (role === "Showroom") return "Showroom";
  if (role === "Logistics") return "After Sales";
  if (role === "Service") return "Service";
  if (role === "Insurance") return "Insurance";
  if (role === "TeamLeadAM") return "Team Lead AM";
  if (role === "OperationManager") return "Operation Manager";
  return role;
}

export function SalesDashboard({ role = "Sales", readOnlyView = false, username = "" }: { role?: AppRole; readOnlyView?: boolean; username?: string }) {
  const [pipelineFilters, setPipelineFilters] = useState<Record<string, string>>({});
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [original, setOriginal] = useState<Record<string, LeadDto>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [transferStage, setTransferStage] = useState<Record<string, LeadStage>>({});
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [leadWindowId, setLeadWindowId] = useState<string | null>(null);
  const [dayWindowDate, setDayWindowDate] = useState<string | null>(null);
  const [activityModalDate, setActivityModalDate] = useState<string | null>(null);

  const [showLeadSearch, setShowLeadSearch] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadMode, setLeadMode] = useState<SearchMode>("all");
  const [leadPage, setLeadPage] = useState(1);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientMode, setClientMode] = useState<SearchMode>("all");
  const [basicInfoOpen, setBasicInfoOpen] = useState(true);
  const [amInfoOpen, setAmInfoOpen] = useState(false);
  const [addonInfoOpen, setAddonInfoOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  const [addingLead, setAddingLead] = useState(false);
  const [draft, setDraft] = useState<LeadDraft>(createEmptyLeadDraft);

  const [month, setMonth] = useState(new Date());
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityDraft, setActivityDraft] = useState({ title: "", note: "", date: next30Dates[0], hour: "09", minute: "00" });
  const [savingActivity, setSavingActivity] = useState(false);
  const [showMemoPanel, setShowMemoPanel] = useState(false);
  const [memoSearch, setMemoSearch] = useState("");
  const [memoSearchMode, setMemoSearchMode] = useState<MemoSearchMode>("name");
  const [memoLeadId, setMemoLeadId] = useState("");
  const [memoSubject, setMemoSubject] = useState<MemoSubject>("");
  const [memoDescription, setMemoDescription] = useState("");
  const [memoReviewComment, setMemoReviewComment] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const [uploadingDocuments, setUploadingDocuments] = useState<Record<string, boolean>>({});
  const [returnComment, setReturnComment] = useState("");
  const [operationView, setOperationView] = useState<"all" | "sales" | "account" | "logistics">("all");
  const [pipelineType, setPipelineType] = useState<"new" | "existing">("new");
  const documentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadingDraftShowroomContract, setUploadingDraftShowroomContract] = useState(false);
  const [uploadingLeadShowroomContract, setUploadingLeadShowroomContract] = useState(false);
  const [addLeadWindowMode, setAddLeadWindowMode] = useState(false);
  const [addLeadWindowKind, setAddLeadWindowKind] = useState<AddLeadWindowKind>(null);
  const isShowroomRole = role === "Showroom";
  const createAsShowroomLead = addLeadWindowMode ? addLeadWindowKind === "showroom" : isShowroomRole;
  const leadsEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "5000");
    if (role === "Sales") {
      params.set("department", "sales");
    } else if (role === "Showroom") {
      params.set("department", "showroom");
    } else if (role === "AccountManager" || role === "TeamLeadAM") {
      params.set("department", "account");
    } else if (role === "Logistics" || role === "Service" || role === "Insurance") {
      params.set("department", "logistics");
    } else if (role === "OperationManager" && operationView !== "all") {
      params.set("department", operationView);
    }
    const query = params.toString();
    return query ? `/api/leads?${query}` : "/api/leads";
  }, [operationView, role]);

  const reloadDashboardData = useCallback(async () => {
    try {
      const activityParams = new URLSearchParams();
      if (username) {
        activityParams.set("ownerUsername", username.toLowerCase());
      }
      const activitiesEndpoint = activityParams.toString() ? `/api/activities?${activityParams.toString()}` : "/api/activities";
      const [lr, ar] = await Promise.all([fetchWithTimeout(leadsEndpoint, { cache: "no-store" }), fetchWithTimeout(activitiesEndpoint, { cache: "no-store" })]);
      if (!lr.ok || !ar.ok) throw new Error();
      const ls = (await lr.json()) as LeadDto[];
      const as = (await ar.json()) as ActivityDto[];
      ls.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      as.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      setLeads(ls);
      setActivities(as);
      setOriginal(Object.fromEntries(ls.map((x) => [x.id, x])));
      setTransferStage(Object.fromEntries(ls.map((x) => [x.id, x.stage])));
      setError("");
    } catch {
      setError("Failed to load leads or activities.");
    } finally {
      setLoading(false);
    }
  }, [leadsEndpoint, username]);

  useEffect(() => {
    if (leadWindowId || showMemoPanel || memoLeadId) return;
    setLoading(true);
    const initial = setTimeout(() => void reloadDashboardData(), 0);
    const timer = setInterval(() => void reloadDashboardData(), dashboardPollMs);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [reloadDashboardData, leadWindowId, memoLeadId, showMemoPanel]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if ((role !== "Sales" && !isShowroomRole) || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const profile = params.get("profile");
    const showroomAddLead = params.get("showroomAddLead") === "1";
    const addLeadInWindow = params.get("addLead") === "1" || showroomAddLead;
    setAddLeadWindowMode(addLeadInWindow);
    setAddLeadWindowKind(addLeadInWindow ? (showroomAddLead || profile === "Showroom" ? "showroom" : "sales") : null);
    if (addLeadInWindow) {
      setAddingLead(true);
    }
  }, [isShowroomRole, role]);

  useEffect(() => {
    if (typeof window === "undefined" || addLeadWindowMode) return;

    function handlePopupMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "sevencars:add-lead-saved") return;
      void reloadDashboardData();
    }

    window.addEventListener("message", handlePopupMessage);
    return () => window.removeEventListener("message", handlePopupMessage);
  }, [addLeadWindowMode, reloadDashboardData]);

  useEffect(() => {
    if (!leadWindowId) return;
    setBasicInfoOpen(true);
    setAmInfoOpen(role === "AccountManager");
    setAddonInfoOpen(false);
    setHistoryOpen(true);
    setReturnComment("");
  }, [leadWindowId, role]);

  useEffect(() => {
    if (!memoLeadId) {
      setMemoSubject("");
      setMemoDescription("");
      return;
    }
    const selected = leads.find((l) => l.id === memoLeadId);
    if (!selected) return;
    setMemoSubject(selected.memoSubject);
    setMemoDescription(selected.memoDescription);
  }, [memoLeadId, leads]);

  const visibleByRole = useMemo(() => {
    const familyFiltered = leads.filter((lead) => (pipelineType === "existing" ? lead.isFamily : !lead.isFamily));
    if (role === "Showroom") {
      return familyFiltered.filter((lead) => lead.handoverDepartment === "showroom");
    }
    if (role === "OperationManager") {
      if (operationView === "all") return familyFiltered;
      return familyFiltered.filter((lead) => lead.handoverDepartment === operationView);
    }
    const dep = roleDepartment(role);
    if (dep === "all") return familyFiltered;
    return familyFiltered.filter((lead) => lead.handoverDepartment === dep);
  }, [leads, operationView, pipelineType, role]);

  const filteredLeads = useMemo(() => {
    const all = [...visibleByRole].sort((a, b) => {
      if (isShowroomRole) {
        return compareShowroomLeads(a, b);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
    return all
      .filter((lead) => matchesLeadSearch(lead, leadSearch, leadMode))
      .filter((lead) => {
        if (isShowroomRole) {
          return true;
        }

        if (pipelineType === "existing") {
          return valueMatchesSelectedOption(lead.stage, pipelineFilters.status);
        }

        return (
          valueMatchesSelectedOption(lead.stage, pipelineFilters.status) &&
          valueMatchesSelectedOption(lead.lastUpdatedBy, pipelineFilters.user)
        );
      });
  }, [visibleByRole, leadSearch, leadMode, isShowroomRole, pipelineFilters, pipelineType]);
  const totalLeadPages = Math.max(1, Math.ceil(filteredLeads.length / leadsPerPage));
  const paginatedLeads = useMemo(() => {
    const start = (leadPage - 1) * leadsPerPage;
    return filteredLeads.slice(start, start + leadsPerPage);
  }, [filteredLeads, leadPage]);

  useEffect(() => {
    setLeadPage(1);
  }, [leadSearch, leadMode, operationView, pipelineType, role, pipelineFilters]);
  useEffect(() => {
    if (leadPage > totalLeadPages) setLeadPage(totalLeadPages);
  }, [leadPage, totalLeadPages]);

  function goToLeadPage(next: number) {
    if (!Number.isFinite(next)) return;
    const page = Math.min(totalLeadPages, Math.max(1, Math.trunc(next)));
    setLeadPage(page);
  }

  const leadWindow = useMemo(() => leads.find((l) => l.id === leadWindowId) ?? null, [leads, leadWindowId]);
  const effectiveLeadStage = leadWindow ? transferStage[leadWindow.id] ?? leadWindow.stage : null;
  const stageOptionsByRole = stageOptions;
  const pipelineStatusFilterOptions = useMemo(() => ["", ...stageOptions], []);
  const pipelineUserFilterOptions = useMemo(
    () => ["", ...Array.from(new Set(visibleByRole.map((lead) => lead.lastUpdatedBy).filter(Boolean))).sort((a, b) => a.localeCompare(b))],
    [visibleByRole],
  );
  const sectionedView = true;
  const canShowAmInfo = role !== "Sales";
  const canShowAddOnInfo = role !== "Sales" && role !== "Showroom" && role !== "AccountManager" && role !== "TeamLeadAM";
  const canShowLeadHistory = role !== "Sales" && role !== "AccountManager";
  const basicInfoReadOnly = false;
  const amInfoReadOnly = false;
  const stageReadOnly = readOnlyView || (role !== "Sales" && role !== "AccountManager" && role !== "Admin");
  const showroomInfoReadOnly = false;
  const canSeeMemoTrace = role === "AccountManager" || role === "TeamLeadAM" || role === "OperationManager" || role === "Boss" || role === "Admin";
  const canEditAddOnField = (field: "serviceOffer" | "serviceOfferLink" | "inspectionProtocolLink" | "other") => {
    void field;
    return true;
  };
  const dashboardReadOnly = false;
  const isProcessedLead = useCallback((lead: LeadDto) => {
    return (
      lead.stage !== "New Lead" ||
      !!lead.transferredToAccountAt ||
      !!lead.transferredToLogisticsAt ||
      !!lead.operationApprovedAt ||
      !!lead.memoAccountSubmittedAt ||
      !!lead.memoTeamLeadDecisionAt ||
      !!lead.memoOperationDecisionAt ||
      !!lead.serviceOfferUploadedAt ||
      !!lead.inspectionProtocolUploadedAt ||
      !!lead.insuranceTouchedAt ||
      !!lead.serviceTouchedAt
    );
  }, []);

  const roleClients = useMemo(() => {
    const processed = leads.filter((lead) => isProcessedLead(lead) && lead.lastUpdatedBy === username);
    if (role === "AccountManager" || role === "TeamLeadAM") {
      return processed
        .filter((l) => l.handoverDepartment === "account" || !!l.transferredToAccountAt)
        .map((l) => ({
          name: l.fullName,
          phone: l.phone,
          email: l.email,
          requested: l.vehicleRequest,
        }));
    }
    if (role === "Logistics" || role === "Service" || role === "Insurance") {
      return processed
        .filter((l) => l.handoverDepartment === "logistics" || !!l.transferredToLogisticsAt)
        .map((l) => ({
          name: l.fullName,
          phone: l.phone,
          email: l.email,
          requested: l.vehicleRequest,
        }));
    }
    if (role === "OperationManager") {
      return processed.map((l) => ({
        name: l.fullName,
        phone: l.phone,
        email: l.email,
        requested: l.vehicleRequest,
      }));
    }
    if (role === "Showroom") {
      return processed
        .filter((l) => l.handoverDepartment === "showroom")
        .map((l) => ({
          name: l.fullName,
          phone: l.phone,
          email: l.email,
          requested: l.vehicleRequest,
        }));
    }
    return processed
      .filter((l) => l.handoverDepartment === "sales" || !!l.transferredToAccountAt || !!l.transferredToLogisticsAt)
      .map((l) => ({
        name: l.fullName,
        phone: l.phone,
        email: l.email,
        requested: l.vehicleRequest,
      }));
  }, [isProcessedLead, leads, role, username]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return roleClients;
    return roleClients.filter((c) => {
      const n = c.name.toLowerCase().includes(q);
      const e = c.email.toLowerCase().includes(q);
      const p = c.phone.toLowerCase().includes(q);
      if (clientMode === "name") return n;
      if (clientMode === "email") return e;
      if (clientMode === "phone") return p;
      return n || e || p;
    });
  }, [clientSearch, clientMode, roleClients]);

  const filterMemoSource = useCallback((items: LeadDto[]) => {
    return items.filter((lead) => matchesLeadSearch(lead, memoSearch, memoSearchMode));
  }, [memoSearch, memoSearchMode]);
  const accountPipelineLeads = useMemo(
    () => filterMemoSource(leads.filter((l) => l.handoverDepartment === "account").sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    [filterMemoSource, leads],
  );
  const selectedMemoLead = useMemo(() => leads.find((l) => l.id === memoLeadId) ?? null, [leads, memoLeadId]);
  const teamLeadQueue = useMemo(
    () => filterMemoSource(leads.filter((l) => l.memoStatus === "pending_teamlead").sort((a, b) => b.memoAccountSubmittedAt.localeCompare(a.memoAccountSubmittedAt))),
    [filterMemoSource, leads],
  );
  const operationQueue = useMemo(
    () => filterMemoSource(leads.filter((l) => l.memoStatus === "pending_operation").sort((a, b) => b.memoTeamLeadDecisionAt.localeCompare(a.memoTeamLeadDecisionAt))),
    [filterMemoSource, leads],
  );
  const accountReturnedMemos = useMemo(
    () => leads.filter((l) => l.handoverDepartment === "account" && (l.memoStatus === "rejected_by_teamlead" || l.memoStatus === "rejected_by_operation")),
    [leads],
  );
  const accountApprovedMemos = useMemo(() => leads.filter((l) => l.handoverDepartment === "account" && l.memoStatus === "approved"), [leads]);

  const roleActivityDept = roleDepartment(role) === "all" ? null : roleDepartment(role);
  const futureActivities = useMemo(() => {
    const todayKey = toUiDateKey(new Date());
    return activities
      .filter((a) => a.status === "planned" && toUiDateKey(a.startsAt) >= todayKey)
      .filter((a) => (roleActivityDept ? a.department === roleActivityDept : true))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [activities, roleActivityDept]);
  const dayActivities = useMemo(() => futureActivities.filter((a) => toUiDateKey(a.startsAt) === dayWindowDate), [futureActivities, dayWindowDate]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of futureActivities) {
      const key = toUiDateKey(a.startsAt);
      m[key] = (m[key] ?? 0) + 1;
    }
    return m;
  }, [futureActivities]);
  const cells = useMemo(() => makeGrid(month), [month]);

  const triggerFastRefresh = useCallback(() => {
    void reloadDashboardData();
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      void reloadDashboardData();
    }, 1500);
  }, [reloadDashboardData]);

  const uploadDocuments = useCallback(async (files: File[], leadId: string) => {
    const uploaded: LeadDocument[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("leadId", leadId);
      const response = await fetchWithTimeout("/api/lead-documents", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("upload_failed");
      }
      uploaded.push((await response.json()) as LeadDocument);
    }
    return uploaded;
  }, []);

  const uploadDraftShowroomContract = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setUploadingDraftShowroomContract(true);
    setError("");
    try {
      const uploaded = await uploadDocuments(files, "showroom-draft");
      setDraft((current) => ({ ...current, showroomContract: [...current.showroomContract, ...uploaded] }));
    } catch {
      setError("Failed to upload showroom contract.");
    } finally {
      setUploadingDraftShowroomContract(false);
    }
  }, [uploadDocuments]);

  const uploadLeadShowroomContract = useCallback(async (leadId: string, files: File[]) => {
    if (files.length === 0) return;
    setUploadingLeadShowroomContract(true);
    setError("");
    try {
      const uploaded = await uploadDocuments(files, leadId);
      const lead = leads.find((item) => item.id === leadId);
      if (!lead) return;
      const updatedContract = [...lead.showroomContract, ...uploaded];
      patchLead(leadId, { showroomContract: updatedContract });
      const response = await fetchWithTimeout(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showroomContract: updatedContract, lastUpdatedBy: username }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      const updatedLead = (await response.json()) as LeadDto;
      setLeads((current) => current.map((item) => (item.id === updatedLead.id ? updatedLead : item)));
      setOriginal((current) => ({ ...current, [updatedLead.id]: updatedLead }));
    } catch {
      setError("Failed to upload showroom contract.");
    } finally {
      setUploadingLeadShowroomContract(false);
    }
  }, [leads, uploadDocuments, username]);

  async function createLead() {
    if (dashboardReadOnly) return;
    const showroomVehicleRequest = buildShowroomVehicleRequest(draft);
    const payloadVehicleRequest = createAsShowroomLead ? showroomVehicleRequest : draft.vehicleRequest.trim();
    if (!draft.fullName.trim() || !draft.phone.trim() || !payloadVehicleRequest) return setError("Full name, phone and vehicle request are required.");
    if (createAsShowroomLead && !/^\d{4}$/.test(draft.firstRegistrationDate.trim())) return setError("Showroom year must be exactly 4 digits (YYYY).");
    setError("");
    try {
      const r = await fetchWithTimeout("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          vehicleRequest: payloadVehicleRequest,
          createdAt: draft.createdAt ? new Date(draft.createdAt).toISOString() : new Date().toISOString(),
          handoverDepartment: createAsShowroomLead ? "showroom" : "sales",
          lastUpdatedBy: username,
          addonOther: createAsShowroomLead ? draft.showroomDescription : draft.handoverNote,
          insuranceGoPrice: createAsShowroomLead ? draft.showroomGoPrice : "",
          insuranceCascoPrice: createAsShowroomLead ? draft.showroomCascoPrice : "",
          showroomContract: draft.showroomContract,
        }),
      });
      if (!r.ok) return setError("Failed to create lead.");
      const created = (await r.json()) as LeadDto;
      setLeads((p) => [...p, created].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setOriginal((p) => ({ ...p, [created.id]: created }));
      setTransferStage((p) => ({ ...p, [created.id]: created.stage }));
      setLeadWindowId(created.id);
      setAddingLead(false);
      triggerFastRefresh();
      setDraft(createEmptyLeadDraft());
      if (addLeadWindowMode && typeof window !== "undefined" && window.opener) {
        window.opener.postMessage({ type: "sevencars:add-lead-saved", leadId: created.id }, window.location.origin);
        window.close();
      }
    } catch {
      setError("Failed to create lead.");
    }
  }

  function patchLead(id: string, patch: Partial<LeadDto>) {
    setLeads((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function syncCallbackActivity(lead: LeadDto) {
    if (!isCallbackStage(lead.stage) || !lead.callbackAt) {
      if (lead.callbackActivityId) {
        try {
          const response = await fetchWithTimeout(`/api/activities/${lead.callbackActivityId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "done" }),
          });
          if (response.ok) {
            const updatedActivity = (await response.json()) as ActivityDto;
            setActivities((current) => current.map((item) => (item.id === updatedActivity.id ? updatedActivity : item)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
          }
          const leadResponse = await fetchWithTimeout(`/api/leads/${lead.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callbackActivityId: "", lastUpdatedBy: username }),
          });
          if (leadResponse.ok) {
            return (await leadResponse.json()) as LeadDto;
          }
        } catch {
          // Keep the lead save successful even if activity sync fails.
        }
      }
      return lead;
    }
    const payload = {
      title: `Callback: ${lead.fullName}`,
      note: lead.callbackNotes,
      startsAt: lead.callbackAt,
      department: lead.handoverDepartment === "account" ? "account" : lead.handoverDepartment === "logistics" ? "logistics" : "sales",
      ownerUsername: username.toLowerCase(),
    } as const;
    try {
      if (lead.callbackActivityId) {
        const response = await fetchWithTimeout(`/api/activities/${lead.callbackActivityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, status: "planned" }),
        });
        if (response.ok) {
          const updatedActivity = (await response.json()) as ActivityDto;
          setActivities((current) => current.map((item) => (item.id === updatedActivity.id ? updatedActivity : item)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
          return lead;
        }
      }

      const response = await fetchWithTimeout("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return lead;
      const createdActivity = (await response.json()) as ActivityDto;
      setActivities((current) => [...current, createdActivity].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));

      const leadResponse = await fetchWithTimeout(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackActivityId: createdActivity.id, lastUpdatedBy: username }),
      });
      if (!leadResponse.ok) return lead;
      return (await leadResponse.json()) as LeadDto;
    } catch {
      return lead;
    }
  }

  async function syncScheduledActivity(lead: LeadDto, options: {
    startsAt: string;
    activityId: string;
    title: string;
    note: string;
    department: ActivityDto["department"];
    activityIdField: "pickupActivityId" | "familyFollowUpActivityId";
  }) {
    if (!options.startsAt) {
      if (options.activityId) {
        try {
          const response = await fetchWithTimeout(`/api/activities/${options.activityId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "done" }),
          });
          if (response.ok) {
            const updatedActivity = (await response.json()) as ActivityDto;
            setActivities((current) => current.map((item) => (item.id === updatedActivity.id ? updatedActivity : item)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
          }
          const leadResponse = await fetchWithTimeout(`/api/leads/${lead.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [options.activityIdField]: "", lastUpdatedBy: username }),
          });
          if (leadResponse.ok) {
            return (await leadResponse.json()) as LeadDto;
          }
        } catch {
          // Keep lead save flow successful even if calendar sync fails.
        }
      }
      return lead;
    }

    const payload = {
      title: options.title,
      note: options.note,
      startsAt: options.startsAt,
      department: options.department,
      ownerUsername: username.toLowerCase(),
    } as const;

    try {
      if (options.activityId) {
        const response = await fetchWithTimeout(`/api/activities/${options.activityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, status: "planned" }),
        });
        if (response.ok) {
          const updatedActivity = (await response.json()) as ActivityDto;
          setActivities((current) => current.map((item) => (item.id === updatedActivity.id ? updatedActivity : item)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
          return lead;
        }
      }

      const response = await fetchWithTimeout("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return lead;
      const createdActivity = (await response.json()) as ActivityDto;
      setActivities((current) => [...current, createdActivity].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));

      const leadResponse = await fetchWithTimeout(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [options.activityIdField]: createdActivity.id, lastUpdatedBy: username }),
      });
      if (!leadResponse.ok) return lead;
      return (await leadResponse.json()) as LeadDto;
    } catch {
      return lead;
    }
  }

  async function saveLead(id: string) {
    if (dashboardReadOnly) return;
    const lead = leads.find((x) => x.id === id);
    const prev = original[id];
    if (!lead) return;
    if (lead.handoverDepartment === "showroom") {
      const showroomYear = lead.firstRegistrationDate.trim();
      if (!/^\d{4}$/.test(showroomYear)) {
        setError("Showroom year must be exactly 4 digits (YYYY).");
        return;
      }
    }
    if (isCallbackStage(transferStage[id] ?? lead.stage) && !lead.callbackAt) {
      setError("Callback date and time are required for this status.");
      return;
    }
    const payload: LeadDto = { ...lead, stage: transferStage[id] ?? lead.stage, lastUpdatedBy: username };
    if (payload.aftersalesWarranty !== "Yes") {
      payload.aftersalesWarrantyDate = "";
      payload.aftersalesWarrantyMileage = "";
    }
    const now = new Date().toISOString();
    if (prev) {
      if (payload.serviceOfferLink.trim() && !prev.serviceOfferLink.trim()) {
        payload.serviceOfferUploadedAt = now;
        payload.serviceTouchedAt = now;
      }
      if (payload.inspectionProtocolLink.trim() && !prev.inspectionProtocolLink.trim()) {
        payload.inspectionProtocolUploadedAt = now;
        payload.serviceTouchedAt = now;
      }
      const insuranceChanged =
        payload.insuranceInfo !== prev.insuranceInfo ||
        payload.insuranceGoPrice !== prev.insuranceGoPrice ||
        payload.insuranceCascoPrice !== prev.insuranceCascoPrice ||
        payload.insuranceAccepted !== prev.insuranceAccepted ||
        payload.registrationInfo !== prev.registrationInfo ||
        payload.registrationAccepted !== prev.registrationAccepted ||
        payload.registrationStatus !== prev.registrationStatus ||
        payload.cascoPhotos !== prev.cascoPhotos;
      if (insuranceChanged) {
        payload.insuranceTouchedAt = now;
      }
      const serviceChanged =
        payload.serviceOfferDetails !== prev.serviceOfferDetails ||
        payload.serviceOfferAccepted !== prev.serviceOfferAccepted ||
        payload.serviceOfferLink !== prev.serviceOfferLink ||
        payload.inspectionProtocolLink !== prev.inspectionProtocolLink ||
        payload.inspection !== prev.inspection ||
        payload.serviceCostPrice !== prev.serviceCostPrice ||
        payload.servicePrice !== prev.servicePrice ||
        payload.detailing !== prev.detailing ||
        payload.detailingInfo !== prev.detailingInfo ||
        payload.detailingAccepted !== prev.detailingAccepted ||
        payload.detailingPrice !== prev.detailingPrice ||
        payload.tiresInfo !== prev.tiresInfo ||
        payload.wheelsInfo !== prev.wheelsInfo ||
        payload.tiresAccepted !== prev.tiresAccepted ||
        payload.tiresCostPrice !== prev.tiresCostPrice ||
        payload.tiresPrice !== prev.tiresPrice ||
        payload.addonOther !== prev.addonOther;
      if (serviceChanged) {
        payload.serviceTouchedAt = now;
      }
    }
    setSaving((p) => ({ ...p, [id]: true }));
    try {
      const r = await fetchWithTimeout(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (r.ok) {
        let updated = (await r.json()) as LeadDto;
        updated = await syncCallbackActivity(updated);
        updated = await syncScheduledActivity(updated, {
          startsAt: updated.pickupDate ? dateOnlyToIso(updated.pickupDate, 9, 0) : "",
          activityId: updated.pickupActivityId,
          title: `PickUp: ${updated.fullName}`,
          note: `${updated.fullName} | ${updated.phone}${updated.vehicleRequest ? ` | ${updated.vehicleRequest}` : ""}`,
          department: "account",
          activityIdField: "pickupActivityId",
        });
        setLeads((p) => p.map((x) => (x.id === id ? updated : x)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setOriginal((p) => ({ ...p, [id]: updated }));
        setTransferStage((p) => ({ ...p, [id]: updated.stage }));
      } else setError("Failed to save lead changes.");
    } catch {
      setError("Failed to save lead changes.");
    } finally {
      setSaving((p) => ({ ...p, [id]: false }));
    }
  }

  function cancelLead(id: string) {
    const o = original[id];
    if (!o) return;
    setLeads((p) => p.map((x) => (x.id === id ? o : x)));
    setTransferStage((p) => ({ ...p, [id]: o.stage }));
  }

  async function removeLead(id: string) {
    if (dashboardReadOnly) return;
    setSaving((p) => ({ ...p, [id]: true }));
    try {
      const r = await fetchWithTimeout(`/api/leads/${id}`, { method: "DELETE" });
      if (r.ok) {
        setLeads((p) => p.filter((x) => x.id !== id));
        setLeadWindowId((p) => (p === id ? null : p));
      } else {
        setError("Failed to delete lead.");
      }
    } catch {
      setError("Failed to delete lead.");
    } finally {
      setSaving((p) => ({ ...p, [id]: false }));
    }
  }

  async function doTransfer(id: string, department: "account" | "logistics") {
    if (dashboardReadOnly) return;
    const lead = leads.find((x) => x.id === id);
    if (!lead) return;
    setSaving((p) => ({ ...p, [id]: true }));
    const now = new Date().toISOString();
    try {
      const r = await fetchWithTimeout(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lead,
          handoverDepartment: department,
          lastUpdatedBy: username,
          transferredToAccountAt: department === "account" ? now : lead.transferredToAccountAt,
          transferredToLogisticsAt: department === "logistics" ? now : lead.transferredToLogisticsAt,
        }),
      });
      if (r.ok) {
        let updated = (await r.json()) as LeadDto;
        updated = await syncScheduledActivity(updated, {
          startsAt: department === "logistics" && (updated.isFamily || !!updated.familyAt) ? addDays(updated.familyAt || now, 14) : "",
          activityId: updated.familyFollowUpActivityId,
          title: `Existing Lead Follow-up: ${updated.fullName}`,
          note: `${updated.fullName} | ${updated.phone}${updated.email ? ` | ${updated.email}` : ""}${updated.vehicleRequest ? ` | ${updated.vehicleRequest}` : ""}`,
          department: "logistics",
          activityIdField: "familyFollowUpActivityId",
        });
        setLeads((p) => p.map((x) => (x.id === id ? updated : x)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setOriginal((p) => ({ ...p, [id]: updated }));
        setTransferStage((p) => ({ ...p, [id]: updated.stage }));
      } else {
        setError("Failed to transfer lead.");
      }
    } catch {
      setError("Failed to transfer lead.");
    } finally {
      setSaving((p) => ({ ...p, [id]: false }));
      if (role === "Sales") {
        setLeadWindowId(null);
      }
    }
  }

  async function returnToSales(id: string) {
    if (dashboardReadOnly) return;
    const lead = leads.find((x) => x.id === id);
    if (!lead) return;
    if (!returnComment.trim()) {
      setError("Return to Sales comment is required.");
      return;
    }
    setSaving((p) => ({ ...p, [id]: true }));
    try {
      const r = await fetchWithTimeout(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lead, handoverDepartment: "sales", returnToSalesComment: returnComment.trim(), lastUpdatedBy: username }),
      });
      if (r.ok) {
        const updated = (await r.json()) as LeadDto;
        setLeads((p) => p.map((x) => (x.id === id ? updated : x)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setOriginal((p) => ({ ...p, [id]: updated }));
        setTransferStage((p) => ({ ...p, [id]: updated.stage }));
        setReturnComment("");
        setLeadWindowId(null);
      } else {
        setError("Failed to return lead to Sales.");
      }
    } catch {
      setError("Failed to return lead to Sales.");
    } finally {
      setSaving((p) => ({ ...p, [id]: false }));
    }
  }

  async function addToFamily(id: string) {
    if (dashboardReadOnly) return;
    const lead = leads.find((x) => x.id === id);
    if (!lead) return;
    setSaving((p) => ({ ...p, [id]: true }));
    const now = new Date().toISOString();
    try {
      const r = await fetchWithTimeout(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lead,
          isFamily: true,
          familyAt: now,
          lastUpdatedBy: username,
        }),
      });
      if (r.ok) {
        let updated = (await r.json()) as LeadDto;
        updated = await syncScheduledActivity(updated, {
          startsAt: addDays(updated.familyAt || now, 14),
          activityId: updated.familyFollowUpActivityId,
          title: `Existing Lead Follow-up: ${updated.fullName}`,
          note: `${updated.fullName} | ${updated.phone}${updated.email ? ` | ${updated.email}` : ""}${updated.vehicleRequest ? ` | ${updated.vehicleRequest}` : ""}`,
          department: "logistics",
          activityIdField: "familyFollowUpActivityId",
        });
        setLeads((p) => p.map((x) => (x.id === id ? updated : x)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setOriginal((p) => ({ ...p, [id]: updated }));
        setTransferStage((p) => ({ ...p, [id]: updated.stage }));
        setLeadWindowId(null);
      } else {
        setError("Failed to add lead to Family.");
      }
    } catch {
      setError("Failed to add lead to Family.");
    } finally {
      setSaving((p) => ({ ...p, [id]: false }));
    }
  }

  function exportBasicAmPdf(lead: LeadDto) {
    const yearFromFirstRegistration = lead.firstRegistrationDate ? new Date(lead.firstRegistrationDate).getFullYear() : NaN;
    const yearFromRequest = (lead.vehicleRequest.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? "";
    const year = Number.isFinite(yearFromFirstRegistration) ? String(yearFromFirstRegistration) : yearFromRequest;
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    const rows = [
      ["Client Name", lead.fullName],
      ["EGN", lead.egn],
      ["Phone", lead.phone],
      ["Email", lead.email],
      ["VIN", lead.vin],
      ["Brand", lead.brand],
      ["Model", lead.model],
      ["Year", year],
      ["Second Key", lead.secondKey],
      ["Keyless Start", lead.keylessStart],
      ["Weight", lead.weight],
      ["Color", lead.color],
      ["Power kW", lead.powerKw],
      ["Power hp", lead.powerHp],
      ["Seats Count", lead.seatsCount],
      ["Doors Count", lead.doorsCount],
    ]
      .map(([k, v]) => `<tr><td style="padding:6px;border:1px solid #ccc;font-weight:600">${k}</td><td style="padding:6px;border:1px solid #ccc">${String(v ?? "")}</td></tr>`)
      .join("");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Lead Export</title></head><body><h2>7CARS Lead Export</h2><table style="border-collapse:collapse;width:100%">${rows}</table></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  async function createActivity() {
    if (dashboardReadOnly) return;
    if (!activityDraft.title.trim()) return setError("Activity title is required.");
    setSavingActivity(true);
    try {
      const r = await fetchWithTimeout("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: activityDraft.title,
          note: activityDraft.note,
          startsAt: startsAt(activityDraft.date, activityDraft.hour, activityDraft.minute),
          department: roleDepartment(role) === "all" ? "sales" : roleDepartment(role),
          ownerUsername: username.toLowerCase(),
        }),
      });
      if (r.ok) {
        const created = (await r.json()) as ActivityDto;
        setActivities((p) => [...p, created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
        setActivityDraft({ title: "", note: "", date: next30Dates[0], hour: "09", minute: "00" });
        setShowActivityForm(false);
        setActivityModalDate(null);
      } else setError("Failed to create activity.");
    } catch {
      setError("Failed to create activity.");
    } finally {
      setSavingActivity(false);
    }
  }

  async function markDone(id: string) {
    if (dashboardReadOnly) return;
    try {
      const r = await fetchWithTimeout(`/api/activities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) });
      if (!r.ok) return;
      const updated = (await r.json()) as ActivityDto;
      setActivities((p) => p.map((x) => (x.id === id ? updated : x)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    } catch {
      setError("Failed to update activity.");
    }
  }
  async function removeActivity(id: string) {
    if (dashboardReadOnly) return;
    try {
      const r = await fetchWithTimeout(`/api/activities/${id}`, { method: "DELETE" });
      if (r.ok) setActivities((p) => p.filter((x) => x.id !== id));
      else setError("Failed to delete activity.");
    } catch {
      setError("Failed to delete activity.");
    }
  }

  async function uploadLeadDocuments(leadId: string, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploadingDocuments((current) => ({ ...current, [leadId]: true }));
    try {
      const lead = leads.find((item) => item.id === leadId);
      if (!lead) return;

      const uploadedDocuments: LeadDocument[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("leadId", leadId);

        const response = await fetchWithTimeout("/api/lead-documents", {
          method: "POST",
          body: formData,
        }, 60000);

        if (!response.ok) {
          setError("Failed to upload document.");
          return;
        }
        uploadedDocuments.push((await response.json()) as LeadDocument);
      }

      const updated = await patchLeadRemote(leadId, {
        accountDocuments: [...(lead.accountDocuments ?? []), ...uploadedDocuments],
      });
      if (updated) {
        setLeadWindowId(updated.id);
      }
    } catch {
      setError("Failed to upload document.");
    } finally {
      event.target.value = "";
      setUploadingDocuments((current) => ({ ...current, [leadId]: false }));
    }
  }

  async function patchLeadRemote(id: string, patch: Partial<LeadDto>) {
    setMemoSaving(true);
    try {
      const r = await fetchWithTimeout(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...patch, lastUpdatedBy: username }) });
      if (!r.ok) {
        setError("Failed to update memo.");
        return null;
      }
      const updated = (await r.json()) as LeadDto;
      setLeads((p) => p.map((x) => (x.id === id ? updated : x)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setOriginal((p) => ({ ...p, [id]: updated }));
      triggerFastRefresh();
      return updated;
    } catch {
      setError("Failed to update memo.");
      return null;
    } finally {
      setMemoSaving(false);
    }
  }

  function buildMemoEvent(input: {
    actorRole: MemoEvent["actorRole"];
    action: MemoEvent["action"];
    fromStatus: MemoStatus;
    toStatus: MemoStatus;
    comment: string;
  }): MemoEvent {
    return {
      id: `memo_event_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      actorRole: input.actorRole,
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      comment: input.comment,
    };
  }

  async function submitMemoToTeamLead() {
    if (!selectedMemoLead) return;
    if (!memoSubject) {
      setError("Memo subject is required.");
      return;
    }
    if (!memoDescription.trim()) {
      setError("Description is required.");
      return;
    }
    const updated = await patchLeadRemote(selectedMemoLead.id, {
      memoSubject,
      memoContractLink: "",
      memoDescription: memoDescription.trim(),
      memoStatus: "pending_teamlead",
      memoAccountSubmittedAt: new Date().toISOString(),
      memoTeamLeadComment: "",
      memoTeamLeadDecisionAt: "",
      memoOperationComment: "",
      memoOperationDecisionAt: "",
      memoEvents: [
        ...(selectedMemoLead.memoEvents ?? []),
        buildMemoEvent({
          actorRole: "AccountManager",
          action: "submitted",
          fromStatus: selectedMemoLead.memoStatus,
          toStatus: "pending_teamlead",
          comment: memoDescription.trim(),
        }),
      ],
    });
    if (updated) {
      setMemoLeadId(updated.id);
      setMemoReviewComment("");
    }
  }

  async function teamLeadReview(status: MemoStatus) {
    if (!selectedMemoLead) return;
    if (!memoReviewComment.trim()) {
      setError("Comment is required.");
      return;
    }
    const isRejected = status === "rejected_by_teamlead";
    await patchLeadRemote(selectedMemoLead.id, {
      memoStatus: isRejected ? "rejected_by_teamlead" : "pending_operation",
      memoTeamLeadComment: memoReviewComment.trim(),
      memoTeamLeadDecisionAt: new Date().toISOString(),
      memoEvents: [
        ...(selectedMemoLead.memoEvents ?? []),
        buildMemoEvent({
          actorRole: "TeamLeadAM",
          action: isRejected ? "rejected" : "approved",
          fromStatus: selectedMemoLead.memoStatus,
          toStatus: isRejected ? "rejected_by_teamlead" : "pending_operation",
          comment: memoReviewComment.trim(),
        }),
      ],
    });
    setMemoReviewComment("");
  }

  async function operationReview(status: MemoStatus) {
    if (!selectedMemoLead) return;
    if (!memoReviewComment.trim()) {
      setError("Comment is required.");
      return;
    }
    const isRejected = status === "rejected_by_operation";
    await patchLeadRemote(selectedMemoLead.id, {
      memoStatus: isRejected ? "rejected_by_operation" : "approved",
      memoOperationComment: memoReviewComment.trim(),
      memoOperationDecisionAt: new Date().toISOString(),
      operationApprovedAt: isRejected ? selectedMemoLead.operationApprovedAt : new Date().toISOString(),
      memoEvents: [
        ...(selectedMemoLead.memoEvents ?? []),
        buildMemoEvent({
          actorRole: "OperationManager",
          action: isRejected ? "rejected" : "approved",
          fromStatus: selectedMemoLead.memoStatus,
          toStatus: isRejected ? "rejected_by_operation" : "approved",
          comment: memoReviewComment.trim(),
        }),
      ],
    });
    setMemoReviewComment("");
  }

  const cards = [
    { title: "Active Leads", value: visibleByRole.filter((l) => l.stage !== "Message" && l.stage !== "Contract").length },
    { title: "New Arrivals", value: visibleByRole.filter((l) => l.stage === "New Lead").length },
    { title: "Active Deals", value: visibleByRole.filter((l) => l.stage !== "New Lead").length },
    { title: "Contact This Month", value: visibleByRole.filter((l) => l.stage !== "New Lead").length },
    { title: "Vehicles In Account", value: visibleByRole.filter((l) => l.stage === "Potential").length },
  ];

  if (addLeadWindowMode) {
    const addLeadWindowIsShowroom = addLeadWindowKind === "showroom";
    return (
      <section className="mx-auto max-w-5xl">
        <section className="module-shell">
          <div className="module-header">
            <h2 className="module-title">{addLeadWindowIsShowroom ? "Showroom Add Lead" : "Sales Add Lead"}</h2>
          </div>
          <div className="module-body">
            {error ? <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
            <LeadCreateForm
              draft={draft}
              setDraft={setDraft}
              onSave={createLead}
              isShowroomRole={addLeadWindowIsShowroom}
              uploadingShowroomContract={uploadingDraftShowroomContract}
              onShowroomContractUpload={(files) => void uploadDraftShowroomContract(files)}
              onCancel={() => {
                setDraft(createEmptyLeadDraft());
                if (typeof window !== "undefined") {
                  window.close();
                }
              }}
            />
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map((c) => <SummaryCard key={c.title} title={c.title} value={c.value} />)}</section>
      <section className="grid gap-4 xl:grid-cols-3">
        <section className="module-shell xl:col-span-2">
          <div className="module-header">
            <h2 className="module-title">Active Pipeline ({roleLabel(role)})</h2>
            <div className="flex gap-2">
              {role === "OperationManager" ? (
                <select value={operationView} onChange={(e) => setOperationView(e.target.value as "all" | "sales" | "account" | "logistics")} className="brand-input max-w-44">
                  <option value="all">All Teams</option>
                  <option value="sales">Sales</option>
                  <option value="account">Accounts</option>
                  <option value="logistics">Logistics / Service</option>
                </select>
              ) : null}
              <select value={pipelineType} onChange={(e) => setPipelineType(e.target.value as "new" | "existing")} className="brand-input max-w-36">
                <option value="new">New</option>
                <option value="existing">Existing</option>
              </select>
              {role === "OperationManager" ? (
                <button type="button" className="mini-btn" onClick={() => window.open("/?opstats=1", "_blank", "noopener,noreferrer")}>Statistics</button>
              ) : null}
              <button type="button" onClick={() => setShowLeadSearch((v) => !v)} className="mini-btn">Search</button>
              <button type="button" onClick={() => setPipelineFilters({})} className="mini-btn">Clear Filters</button>
              {(role === "Sales" || role === "Showroom") && !dashboardReadOnly ? (
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined" && !addLeadWindowMode) {
                      const profile = isShowroomRole ? "Showroom" : "Sales";
                      const popupName = isShowroomRole ? "showroom-add-lead" : "sales-add-lead";
                      const popupQuery = isShowroomRole ? `showroomAddLead=1&profile=${profile}` : `addLead=1&profile=${profile}`;
                      window.open(`/?${popupQuery}`, popupName, "width=1100,height=900");
                      return;
                    }
                    setAddingLead((v) => !v);
                  }}
                  className="brand-btn px-3 py-2 text-xs"
                >
                  {addingLead ? "Close Add Lead" : "Add Lead"}
                </button>
              ) : null}
            </div>
          </div>
          <div className="module-body space-y-4">
            {error ? <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
            {loading ? <p className="text-sm text-gray-600">Loading data...</p> : null}
            {showLeadSearch ? <SearchBox query={leadSearch} setQuery={setLeadSearch} mode={leadMode} setMode={setLeadMode} /> : null}
            {addingLead && (role === "Sales" || role === "Showroom") && !dashboardReadOnly ? (
              <LeadCreateForm
                draft={draft}
                setDraft={setDraft}
                onSave={createLead}
                isShowroomRole={isShowroomRole}
                uploadingShowroomContract={uploadingDraftShowroomContract}
                onShowroomContractUpload={(files) => void uploadDraftShowroomContract(files)}
                onCancel={() => {
                  setAddingLead(false);
                  setDraft(createEmptyLeadDraft());
                  if (addLeadWindowMode && typeof window !== "undefined" && window.opener) {
                    window.close();
                  }
                }}
              />
            ) : null}
            <div className="overflow-x-auto">
              <table className="brand-table">
                <thead>
                  {isShowroomRole ? (
                    <>
                      <tr><th>Ownership</th><th>Brand</th><th>Model</th><th>Year</th><th>Reserved</th><th>Sold</th><th>Name</th><th>Package</th></tr>
                    </>
                  ) : pipelineType === "existing" ? (
                    <>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>
                          <TableHeaderFilter
                            label="Status"
                            value={pipelineFilters.status ?? ""}
                            options={pipelineStatusFilterOptions}
                            onChange={(value) => setPipelineFilters((current) => ({ ...current, status: value }))}
                          />
                        </th>
                        <th>Family At</th>
                        <th>Warranty</th>
                        <th>Warranty Until</th>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>
                          <TableHeaderFilter
                            label="Status"
                            value={pipelineFilters.status ?? ""}
                            options={pipelineStatusFilterOptions}
                            onChange={(value) => setPipelineFilters((current) => ({ ...current, status: value }))}
                          />
                        </th>
                        <th>Created At</th>
                        <th>
                          <TableHeaderFilter
                            label="User"
                            value={pipelineFilters.user ?? ""}
                            options={pipelineUserFilterOptions}
                            onChange={(value) => setPipelineFilters((current) => ({ ...current, user: value }))}
                          />
                        </th>
                      </tr>
                    </>
                  )}
                </thead>
                <tbody>
                  {paginatedLeads.map((l) => (
                    <tr key={l.id} onClick={() => setLeadWindowId(l.id)} className="cursor-pointer">
                      {isShowroomRole ? (
                        <>
                          <td>{l.showroomOwnership}</td>
                          <td>{l.brand || "-"}</td>
                          <td>{l.model || "-"}</td>
                          <td>{l.firstRegistrationDate || "-"}</td>
                          <td>{l.showroomReserved}</td>
                          <td>{l.showroomSold}</td>
                          <td>{l.fullName}</td>
                          <td>{l.showroomPackage || "-"}</td>
                        </>
                      ) : pipelineType === "existing" ? (
                        <>
                          <td>{l.fullName}</td>
                          <td>{l.phone}</td>
                          <td>{l.email || "-"}</td>
                          <td>{l.stage}</td>
                          <td>{l.familyAt ? formatUiDateTime(l.familyAt) : "-"}</td>
                          <td>{l.aftersalesWarranty}</td>
                          <td>{l.aftersalesWarrantyDate || "-"}</td>
                        </>
                      ) : (
                        <>
                          <td>{l.fullName}</td>
                          <td>{l.phone}</td>
                          <td>{l.email}</td>
                          <td>{l.stage}</td>
                          <td>{formatUiDateTime(l.createdAt)}</td>
                          <td>{l.lastUpdatedBy || "-"}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-700">
              <p>
                {filteredLeads.length === 0
                  ? "No leads"
                  : `Showing ${(leadPage - 1) * leadsPerPage + 1} - ${Math.min(leadPage * leadsPerPage, filteredLeads.length)} of ${filteredLeads.length}`}
              </p>
              <div className="flex gap-2">
                <button type="button" className="mini-btn" onClick={() => goToLeadPage(leadPage - 1)} disabled={leadPage === 1}>
                  Prev
                </button>
                <span className="inline-flex items-center rounded border border-gray-200 px-2">Page {leadPage}/{totalLeadPages}</span>
                <button type="button" className="mini-btn" onClick={() => goToLeadPage(leadPage + 1)} disabled={leadPage >= totalLeadPages}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>
        <div className="space-y-4">
          {(role === "AccountManager" || role === "TeamLeadAM" || role === "OperationManager") ? (
            <section className="module-shell">
              <div className="module-header">
                <h2 className="module-title">New Memo</h2>
                <div className="flex items-center gap-2">
                  {role === "TeamLeadAM" && teamLeadQueue.length > 0 ? <span className="badge badge-red">{teamLeadQueue.length} pending</span> : null}
                  {role === "OperationManager" && operationQueue.length > 0 ? <span className="badge badge-red">{operationQueue.length} pending</span> : null}
                  <button type="button" className="mini-btn" onClick={() => setShowMemoPanel((v) => !v)}>
                    {showMemoPanel ? "Close" : "Open"}
                  </button>
                </div>
              </div>
              <div className="module-body space-y-3">
                {role === "OperationManager" && operationQueue.length > 0 ? (
                  <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    Notification: {operationQueue.length} memo(s) are waiting for final approval.
                  </p>
                ) : null}
                {role === "TeamLeadAM" && teamLeadQueue.length > 0 ? (
                  <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    Notification: {teamLeadQueue.length} memo(s) are waiting for TeamLeadAM review.
                  </p>
                ) : null}
                {role === "AccountManager" && accountReturnedMemos.length > 0 ? (
                  <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                    Returned memos: {accountReturnedMemos.length}. Review comments and re-submit.
                  </p>
                ) : null}
                {role === "AccountManager" && accountApprovedMemos.length > 0 ? (
                  <p className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700">
                    Approved memos: {accountApprovedMemos.length}.
                  </p>
                ) : null}
                {showMemoPanel ? (
                  <div className="space-y-3">
                    <Field label="Search Memo" value={memoSearch} onChange={setMemoSearch} />
                    <div className="flex flex-wrap gap-2">
                      <FilterButton active={memoSearchMode === "name"} label="Name" onClick={() => setMemoSearchMode("name")} />
                      <FilterButton active={memoSearchMode === "egn"} label="EGN" onClick={() => setMemoSearchMode("egn")} />
                      <FilterButton active={memoSearchMode === "phone"} label="Phone" onClick={() => setMemoSearchMode("phone")} />
                      <FilterButton active={memoSearchMode === "vin"} label="VIN" onClick={() => setMemoSearchMode("vin")} />
                    </div>
                    {role === "AccountManager" ? (
                      <>
                        <label>
                          <span className="field-label">Lead From Pipeline</span>
                          <select value={memoLeadId} onChange={(e) => setMemoLeadId(e.target.value)} className="brand-input">
                            <option value="">Select lead</option>
                            {accountPipelineLeads.map((lead) => (
                              <option key={lead.id} value={lead.id}>
                                {lead.fullName} | {lead.egn || "no EGN"} | {lead.phone} | {lead.vin || "no VIN"}
                              </option>
                            ))}
                          </select>
                        </label>
                        {selectedMemoLead ? (
                          <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
                            <p><strong>Subject:</strong> {selectedMemoLead.memoSubject || "-"}</p>
                            <p><strong>Status:</strong> {memoStatusLabel(selectedMemoLead.memoStatus)}</p>
                            {selectedMemoLead.memoTeamLeadComment ? <p><strong>TeamLeadAM:</strong> {selectedMemoLead.memoTeamLeadComment}</p> : null}
                            {selectedMemoLead.memoOperationComment ? <p><strong>OperationManager:</strong> {selectedMemoLead.memoOperationComment}</p> : null}
                          </div>
                        ) : null}
                        {selectedMemoLead ? <MemoEventsTable events={selectedMemoLead.memoEvents} /> : null}
                        <SelectField label="Subject" value={memoSubject} options={memoSubjectOptions} onChange={(value) => setMemoSubject(value as MemoSubject)} disabled={dashboardReadOnly} />
                        <TextField label="Description" value={memoDescription} onChange={setMemoDescription} disabled={dashboardReadOnly} />
                        <button type="button" className="brand-btn w-full px-3 py-2 text-sm" onClick={submitMemoToTeamLead} disabled={!selectedMemoLead || memoSaving || dashboardReadOnly}>
                          {memoSaving ? "Submitting..." : "Submit"}
                        </button>
                      </>
                    ) : null}

                    {role === "TeamLeadAM" ? (
                      <>
                        <label>
                          <span className="field-label">Pending New Memo</span>
                          <select value={memoLeadId} onChange={(e) => setMemoLeadId(e.target.value)} className="brand-input">
                            <option value="">Select memo</option>
                            {teamLeadQueue.map((lead) => (
                              <option key={lead.id} value={lead.id}>
                                {lead.fullName} | {lead.phone}
                              </option>
                            ))}
                          </select>
                        </label>
                        {selectedMemoLead ? (
                          <>
                            <MemoReadOnlyCard lead={selectedMemoLead} />
                            <MemoEventsTable events={selectedMemoLead.memoEvents} />
                          </>
                        ) : (
                          <p className="text-xs text-gray-600">No pending memos.</p>
                        )}
                        <TextField label="Comment" value={memoReviewComment} onChange={setMemoReviewComment} />
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" className="mini-btn" onClick={() => void teamLeadReview("rejected_by_teamlead")} disabled={!selectedMemoLead || memoSaving}>
                            Reject
                          </button>
                          <button type="button" className="brand-btn px-3 py-2 text-xs" onClick={() => void teamLeadReview("pending_operation")} disabled={!selectedMemoLead || memoSaving}>
                            Approve
                          </button>
                        </div>
                      </>
                    ) : null}

                    {role === "OperationManager" ? (
                      <>
                        <label>
                          <span className="field-label">Pending Final Review</span>
                          <select value={memoLeadId} onChange={(e) => setMemoLeadId(e.target.value)} className="brand-input">
                            <option value="">Select memo</option>
                            {operationQueue.map((lead) => (
                              <option key={lead.id} value={lead.id}>
                                {lead.fullName} | {lead.phone}
                              </option>
                            ))}
                          </select>
                        </label>
                        {selectedMemoLead ? (
                          <>
                            <MemoReadOnlyCard lead={selectedMemoLead} />
                            <MemoEventsTable events={selectedMemoLead.memoEvents} />
                          </>
                        ) : (
                          <p className="text-xs text-gray-600">No pending memos.</p>
                        )}
                        <TextField label="Comment" value={memoReviewComment} onChange={setMemoReviewComment} />
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" className="mini-btn" onClick={() => void operationReview("rejected_by_operation")} disabled={!selectedMemoLead || memoSaving}>
                            Reject
                          </button>
                          <button type="button" className="brand-btn px-3 py-2 text-xs" onClick={() => void operationReview("approved")} disabled={!selectedMemoLead || memoSaving}>
                            Approve
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="module-shell">
            <div className="module-header"><h2 className="module-title">Month Calendar</h2><span className="badge brand-chip">Activities</span></div>
            <div className="module-body space-y-3">
              <div className="flex items-center justify-between"><button type="button" className="mini-btn" onClick={() => setMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}>Prev</button><p className="text-sm font-semibold">{formatUiMonth(month)}</p><button type="button" className="mini-btn" onClick={() => setMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}>Next</button></div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-600"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
              <div className="grid grid-cols-7 gap-1">{cells.map((c, i) => <button key={`${c.iso ?? "empty"}-${i}`} type="button" className="min-h-14 rounded border border-gray-200 p-1 text-left text-xs" onClick={() => { if (!c.iso) return; const selectedDate = c.iso; setActivityDraft((s) => ({ ...s, date: selectedDate })); setActivityModalDate(selectedDate); }}>{c.day ? <><p>{c.day}</p>{c.iso && counts[c.iso] ? <p className="mt-1 rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-700">{counts[c.iso]} act</p> : null}</> : null}</button>)}</div>
              <button type="button" onClick={() => setShowActivityForm((v) => !v)} className="brand-btn w-full px-3 py-2 text-sm" disabled={dashboardReadOnly}>{showActivityForm ? "Hide Add Activity" : "Add Activity"}</button>
              {showActivityForm ? <ActivityForm draft={activityDraft} setDraft={setActivityDraft} onSave={createActivity} saving={savingActivity} /> : null}
              <div className="space-y-2"><p className="text-sm font-semibold">Upcoming Activities</p>{futureActivities.length === 0 ? <p className="text-sm text-gray-600">No upcoming activities.</p> : null}{futureActivities.map((a) => <article key={a.id} className="rounded-lg border border-gray-200 p-3"><p className="font-semibold">{a.title}</p><p className="text-xs text-gray-600">{formatUiDateTime(a.startsAt)}</p>{a.note ? <p className="mt-1 text-sm text-gray-700">{a.note}</p> : null}<div className="mt-2 flex gap-2"><button type="button" className="mini-btn" onClick={() => markDone(a.id)} disabled={dashboardReadOnly}>Mark Done</button><button type="button" className="mini-btn" onClick={() => removeActivity(a.id)} disabled={dashboardReadOnly}>Delete</button></div></article>)}</div>
            </div>
          </section>
        </div>
      </section>
      <section className="module-shell">
        <div className="module-header"><h2 className="module-title">Sample Clients</h2><div className="flex gap-2"><button type="button" onClick={() => setShowClientSearch((v) => !v)} className="mini-btn">Search</button><span className="badge brand-chip">{filteredClients.length} records</span></div></div>
        <div className="module-body space-y-3">
          {showClientSearch ? <SearchBox query={clientSearch} setQuery={setClientSearch} mode={clientMode} setMode={setClientMode} /> : null}
          <div className="overflow-x-auto"><table className="brand-table"><thead><tr><th>Client Name</th><th>Phone</th><th>Email</th><th>Requested Vehicle</th></tr></thead><tbody>{filteredClients.map((c) => <tr key={`${c.phone}-${c.email}`}><td>{c.name}</td><td>{c.phone}</td><td>{c.email}</td><td>{c.requested}</td></tr>)}</tbody></table></div>
        </div>
      </section>

      {leadWindow ? (
        <ModalWindow title={`Lead Details: ${leadWindow.fullName}`} onClose={() => setLeadWindowId(null)}>
          {sectionedView ? (
            <div className="space-y-3">
              <CollapsibleSection title="Basic info" open={basicInfoOpen} onToggle={() => setBasicInfoOpen((v) => !v)}>
                <div className="form-grid md:grid-cols-3">
                  {isShowroomRole ? (
                    <>
                      <Field label="Имена" value={leadWindow.fullName} onChange={(v) => patchLead(leadWindow.id, { fullName: v })} disabled={showroomInfoReadOnly} />
                      <Field label="Телефон" value={leadWindow.phone} onChange={(v) => patchLead(leadWindow.id, { phone: v })} disabled={showroomInfoReadOnly} />
                    </>
                  ) : (
                    <>
                      <Field label="Client Name" value={leadWindow.fullName} onChange={(v) => patchLead(leadWindow.id, { fullName: v })} disabled={basicInfoReadOnly} />
                      <Field label="Phone" value={leadWindow.phone} onChange={(v) => patchLead(leadWindow.id, { phone: v })} disabled={basicInfoReadOnly} />
                      <Field label="Email" value={leadWindow.email} onChange={(v) => patchLead(leadWindow.id, { email: v })} disabled={basicInfoReadOnly} />
                      <Field label="EGN" value={leadWindow.egn} onChange={(v) => patchLead(leadWindow.id, { egn: v })} disabled={basicInfoReadOnly} />
                      <Field label="Address" value={leadWindow.address} onChange={(v) => patchLead(leadWindow.id, { address: v })} disabled={basicInfoReadOnly} />
                      <Field label="Vehicle Request" value={leadWindow.vehicleRequest} onChange={(v) => patchLead(leadWindow.id, { vehicleRequest: v })} disabled={basicInfoReadOnly} />
                      <Field label="Created At" type="datetime-local" value={toLocal(leadWindow.createdAt)} onChange={(v) => patchLead(leadWindow.id, { createdAt: v ? new Date(v).toISOString() : leadWindow.createdAt })} disabled={basicInfoReadOnly} />
                      <Field label="Contract Link" value={leadWindow.contractLink} onChange={(v) => patchLead(leadWindow.id, { contractLink: v })} disabled={basicInfoReadOnly} />
                      <SelectField label="Source" value={leadWindow.source} options={leadSourceOptions} onChange={(v) => patchLead(leadWindow.id, { source: v as LeadSourceInput })} disabled={basicInfoReadOnly} />
                      <SelectField label="Status" value={effectiveLeadStage ?? leadWindow.stage} options={stageOptionsByRole} onChange={(v) => { patchLead(leadWindow.id, { stage: v as LeadStage, ...(isCallbackStage(v as LeadStage) ? {} : { callbackAt: "", callbackNotes: "" }) }); setTransferStage((p) => ({ ...p, [leadWindow.id]: v as LeadStage })); }} disabled={stageReadOnly} />
                      {isCallbackStage((effectiveLeadStage ?? leadWindow.stage) as LeadStage) ? (
                        <>
                          <Field label="Call Back" type="datetime-local" value={leadWindow.callbackAt ? toLocal(leadWindow.callbackAt) : ""} onChange={(v) => patchLead(leadWindow.id, { callbackAt: v ? new Date(v).toISOString() : "" })} disabled={stageReadOnly} />
                          <TextField label="Notes" value={leadWindow.callbackNotes} onChange={(v) => patchLead(leadWindow.id, { callbackNotes: v })} disabled={stageReadOnly} />
                        </>
                      ) : null}
                      {effectiveLeadStage === "Message" || effectiveLeadStage === "Contract" ? (
                        <>
                          <SelectField label="Package" value={leadWindow.contractPackage} options={contractPackageOptions} onChange={(v) => patchLead(leadWindow.id, { contractPackage: v as ContractPackage })} disabled={basicInfoReadOnly} />
                          <Field label="Price" value={leadWindow.contractPrice} onChange={(v) => patchLead(leadWindow.id, { contractPrice: v })} disabled={basicInfoReadOnly} />
                        </>
                      ) : null}
                      <TextField label="Handover Description" value={leadWindow.handoverNote} onChange={(v) => patchLead(leadWindow.id, { handoverNote: v })} disabled={basicInfoReadOnly} />
                      <Field label="Budget" value={leadWindow.budget} onChange={(v) => patchLead(leadWindow.id, { budget: v })} disabled={basicInfoReadOnly} />
                      {leadWindow.returnToSalesComment ? <TextField label="Return To Sales Comment" value={leadWindow.returnToSalesComment} onChange={(v) => patchLead(leadWindow.id, { returnToSalesComment: v })} disabled={role !== "Sales" && role !== "Admin"} /> : null}
                    </>
                  )}
                </div>
              </CollapsibleSection>
              {isShowroomRole ? (
                <CollapsibleSection title="Showroom info" open={amInfoOpen} onToggle={() => setAmInfoOpen((v) => !v)}>
                  <div className="form-grid md:grid-cols-3">
                    <SelectField label="Ownership" value={leadWindow.showroomOwnership} options={["Own", "Client"]} onChange={(v) => patchLead(leadWindow.id, { showroomOwnership: v as ShowroomOwnership })} disabled={showroomInfoReadOnly} />
                    <SelectField label="Package" value={leadWindow.showroomPackage} options={showroomPackageOptions} onChange={(v) => patchLead(leadWindow.id, { showroomPackage: v as ShowroomPackage })} disabled={showroomInfoReadOnly} />
                    <Field label="Brand" value={leadWindow.brand} onChange={(v) => patchLead(leadWindow.id, { brand: v })} disabled={showroomInfoReadOnly} />
                    <Field label="Model" value={leadWindow.model} onChange={(v) => patchLead(leadWindow.id, { model: v })} disabled={showroomInfoReadOnly} />
                    <Field label="Year" value={leadWindow.firstRegistrationDate} onChange={(v) => patchLead(leadWindow.id, { firstRegistrationDate: normalizeShowroomYear(v) })} disabled={showroomInfoReadOnly} />
                    <Field label="Engine" value={leadWindow.engine} onChange={(v) => patchLead(leadWindow.id, { engine: v })} disabled={showroomInfoReadOnly} />
                    <Field label="Mileage" value={leadWindow.mileage} onChange={(v) => patchLead(leadWindow.id, { mileage: v })} disabled={showroomInfoReadOnly} />
                    <Field label="VIN" value={leadWindow.vin} onChange={(v) => patchLead(leadWindow.id, { vin: v })} disabled={showroomInfoReadOnly} />
                    <TextField label="Service History" value={leadWindow.serviceOfferDetails} onChange={(v) => patchLead(leadWindow.id, { serviceOfferDetails: v })} disabled={showroomInfoReadOnly} />
                    <Field label="Origin" value={leadWindow.purchaseLocation} onChange={(v) => patchLead(leadWindow.id, { purchaseLocation: v })} disabled={showroomInfoReadOnly} />
                    <SelectField label="Warranty" value={leadWindow.warranty} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { warranty: v as YesNo })} disabled={showroomInfoReadOnly} />
                    <SelectField label="Inspected In Service" value={leadWindow.inspection} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { inspection: v as YesNo })} disabled={showroomInfoReadOnly} />
                    <Field label="Tires" value={leadWindow.tiresInfo} onChange={(v) => patchLead(leadWindow.id, { tiresInfo: v })} disabled={showroomInfoReadOnly} />
                    <TextField label="Description" value={showroomLeadDescription(leadWindow)} onChange={(v) => patchLead(leadWindow.id, { addonOther: v })} disabled={showroomInfoReadOnly} />
                    {leadWindow.showroomOwnership === "Client" ? (
                      <>
                        <Field label="GO" value={leadWindow.insuranceGoPrice} onChange={(v) => patchLead(leadWindow.id, { insuranceGoPrice: v })} disabled={showroomInfoReadOnly} />
                        <Field label="CASCO" value={leadWindow.insuranceCascoPrice} onChange={(v) => patchLead(leadWindow.id, { insuranceCascoPrice: v })} disabled={showroomInfoReadOnly} />
                      </>
                    ) : null}
                    <SelectField label="Reserved" value={leadWindow.showroomReserved} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { showroomReserved: v as YesNo })} disabled={showroomInfoReadOnly} />
                    <SelectField label="Sold" value={leadWindow.showroomSold} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { showroomSold: v as YesNo })} disabled={showroomInfoReadOnly} />
                  </div>
                  {leadWindow.showroomOwnership === "Client" ? (
                    <div className="mt-3">
                      <DocumentDropzone
                        title="Contract"
                        documents={leadWindow.showroomContract}
                        uploading={uploadingLeadShowroomContract}
                        onUpload={(files) => void uploadLeadShowroomContract(leadWindow.id, files)}
                        onRemove={(documentId) => patchLead(leadWindow.id, { showroomContract: leadWindow.showroomContract.filter((doc) => doc.id !== documentId) })}
                      />
                    </div>
                  ) : null}
                </CollapsibleSection>
              ) : null}
              {canShowAmInfo && !isShowroomRole ? (
                <CollapsibleSection title="AM info" open={amInfoOpen} onToggle={() => setAmInfoOpen((v) => !v)}>
                  <div className="form-grid md:grid-cols-3">
                    <Field label="Automobile" value={leadWindow.car} onChange={(v) => patchLead(leadWindow.id, { car: v })} disabled={amInfoReadOnly} />
                    <Field label="Brand" value={leadWindow.brand} onChange={(v) => patchLead(leadWindow.id, { brand: v })} disabled={amInfoReadOnly} />
                    <Field label="Model" value={leadWindow.model} onChange={(v) => patchLead(leadWindow.id, { model: v })} disabled={amInfoReadOnly} />
                    <Field label="Engine" value={leadWindow.engine} onChange={(v) => patchLead(leadWindow.id, { engine: v })} disabled={amInfoReadOnly} />
                    <SelectField label="Keyless Start" value={leadWindow.keylessStart} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { keylessStart: v as YesNo })} disabled={amInfoReadOnly} />
                    <Field label="Purchase Date" type="date" value={leadWindow.purchaseDate} onChange={(v) => patchLead(leadWindow.id, { purchaseDate: v })} disabled={amInfoReadOnly} />
                    <Field label="PickUp Date" type="date" value={leadWindow.pickupDate} onChange={(v) => patchLead(leadWindow.id, { pickupDate: v })} disabled={amInfoReadOnly} />
                    <Field label="AM" value={leadWindow.am} onChange={(v) => patchLead(leadWindow.id, { am: v })} disabled={amInfoReadOnly} />
                    <Field label="By Recommendation" value={leadWindow.referral} onChange={(v) => patchLead(leadWindow.id, { referral: v })} disabled={amInfoReadOnly} />
                    <Field label="Discount" value={leadWindow.discount} onChange={(v) => patchLead(leadWindow.id, { discount: v })} disabled={amInfoReadOnly} />
                    <Field label="Discount For Client" value={leadWindow.clientDiscount} onChange={(v) => patchLead(leadWindow.id, { clientDiscount: v })} disabled={amInfoReadOnly} />
                    <Field label="VIN" value={leadWindow.vin} onChange={(v) => patchLead(leadWindow.id, { vin: v })} disabled={amInfoReadOnly} />
                    <SelectField label="Serviced" value={leadWindow.serviced} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { serviced: v as YesNo })} disabled={amInfoReadOnly} />
                    {leadWindow.serviced === "Yes" ? (
                      <Field label="Serviced Date" type="date" value={leadWindow.servicedDate} onChange={(v) => patchLead(leadWindow.id, { servicedDate: v })} disabled={amInfoReadOnly} />
                    ) : null}
                    <SelectField label="Second Key" value={leadWindow.secondKey} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { secondKey: v as YesNo })} disabled={amInfoReadOnly} />
                    <SelectField label="Second Tire Set" value={leadWindow.secondTireSet} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { secondTireSet: v as YesNo })} disabled={amInfoReadOnly} />
                    <Field label="Place of Purchase" value={leadWindow.purchaseLocation} onChange={(v) => patchLead(leadWindow.id, { purchaseLocation: v })} disabled={amInfoReadOnly} />
                    <Field label="VAT Key" value={leadWindow.vatKey} onChange={(v) => patchLead(leadWindow.id, { vatKey: v })} disabled={amInfoReadOnly} />
                    <Field label="Delivery Price" value={leadWindow.deliveryPrice} onChange={(v) => patchLead(leadWindow.id, { deliveryPrice: v })} disabled={amInfoReadOnly} />
                    <SelectField label="Warranty" value={leadWindow.warranty} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { warranty: v as YesNo })} disabled={amInfoReadOnly} />
                    <Field label="Weight" value={leadWindow.weight} onChange={(v) => patchLead(leadWindow.id, { weight: v })} disabled={amInfoReadOnly} />
                    <Field label="Color" value={leadWindow.color} onChange={(v) => patchLead(leadWindow.id, { color: v })} disabled={amInfoReadOnly} />
                    <Field label="Power kW" value={leadWindow.powerKw} onChange={(v) => patchLead(leadWindow.id, { powerKw: v })} disabled={amInfoReadOnly} />
                    <Field label="Power hp" value={leadWindow.powerHp} onChange={(v) => patchLead(leadWindow.id, { powerHp: v })} disabled={amInfoReadOnly} />
                    <Field label="Seats Count" value={leadWindow.seatsCount} onChange={(v) => patchLead(leadWindow.id, { seatsCount: v })} disabled={amInfoReadOnly} />
                    <Field label="Doors Count" value={leadWindow.doorsCount} onChange={(v) => patchLead(leadWindow.id, { doorsCount: v })} disabled={amInfoReadOnly} />
                    <Field
                      label="First Registration Date"
                      type="date"
                      value={leadWindow.firstRegistrationDate}
                      onChange={(v) => patchLead(leadWindow.id, { firstRegistrationDate: v })}
                      disabled={amInfoReadOnly}
                    />
                    <Field label="Mileage" value={leadWindow.mileage} onChange={(v) => patchLead(leadWindow.id, { mileage: v })} disabled={amInfoReadOnly} />
                    <TextField label="Others" value={leadWindow.addonOther} onChange={(v) => patchLead(leadWindow.id, { addonOther: v })} disabled={amInfoReadOnly} />
                  </div>
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Documents</p>
                      <div className="flex items-center gap-2">
                        <input
                          ref={(node) => {
                            documentInputRefs.current[leadWindow.id] = node;
                          }}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(event) => void uploadLeadDocuments(leadWindow.id, event)}
                        />
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => documentInputRefs.current[leadWindow.id]?.click()}
                          disabled={amInfoReadOnly || uploadingDocuments[leadWindow.id]}
                        >
                          {uploadingDocuments[leadWindow.id] ? "Uploading..." : "+"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {leadWindow.accountDocuments.length === 0 ? <p className="text-xs text-gray-600">No uploaded documents.</p> : null}
                      {leadWindow.accountDocuments.map((document) => (
                        <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                          <span>{document.name}</span>
                          <span className="text-xs text-gray-500">{formatUiDateTime(document.uploadedAt)}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                  {canSeeMemoTrace ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                      <p className="font-semibold">Memo Trace</p>
                      <p><strong>Status:</strong> {memoStatusLabel(leadWindow.memoStatus)}</p>
                      <p><strong>Uploaded At:</strong> {leadWindow.memoAccountSubmittedAt ? formatUiDateTime(leadWindow.memoAccountSubmittedAt) : "-"}</p>
                      <p><strong>TeamLead Decision:</strong> {leadWindow.memoTeamLeadDecisionAt ? formatUiDateTime(leadWindow.memoTeamLeadDecisionAt) : "-"}</p>
                      <p><strong>Operation Decision:</strong> {leadWindow.memoOperationDecisionAt ? formatUiDateTime(leadWindow.memoOperationDecisionAt) : "-"}</p>
                      <MemoEventsTable events={leadWindow.memoEvents} />
                    </div>
                  ) : null}
                </CollapsibleSection>
              ) : null}
              {canShowAddOnInfo ? (
                <CollapsibleSection title="AddOn" open={addonInfoOpen} onToggle={() => setAddonInfoOpen((v) => !v)}>
                  {role === "Logistics" ? (
                    <div className="space-y-3">
                      <div className="form-grid md:grid-cols-6">
                        <TextField label="Застраховка" value={leadWindow.insuranceInfo} onChange={(v) => patchLead(leadWindow.id, { insuranceInfo: v })} />
                        <Field label="Цена ГО (EUR)" value={leadWindow.insuranceGoPrice} onChange={(v) => patchLead(leadWindow.id, { insuranceGoPrice: v })} />
                        <Field label="Цена Каско (EUR)" value={leadWindow.insuranceCascoPrice} onChange={(v) => patchLead(leadWindow.id, { insuranceCascoPrice: v })} />
                        <SelectField label="Приета оферта" value={leadWindow.insuranceAccepted} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { insuranceAccepted: v as YesNo })} />
                        <SelectField label="Протокол от КАСКО" value={leadWindow.cascoPhotos} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { cascoPhotos: v as YesNo })} />
                        <Field
                          label="Марж"
                          value={formatEuroAmount(asNumber(leadWindow.insuranceGoPrice) * 0.14 + asNumber(leadWindow.insuranceCascoPrice) * 0.25, !!leadWindow.insuranceGoPrice || !!leadWindow.insuranceCascoPrice)}
                          onChange={(v) => void v}
                          disabled
                        />
                      </div>

                      <div className="form-grid md:grid-cols-3">
                        <SelectField label="Регистрация КАТ" value={leadWindow.registrationStatus} options={registrationOptions} onChange={(v) => patchLead(leadWindow.id, { registrationStatus: v as RegistrationStatus })} />
                        <Field label="Издължаване" type="date" value={leadWindow.payoffDate} onChange={(v) => patchLead(leadWindow.id, { payoffDate: v })} />
                        <SelectField label="Гаранция" value={leadWindow.aftersalesWarranty} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { aftersalesWarranty: v as YesNo })} />
                      </div>

                      {leadWindow.aftersalesWarranty === "Yes" ? (
                        <div className="form-grid md:grid-cols-2">
                          <Field label="Гаранция до" type="date" value={leadWindow.aftersalesWarrantyDate} onChange={(v) => patchLead(leadWindow.id, { aftersalesWarrantyDate: v })} />
                          <Field label="Пробег" value={leadWindow.aftersalesWarrantyMileage} onChange={(v) => patchLead(leadWindow.id, { aftersalesWarrantyMileage: v })} />
                        </div>
                      ) : null}

                      <div className="form-grid md:grid-cols-3">
                        <SelectField label="Inspection" value={leadWindow.inspection} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { inspection: v as YesNo })} />
                        <Field label="Протокол от инспекция (линк)" value={leadWindow.inspectionProtocolLink} onChange={(v) => patchLead(leadWindow.id, { inspectionProtocolLink: v })} />
                      </div>

                      <div className="form-grid md:grid-cols-5">
                        <Field label="Оферта за обслужване (линк)" value={leadWindow.serviceOfferLink} onChange={(v) => patchLead(leadWindow.id, { serviceOfferLink: v })} />
                        <SelectField label="Приета оферта" value={leadWindow.serviceOfferAccepted} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { serviceOfferAccepted: v as YesNo })} />
                        <Field label="Cost price (EUR)" value={leadWindow.serviceCostPrice} onChange={(v) => patchLead(leadWindow.id, { serviceCostPrice: v })} />
                        <Field label="Цена (EUR)" value={leadWindow.servicePrice} onChange={(v) => patchLead(leadWindow.id, { servicePrice: v })} />
                        <Field
                          label="Маржи"
                          value={formatEuroAmount(asNumber(leadWindow.servicePrice) - asNumber(leadWindow.serviceCostPrice), !!leadWindow.servicePrice || !!leadWindow.serviceCostPrice)}
                          onChange={(v) => void v}
                          disabled
                        />
                      </div>

                      <div className="form-grid md:grid-cols-2">
                        <SelectField label="Тип детайлинг" value={leadWindow.detailing} options={detailingOptions} onChange={(v) => patchLead(leadWindow.id, { detailing: v })} />
                        <Field label="Цена (EUR)" value={leadWindow.detailingPrice} onChange={(v) => patchLead(leadWindow.id, { detailingPrice: v })} />
                      </div>

                      <div className="form-grid md:grid-cols-4">
                        <TextField label="Гуми и Джанти" value={leadWindow.tiresInfo} onChange={(v) => patchLead(leadWindow.id, { tiresInfo: v })} />
                        <Field label="Cost price (EUR)" value={leadWindow.tiresCostPrice} onChange={(v) => patchLead(leadWindow.id, { tiresCostPrice: v })} />
                        <Field label="Цена (EUR)" value={leadWindow.tiresPrice} onChange={(v) => patchLead(leadWindow.id, { tiresPrice: v })} />
                        <Field
                          label="Маржи"
                          value={formatEuroAmount(asNumber(leadWindow.tiresPrice) - asNumber(leadWindow.tiresCostPrice), !!leadWindow.tiresPrice || !!leadWindow.tiresCostPrice)}
                          onChange={(v) => void v}
                          disabled
                        />
                      </div>

                      <div className="form-grid md:grid-cols-2">
                        <TextField label="Други" value={leadWindow.addonOther} onChange={(v) => patchLead(leadWindow.id, { addonOther: v })} />
                        <Field
                          label="Тотал (EUR)"
                          value={formatEuroAmount(
                            asNumber(leadWindow.insuranceGoPrice) +
                              asNumber(leadWindow.insuranceCascoPrice) +
                              asNumber(leadWindow.servicePrice) +
                              asNumber(leadWindow.detailingPrice) +
                              asNumber(leadWindow.tiresPrice),
                            !!leadWindow.insuranceGoPrice ||
                              !!leadWindow.insuranceCascoPrice ||
                              !!leadWindow.servicePrice ||
                              !!leadWindow.detailingPrice ||
                              !!leadWindow.tiresPrice,
                          )}
                          onChange={(v) => void v}
                          disabled
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="form-grid md:grid-cols-3">
                      <TextField label="Insurance" value={leadWindow.insuranceInfo} onChange={(v) => patchLead(leadWindow.id, { insuranceInfo: v })} disabled={!canEditAddOnField("other")} />
                      <SelectField label="Accepted Insurance Offer" value={leadWindow.insuranceAccepted} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { insuranceAccepted: v as YesNo })} disabled={!canEditAddOnField("other")} />
                      <TextField label="Registration" value={leadWindow.registrationInfo} onChange={(v) => patchLead(leadWindow.id, { registrationInfo: v })} disabled={!canEditAddOnField("other")} />
                      <SelectField label="Accepted Registration Offer" value={leadWindow.registrationAccepted} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { registrationAccepted: v as YesNo })} disabled={!canEditAddOnField("other")} />
                      <TextField label="Service Offer" value={leadWindow.serviceOfferDetails} onChange={(v) => patchLead(leadWindow.id, { serviceOfferDetails: v })} disabled={!canEditAddOnField("serviceOffer")} />
                      <SelectField label="Accepted Service Offer" value={leadWindow.serviceOfferAccepted} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { serviceOfferAccepted: v as YesNo })} disabled={!canEditAddOnField("serviceOffer")} />
                      <TextField label="Detailing" value={leadWindow.detailingInfo} onChange={(v) => patchLead(leadWindow.id, { detailingInfo: v })} disabled={!canEditAddOnField("other")} />
                      <SelectField label="Accepted Detailing Offer" value={leadWindow.detailingAccepted} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { detailingAccepted: v as YesNo })} disabled={!canEditAddOnField("other")} />
                      <TextField label="Tires" value={leadWindow.tiresInfo} onChange={(v) => patchLead(leadWindow.id, { tiresInfo: v })} disabled={!canEditAddOnField("other")} />
                      <SelectField label="Accepted Tires Offer" value={leadWindow.tiresAccepted} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { tiresAccepted: v as YesNo })} disabled={!canEditAddOnField("other")} />
                      <SelectField label="Registration Status" value={leadWindow.registrationStatus} options={registrationOptions} onChange={(v) => patchLead(leadWindow.id, { registrationStatus: v as RegistrationStatus })} disabled={!canEditAddOnField("other")} />
                      <SelectField label="Photos for CASCO" value={leadWindow.cascoPhotos} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { cascoPhotos: v as YesNo })} disabled={!canEditAddOnField("other")} />
                      <SelectField label="Inspection" value={leadWindow.inspection} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { inspection: v as YesNo })} disabled={!canEditAddOnField("other")} />
                      <SelectField label="Service Offer" value={leadWindow.serviceOffer} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { serviceOffer: v as YesNo })} disabled={!canEditAddOnField("serviceOffer")} />
                      <Field label="Service Offer Link" value={leadWindow.serviceOfferLink} onChange={(v) => patchLead(leadWindow.id, { serviceOfferLink: v })} disabled={!canEditAddOnField("serviceOfferLink")} />
                      <Field label="Inspection Protocol Link" value={leadWindow.inspectionProtocolLink} onChange={(v) => patchLead(leadWindow.id, { inspectionProtocolLink: v })} disabled={!canEditAddOnField("inspectionProtocolLink")} />
                      <SelectField label="Detailing Type" value={leadWindow.detailing} options={detailingOptions} onChange={(v) => patchLead(leadWindow.id, { detailing: v })} disabled={!canEditAddOnField("other")} />
                      <TextField label="Wheels" value={leadWindow.wheelsInfo} onChange={(v) => patchLead(leadWindow.id, { wheelsInfo: v })} disabled={!canEditAddOnField("other")} />
                      <TextField label="Other" value={leadWindow.addonOther} onChange={(v) => patchLead(leadWindow.id, { addonOther: v })} disabled={!canEditAddOnField("other")} />
                    </div>
                  )}
                </CollapsibleSection>
              ) : null}
            </div>
          ) : (
            <div className="form-grid md:grid-cols-3">
              <Field label="Client Name" value={leadWindow.fullName} onChange={(v) => patchLead(leadWindow.id, { fullName: v })} />
              <Field label="Phone" value={leadWindow.phone} onChange={(v) => patchLead(leadWindow.id, { phone: v })} />
              <Field label="Email" value={leadWindow.email} onChange={(v) => patchLead(leadWindow.id, { email: v })} />
              <Field label="EGN" value={leadWindow.egn} onChange={(v) => patchLead(leadWindow.id, { egn: v })} />
              <Field label="Address" value={leadWindow.address} onChange={(v) => patchLead(leadWindow.id, { address: v })} />
              <Field label="Vehicle Request" value={leadWindow.vehicleRequest} onChange={(v) => patchLead(leadWindow.id, { vehicleRequest: v })} />
              <Field label="Created At" type="datetime-local" value={toLocal(leadWindow.createdAt)} onChange={(v) => patchLead(leadWindow.id, { createdAt: v ? new Date(v).toISOString() : leadWindow.createdAt })} />
              <Field label="Contract Link" value={leadWindow.contractLink} onChange={(v) => patchLead(leadWindow.id, { contractLink: v })} />
              <SelectField label="Source" value={leadWindow.source} options={leadSourceOptions} onChange={(v) => patchLead(leadWindow.id, { source: v as LeadSourceInput })} />
              <SelectField label="Status" value={effectiveLeadStage ?? leadWindow.stage} options={stageOptionsByRole} onChange={(v) => { patchLead(leadWindow.id, { stage: v as LeadStage, ...(isCallbackStage(v as LeadStage) ? {} : { callbackAt: "", callbackNotes: "" }) }); setTransferStage((p) => ({ ...p, [leadWindow.id]: v as LeadStage })); }} />
              {isCallbackStage((effectiveLeadStage ?? leadWindow.stage) as LeadStage) ? (
                <>
                  <Field label="Call Back" type="datetime-local" value={leadWindow.callbackAt ? toLocal(leadWindow.callbackAt) : ""} onChange={(v) => patchLead(leadWindow.id, { callbackAt: v ? new Date(v).toISOString() : "" })} />
                  <TextField label="Notes" value={leadWindow.callbackNotes} onChange={(v) => patchLead(leadWindow.id, { callbackNotes: v })} />
                </>
              ) : null}
              {effectiveLeadStage === "Message" || effectiveLeadStage === "Contract" ? (
                <>
                  <SelectField label="Package" value={leadWindow.contractPackage} options={contractPackageOptions} onChange={(v) => patchLead(leadWindow.id, { contractPackage: v as ContractPackage })} />
                  <Field label="Price" value={leadWindow.contractPrice} onChange={(v) => patchLead(leadWindow.id, { contractPrice: v })} />
                </>
              ) : null}
              <TextField label="Handover Description" value={leadWindow.handoverNote} onChange={(v) => patchLead(leadWindow.id, { handoverNote: v })} />
              {role === "Sales" || role === "Admin" ? (
                <Field label="Budget" value={leadWindow.budget} onChange={(v) => patchLead(leadWindow.id, { budget: v })} />
              ) : null}
              {leadWindow.returnToSalesComment ? <TextField label="Return To Sales Comment" value={leadWindow.returnToSalesComment} onChange={(v) => patchLead(leadWindow.id, { returnToSalesComment: v })} disabled={role !== "Sales" && role !== "Admin"} /> : null}
              {canShowAmInfo ? (
                <>
                  <Field label="Automobile" value={leadWindow.car} onChange={(v) => patchLead(leadWindow.id, { car: v })} />
                  <Field label="Purchase Date" type="date" value={leadWindow.purchaseDate} onChange={(v) => patchLead(leadWindow.id, { purchaseDate: v })} />
                  <Field label="AM" value={leadWindow.am} onChange={(v) => patchLead(leadWindow.id, { am: v })} />
                  <Field label="By Recommendation" value={leadWindow.referral} onChange={(v) => patchLead(leadWindow.id, { referral: v })} />
                  <Field label="Discount" value={leadWindow.discount} onChange={(v) => patchLead(leadWindow.id, { discount: v })} />
                  <Field label="Discount For Client" value={leadWindow.clientDiscount} onChange={(v) => patchLead(leadWindow.id, { clientDiscount: v })} />
                  <Field label="VIN" value={leadWindow.vin} onChange={(v) => patchLead(leadWindow.id, { vin: v })} />
                  <SelectField label="Serviced" value={leadWindow.serviced} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { serviced: v as YesNo })} />
                  {leadWindow.serviced === "Yes" ? (
                    <Field label="Serviced Date" type="date" value={leadWindow.servicedDate} onChange={(v) => patchLead(leadWindow.id, { servicedDate: v })} />
                  ) : null}
                  <SelectField label="Second Key" value={leadWindow.secondKey} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { secondKey: v as YesNo })} />
                  <SelectField label="Second Tire Set" value={leadWindow.secondTireSet} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { secondTireSet: v as YesNo })} />
                  <Field label="Place of Purchase" value={leadWindow.purchaseLocation} onChange={(v) => patchLead(leadWindow.id, { purchaseLocation: v })} />
                  <Field label="VAT Key" value={leadWindow.vatKey} onChange={(v) => patchLead(leadWindow.id, { vatKey: v })} />
                  <Field label="Delivery Price" value={leadWindow.deliveryPrice} onChange={(v) => patchLead(leadWindow.id, { deliveryPrice: v })} />
                  <SelectField label="Warranty" value={leadWindow.warranty} options={yesNoOptions} onChange={(v) => patchLead(leadWindow.id, { warranty: v as YesNo })} />
                  <Field
                    label="First Registration Date"
                    type="date"
                    value={leadWindow.firstRegistrationDate}
                    onChange={(v) => patchLead(leadWindow.id, { firstRegistrationDate: v })}
                  />
                  <Field label="Mileage" value={leadWindow.mileage} onChange={(v) => patchLead(leadWindow.id, { mileage: v })} />
                  <TextField label="Others" value={leadWindow.addonOther} onChange={(v) => patchLead(leadWindow.id, { addonOther: v })} />
                </>
              ) : null}
            </div>
          )}
          {role === "AccountManager" && canShowLeadHistory ? <TextField label="Return To Sales Comment" value={returnComment} onChange={setReturnComment} /> : null}
          {canShowLeadHistory ? (
            <CollapsibleSection title="Lead History" open={historyOpen} onToggle={() => setHistoryOpen((v) => !v)}>
              <LeadHistoryCard events={leadWindow.history} noteEntries={leadWindow.noteEntries} />
            </CollapsibleSection>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="mini-btn" onClick={() => saveLead(leadWindow.id)} disabled={saving[leadWindow.id] || dashboardReadOnly}>{saving[leadWindow.id] ? "Saving..." : "Save"}</button>
            <button type="button" className="mini-btn" onClick={() => { cancelLead(leadWindow.id); setLeadWindowId(null); }}>Close</button>
            {role === "AccountManager" && !dashboardReadOnly ? (
              <button type="button" className="brand-btn px-3 py-2 text-xs" onClick={() => doTransfer(leadWindow.id, "logistics")} disabled={saving[leadWindow.id]}>Transfer To After Sales</button>
            ) : null}
            {(role === "Sales" || role === "Admin") && !dashboardReadOnly ? (
              <>
                <button type="button" className="brand-btn px-3 py-2 text-xs" onClick={() => doTransfer(leadWindow.id, "account")} disabled={saving[leadWindow.id]}>Transfer To Account</button>
                <button type="button" className="brand-btn px-3 py-2 text-xs" onClick={() => doTransfer(leadWindow.id, "logistics")} disabled={saving[leadWindow.id]}>Transfer To After Sales</button>
              </>
            ) : null}
            {role === "Logistics" && !dashboardReadOnly ? (
              <button type="button" className="mini-btn" onClick={() => addToFamily(leadWindow.id)} disabled={saving[leadWindow.id]}>Add to Family</button>
            ) : null}
            {role === "AccountManager" && !dashboardReadOnly ? (
              <button type="button" className="mini-btn" onClick={() => returnToSales(leadWindow.id)} disabled={saving[leadWindow.id]}>Return To Sales</button>
            ) : null}
            {role === "Insurance" ? (
              <button type="button" className="mini-btn" onClick={() => exportBasicAmPdf(leadWindow)}>Export</button>
            ) : null}
            <button type="button" className="mini-btn" onClick={() => removeLead(leadWindow.id)} disabled={saving[leadWindow.id] || role === "Insurance" || dashboardReadOnly}>Delete</button>
          </div>
        </ModalWindow>
      ) : null}

      {dayWindowDate ? (
        <ModalWindow title={`Activities: ${dayWindowDate}`} onClose={() => setDayWindowDate(null)}>
          <div className="space-y-2">
            {dayActivities.length === 0 ? <p className="text-sm text-gray-600">No activities for this day.</p> : null}
            {dayActivities.map((a) => (
              <article key={a.id} className="rounded-lg border border-gray-200 p-3">
                <p className="font-semibold">{a.title}</p>
                <p className="text-xs text-gray-600">{formatUiDateTime(a.startsAt)}</p>
                {a.note ? <p className="mt-1 text-sm text-gray-700">{a.note}</p> : null}
                <div className="mt-2 flex gap-2">
                  <button type="button" className="mini-btn" onClick={() => markDone(a.id)}>Mark Done</button>
                  <button type="button" className="mini-btn" onClick={() => removeActivity(a.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </ModalWindow>
      ) : null}

      {activityModalDate ? (
        <ModalWindow title={`Add Activity: ${activityModalDate}`} onClose={() => setActivityModalDate(null)}>
          <ActivityForm draft={activityDraft} setDraft={setActivityDraft} onSave={createActivity} saving={savingActivity} />
        </ModalWindow>
      ) : null}
    </section>
  );
}

function ModalWindow({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" className="mini-btn" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SearchBox({ query, setQuery, mode, setMode }: { query: string; setQuery: (v: string) => void; mode: SearchMode; setMode: (m: SearchMode) => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <Field label="Search by Name / Email / Phone" value={query} onChange={setQuery} />
      <div className="mt-2 flex flex-wrap gap-2">
        <FilterButton active={mode === "all"} label="All" onClick={() => setMode("all")} />
        <FilterButton active={mode === "name"} label="By Name" onClick={() => setMode("name")} />
        <FilterButton active={mode === "email"} label="By Email" onClick={() => setMode("email")} />
        <FilterButton active={mode === "phone"} label="By Phone" onClick={() => setMode("phone")} />
      </div>
    </div>
  );
}

function CollapsibleSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <button type="button" className="mini-btn" onClick={onToggle}>
          {open ? "Minimize" : "Open"}
        </button>
      </div>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

function ShowroomLeadCreateForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  uploadingShowroomContract,
  onShowroomContractUpload,
}: {
  draft: LeadDraft;
  setDraft: (fn: (s: LeadDraft) => LeadDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  uploadingShowroomContract: boolean;
  onShowroomContractUpload?: (files: File[]) => void;
}) {
  const [selectedOwnership, setSelectedOwnership] = useState<ShowroomOwnership | "">("");
  const clientOwned = selectedOwnership !== "" && isClientOwnedShowroomVehicle(selectedOwnership);

  useEffect(() => {
    if (!selectedOwnership) return;
    setDraft((current) => ({ ...current, showroomOwnership: selectedOwnership }));
  }, [selectedOwnership, setDraft]);

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="mb-2 text-sm font-semibold">Create New Showroom Lead</p>
      <div className="max-w-sm">
        <label>
          <span className="field-label">Ownership</span>
          <select
            value={selectedOwnership}
            onChange={(e) => setSelectedOwnership(e.target.value as ShowroomOwnership | "")}
            className="brand-input"
          >
            <option value="">Select ownership</option>
            <option value="Own">Own</option>
            <option value="Client">Client</option>
          </select>
        </label>
      </div>
      {selectedOwnership ? (
        <>
          <div className="mt-4 form-grid md:grid-cols-2">
            <Field label="Name" value={draft.fullName} onChange={(v) => setDraft((s) => ({ ...s, fullName: v }))} />
            <Field label="Phone" value={draft.phone} onChange={(v) => setDraft((s) => ({ ...s, phone: v }))} />
            <SelectField label="Package" value={draft.showroomPackage} options={showroomPackageOptions} onChange={(v) => setDraft((s) => ({ ...s, showroomPackage: v as ShowroomPackage }))} />
            <Field label="Brand" value={draft.brand} onChange={(v) => setDraft((s) => ({ ...s, brand: v }))} />
            <Field label="Model" value={draft.model} onChange={(v) => setDraft((s) => ({ ...s, model: v }))} />
            <Field label="Year" value={draft.firstRegistrationDate} onChange={(v) => setDraft((s) => ({ ...s, firstRegistrationDate: normalizeShowroomYear(v) }))} />
            <Field label="Engine" value={draft.engine} onChange={(v) => setDraft((s) => ({ ...s, engine: v }))} />
            <Field label="Mileage" value={draft.mileage} onChange={(v) => setDraft((s) => ({ ...s, mileage: v }))} />
            <Field label="VIN" value={draft.vin} onChange={(v) => setDraft((s) => ({ ...s, vin: v }))} />
            <TextField label="Service History" value={draft.serviceOfferDetails} onChange={(v) => setDraft((s) => ({ ...s, serviceOfferDetails: v }))} />
            <Field label="Origin" value={draft.purchaseLocation} onChange={(v) => setDraft((s) => ({ ...s, purchaseLocation: v }))} />
            <SelectField label="Warranty" value={draft.warranty} options={yesNoOptions} onChange={(v) => setDraft((s) => ({ ...s, warranty: v as YesNo }))} />
            <SelectField label="Inspected In Service" value={draft.inspection} options={yesNoOptions} onChange={(v) => setDraft((s) => ({ ...s, inspection: v as YesNo }))} />
            <Field label="Tires" value={draft.tiresInfo} onChange={(v) => setDraft((s) => ({ ...s, tiresInfo: v }))} />
            <TextField label="Description" value={draft.showroomDescription} onChange={(v) => setDraft((s) => ({ ...s, showroomDescription: v }))} />
            {clientOwned ? (
              <>
                <Field label="GO" value={draft.showroomGoPrice} onChange={(v) => setDraft((s) => ({ ...s, showroomGoPrice: v }))} />
                <Field label="CASCO" value={draft.showroomCascoPrice} onChange={(v) => setDraft((s) => ({ ...s, showroomCascoPrice: v }))} />
              </>
            ) : null}
            <SelectField label="Reserved" value={draft.showroomReserved} options={yesNoOptions} onChange={(v) => setDraft((s) => ({ ...s, showroomReserved: v as YesNo }))} />
            <SelectField label="Sold" value={draft.showroomSold} options={yesNoOptions} onChange={(v) => setDraft((s) => ({ ...s, showroomSold: v as YesNo }))} />
          </div>
          {clientOwned ? (
            <div className="mt-3">
              <DocumentDropzone
                title="Contract"
                documents={draft.showroomContract}
                uploading={uploadingShowroomContract}
                onUpload={(files) => onShowroomContractUpload?.(files)}
                onRemove={(documentId) => setDraft((s) => ({ ...s, showroomContract: s.showroomContract.filter((doc) => doc.id !== documentId) }))}
              />
            </div>
          ) : null}
        </>
      ) : null}
      <div className="mt-3 flex gap-2"><button type="button" onClick={onSave} className="brand-btn px-4 py-2 text-sm" disabled={!selectedOwnership}>Save Lead</button><button type="button" onClick={onCancel} className="mini-btn">Close</button></div>
    </div>
  );
}

function LeadCreateForm({ draft, setDraft, onSave, onCancel, isShowroomRole = false, uploadingShowroomContract = false, onShowroomContractUpload }: { draft: LeadDraft; setDraft: (fn: (s: LeadDraft) => LeadDraft) => void; onSave: () => void; onCancel: () => void; isShowroomRole?: boolean; uploadingShowroomContract?: boolean; onShowroomContractUpload?: (files: File[]) => void }) {
  if (isShowroomRole) {
    return (
      <ShowroomLeadCreateForm
        draft={draft}
        setDraft={setDraft}
        onSave={onSave}
        onCancel={onCancel}
        uploadingShowroomContract={uploadingShowroomContract}
        onShowroomContractUpload={onShowroomContractUpload}
      />
    );
  }

  if (isShowroomRole) {
    return (
      <div className="rounded-lg border border-gray-200 p-3">
        <p className="mb-2 text-sm font-semibold">Create New Showroom Lead</p>
        <div className="form-grid md:grid-cols-2">
          <Field label="Имена" value={draft.fullName} onChange={(v) => setDraft((s) => ({ ...s, fullName: v }))} />
          <Field label="Телефон" value={draft.phone} onChange={(v) => setDraft((s) => ({ ...s, phone: v }))} />
          <Field label="Марка" value={draft.brand} onChange={(v) => setDraft((s) => ({ ...s, brand: v }))} />
          <Field label="Модел" value={draft.model} onChange={(v) => setDraft((s) => ({ ...s, model: v }))} />
          <Field label="Година" value={draft.firstRegistrationDate} onChange={(v) => setDraft((s) => ({ ...s, firstRegistrationDate: normalizeShowroomYear(v) }))} />
          <Field label="Пробег" value={draft.mileage} onChange={(v) => setDraft((s) => ({ ...s, mileage: v }))} />
          <Field label="Кубатура" value={draft.engine} onChange={(v) => setDraft((s) => ({ ...s, engine: v }))} />
          <Field label="Мощност (hp)" value={draft.powerHp} onChange={(v) => setDraft((s) => ({ ...s, powerHp: v }))} />
          <Field label="Произход" value={draft.purchaseLocation} onChange={(v) => setDraft((s) => ({ ...s, purchaseLocation: v }))} />
          <TextField label="Сервизна история" value={draft.serviceOfferDetails} onChange={(v) => setDraft((s) => ({ ...s, serviceOfferDetails: v }))} />
          <SelectField label="Прегледана в сервиз" value={draft.inspection} options={yesNoOptions} onChange={(v) => setDraft((s) => ({ ...s, inspection: v as YesNo }))} />
          <Field label="Протокол (линк)" value={draft.inspectionProtocolLink} onChange={(v) => setDraft((s) => ({ ...s, inspectionProtocolLink: v }))} />
          <Field label="Оферта за обслужване (линк)" value={draft.serviceOfferLink} onChange={(v) => setDraft((s) => ({ ...s, serviceOfferLink: v }))} />
          <Field label="Cost Price" value={draft.deliveryPrice} onChange={(v) => setDraft((s) => ({ ...s, deliveryPrice: v }))} />
        </div>
        <div className="mt-3 flex gap-2"><button type="button" onClick={onSave} className="brand-btn px-4 py-2 text-sm">Save Lead</button><button type="button" onClick={onCancel} className="mini-btn">Close</button></div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="mb-2 text-sm font-semibold">Create New Lead</p>
      <div className="form-grid md:grid-cols-2">
        <Field label="Full Name" value={draft.fullName} onChange={(v) => setDraft((s) => ({ ...s, fullName: v }))} />
        <Field label="Phone" value={draft.phone} onChange={(v) => setDraft((s) => ({ ...s, phone: v }))} />
        <Field label="Email" value={draft.email} onChange={(v) => setDraft((s) => ({ ...s, email: v }))} />
        <Field label="EGN" value={draft.egn} onChange={(v) => setDraft((s) => ({ ...s, egn: v }))} />
        <Field label="Address" value={draft.address} onChange={(v) => setDraft((s) => ({ ...s, address: v }))} />
        <Field label="Vehicle Request" value={draft.vehicleRequest} onChange={(v) => setDraft((s) => ({ ...s, vehicleRequest: v }))} />
        <Field label="Created At" type="datetime-local" value={draft.createdAt} onChange={(v) => setDraft((s) => ({ ...s, createdAt: v }))} />
        <Field label="Contract Link" value={draft.contractLink} onChange={(v) => setDraft((s) => ({ ...s, contractLink: v }))} />
        <SelectField label="Source" value={draft.source} options={leadSourceOptions} onChange={(v) => setDraft((s) => ({ ...s, source: v as LeadSourceInput }))} />
        <TextField label="Handover Description" value={draft.handoverNote} onChange={(v) => setDraft((s) => ({ ...s, handoverNote: v }))} />
      </div>
      <div className="mt-3 flex gap-2"><button type="button" onClick={onSave} className="brand-btn px-4 py-2 text-sm">Save Lead</button><button type="button" onClick={onCancel} className="mini-btn">Close</button></div>
    </div>
  );
}

function DocumentDropzone({
  title,
  documents,
  uploading,
  onUpload,
  onRemove,
}: {
  title: string;
  documents: LeadDocument[];
  uploading: boolean;
  onUpload: (files: File[]) => void;
  onRemove?: (documentId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    onUpload(Array.from(files));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
      <div
        className="rounded-lg border border-gray-200 bg-white p-4 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-gray-600">Drag and drop file here or choose from your device.</p>
        <input ref={inputRef} type="file" className="hidden" onChange={(event) => handleFiles(event.target.files)} />
        <button type="button" className="mini-btn mt-3" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading..." : "Upload document"}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {documents.length === 0 ? <p className="text-xs text-gray-600">No uploaded files.</p> : null}
        {documents.map((document) => (
          <div key={document.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <a href={document.url} target="_blank" rel="noreferrer" className="truncate hover:underline">{document.name}</a>
            {onRemove ? <button type="button" className="mini-btn" onClick={() => onRemove(document.id)}>Remove</button> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityForm({ draft, setDraft, onSave, saving }: { draft: { title: string; note: string; date: string; hour: string; minute: string }; setDraft: (fn: (s: { title: string; note: string; date: string; hour: string; minute: string }) => { title: string; note: string; date: string; hour: string; minute: string }) => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="space-y-2">
        <Field label="Title" value={draft.title} onChange={(v) => setDraft((s) => ({ ...s, title: v }))} />
        <Field label="Note" value={draft.note} onChange={(v) => setDraft((s) => ({ ...s, note: v }))} />
        <SelectField label="Date" value={draft.date} options={next30Dates} onChange={(v) => setDraft((s) => ({ ...s, date: v }))} />
        <div className="grid grid-cols-2 gap-2">
          <SelectField label="Hour" value={draft.hour} options={activityHours} onChange={(v) => setDraft((s) => ({ ...s, hour: v }))} />
          <SelectField label="Minute" value={draft.minute} options={activityMinutes} onChange={(v) => setDraft((s) => ({ ...s, minute: v }))} />
        </div>
        <button type="button" onClick={onSave} className="brand-btn w-full px-3 py-2 text-sm" disabled={saving}>{saving ? "Saving..." : "Save Activity"}</button>
      </div>
    </div>
  );
}

function LeadHistoryCard({ events, noteEntries }: { events: LeadHistoryEvent[]; noteEntries: LeadNoteEntry[] }) {
  const historyRows = [...(events ?? [])].map((event) => ({
    id: `history-${event.id}`,
    at: event.at,
    actor: event.actor,
    kind: "history" as const,
    title: event.action,
    message: event.message,
  }));
  const noteRows = [...(noteEntries ?? [])].map((entry) => ({
    id: `note-${entry.id}`,
    at: entry.at,
    actor: entry.actor,
    kind: "note" as const,
    title: "note",
    message: entry.note,
  }));
  const rows = [...historyRows, ...noteRows].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="mb-2 text-sm font-semibold">Lead History</p>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-600">No lead history yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <article key={row.id} className="rounded-lg border border-gray-200 p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{row.actor || "System"}</span>
                <span className="text-xs text-gray-600">{formatUiDateTime(row.at)}</span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{row.title}</p>
              <p className="mt-1 text-sm text-gray-800">{row.message}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoReadOnlyCard({ lead }: { lead: LeadDto }) {
  const rows = [
    ["Name", lead.fullName],
    ["EGN", lead.egn || "-"],
    ["Phone", lead.phone],
    ["Email", lead.email || "-"],
    ["Address", lead.address || "-"],
    ["Vehicle Request", lead.vehicleRequest || "-"],
    ["Automobile", lead.car || "-"],
    ["Brand", lead.brand || "-"],
    ["Model", lead.model || "-"],
    ["Engine", lead.engine || "-"],
    ["VIN", lead.vin || "-"],
    ["Purchase Date", lead.purchaseDate || "-"],
    ["PickUp Date", lead.pickupDate || "-"],
    ["AM", lead.am || "-"],
    ["Referral", lead.referral || "-"],
    ["Discount", lead.discount || "-"],
    ["Client Discount", lead.clientDiscount || "-"],
    ["Subject", lead.memoSubject || "-"],
    ["Description", lead.memoDescription || "-"],
    ["Status", memoStatusLabel(lead.memoStatus)],
  ];

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <p key={label}>
            <strong>{label}:</strong> {value}
          </p>
        ))}
      </div>
      {lead.memoTeamLeadComment ? <p><strong>TeamLeadAM comment:</strong> {lead.memoTeamLeadComment}</p> : null}
      {lead.memoOperationComment ? <p><strong>OperationManager comment:</strong> {lead.memoOperationComment}</p> : null}
    </article>
  );
}

function MemoEventsTable({ events }: { events: MemoEvent[] }) {
  const rows = [...(events ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="mb-2 text-sm font-semibold">Memo History</p>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-600">No memo history yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="brand-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Actor</th>
                <th>Action</th>
                <th>From</th>
                <th>To</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr key={event.id}>
                  <td>{formatUiDateTime(event.at)}</td>
                  <td>{event.actorRole}</td>
                  <td>{event.action}</td>
                  <td>{memoStatusLabel(event.fromStatus)}</td>
                  <td>{memoStatusLabel(event.toStatus)}</td>
                  <td>{event.comment || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function memoStatusLabel(status: MemoStatus) {
  if (status === "pending_teamlead") return "Pending TeamLeadAM";
  if (status === "rejected_by_teamlead") return "Rejected by TeamLeadAM";
  if (status === "pending_operation") return "Pending OperationManager";
  if (status === "rejected_by_operation") return "Rejected by OperationManager";
  if (status === "approved") return "Approved for Payment";
  return "Not Submitted";
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return <article className="card p-3"><p className="text-xs text-gray-600">{title}</p><p className="mt-1 text-xl font-bold text-gray-900">{value}</p></article>;
}
function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`mini-btn ${active ? "border-[#b98e10] bg-[#fff7d8] text-[#8a6a08]" : ""}`}>{label}</button>;
}
function TableHeaderFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-1.5 text-[10px] leading-tight">
      <span className="shrink-0">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="brand-input h-6 min-w-0 w-[82px] px-1.5 py-0 text-[10px] leading-none">
        <option value="">All</option>
        {options.filter((option) => option !== "").map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
function Field({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange: (v: string) => void; type?: HTMLInputTypeAttribute; disabled?: boolean }) {
  return <label className={disabled ? "opacity-70" : ""}><span className="field-label">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="brand-input" /></label>;
}
function TextField({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return <label className={disabled ? "opacity-70" : ""}><span className="field-label">{label}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="brand-input min-h-20" /></label>;
}
function SelectField({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean }) {
  return <label className={disabled ? "opacity-70" : ""}><span className="field-label">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="brand-input">{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>;
}

