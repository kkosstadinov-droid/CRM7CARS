"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityDto } from "@/lib/activities";
import type { LeadDto } from "@/lib/leads";

const uiLocale = "bg-BG";
const uiTimeZone = "Europe/Sofia";

function inRange(iso: string, from: string, to: string) {
  if (!iso) return false;
  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return false;
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T23:59:59`).getTime();
  return value >= start && value <= end;
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
    return { day, iso: d.toISOString().slice(0, 10) };
  });
}

function localDateIso(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function dateIsoShift(days: number, fromIso: string) {
  const d = new Date(`${fromIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localDateIso(d);
}

function asNumber(value: string) {
  const normalized = String(value ?? "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function leadInsuranceMargin(lead: LeadDto) {
  return asNumber(lead.insuranceGoPrice) * 0.14 + asNumber(lead.insuranceCascoPrice) * 0.25;
}

function leadServiceMargin(lead: LeadDto) {
  return asNumber(lead.servicePrice) - asNumber(lead.serviceCostPrice);
}

function leadTiresMargin(lead: LeadDto) {
  return asNumber(lead.tiresPrice) - asNumber(lead.tiresCostPrice);
}

function hasAfterSalesActivityInRange(lead: LeadDto, from: string, to: string) {
  return inRange(lead.transferredToLogisticsAt, from, to) || inRange(lead.insuranceTouchedAt, from, to) || inRange(lead.serviceTouchedAt, from, to);
}

function formatUiDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(uiLocale, { dateStyle: "short", timeStyle: "short", timeZone: uiTimeZone }).format(date);
}

function formatUiMonth(date: Date) {
  return new Intl.DateTimeFormat(uiLocale, { month: "long", year: "numeric", timeZone: uiTimeZone }).format(date);
}

export function BossDashboard() {
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [month, setMonth] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState("");
  const [includeSynthetic, setIncludeSynthetic] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return localDateIso(d);
  });
  const [to, setTo] = useState(() => localDateIso());

  const reload = useCallback(async () => {
    const [lr, ar] = await Promise.all([fetch("/api/leads", { cache: "no-store" }), fetch("/api/activities", { cache: "no-store" })]);
    if (!lr.ok || !ar.ok) return;
    setLeads((await lr.json()) as LeadDto[]);
    setActivities((await ar.json()) as ActivityDto[]);
    setLastUpdated(formatUiDateTime(new Date().toISOString()));
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void reload(), 0);
    const timer = setInterval(() => void reload(), 15000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [reload]);

  const effectiveLeads = useMemo(() => {
    if (includeSynthetic) return leads;
    return leads.filter((lead) => !String(lead.id).startsWith("bulk_"));
  }, [includeSynthetic, leads]);

  const stats = useMemo(() => {
    const rangeDays = Math.max(0, Math.floor((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000));
    const prevTo = dateIsoShift(-1, from);
    const prevFrom = dateIsoShift(-(rangeDays + 1), from);

    const salesPipeline = effectiveLeads.filter((lead) => lead.handoverDepartment === "sales");
    const accountPipeline = effectiveLeads.filter((lead) => lead.handoverDepartment === "account");
    const salesContractLeads = salesPipeline.filter((lead) => lead.stage === "Message" || lead.stage === "Contract");
    const contractAuction = salesContractLeads.filter((lead) => lead.contractPackage === "Auction").length;
    const contractPlus = salesContractLeads.filter((lead) => lead.contractPackage === "Plus").length;
    const contractDiamond = salesContractLeads.filter((lead) => lead.contractPackage === "Diamond").length;
    const contractTotalPrice = salesContractLeads.reduce((sum, lead) => sum + asNumber(lead.contractPrice), 0);
    const salesEnteredInPeriod = effectiveLeads.filter((lead) => inRange(lead.createdAt, from, to));
    const salesMigratedInPeriod = effectiveLeads.filter((lead) => {
      if (inRange(lead.transferredToAccountAt, from, to)) return true;
      return !lead.transferredToAccountAt && lead.handoverDepartment !== "sales" && (lead.stage === "Message" || lead.stage === "Contract") && inRange(lead.createdAt, from, to);
    });
    const accountReceivedInPeriod = salesMigratedInPeriod.length;
    const operationApprovedInPeriod = effectiveLeads.filter((lead) => inRange(lead.operationApprovedAt, from, to)).length;

    const salesRows = [
      { label: "Active Leads In Sales Pipeline", value: salesPipeline.length },
      { label: "Status: New Lead", value: salesPipeline.filter((lead) => lead.stage === "New Lead").length },
      { label: "Status: Need Time", value: salesPipeline.filter((lead) => lead.stage === "Need Time").length },
      { label: "Status: No Answer", value: salesPipeline.filter((lead) => lead.stage === "No Answer").length },
      { label: "Status: W/o Potential", value: salesPipeline.filter((lead) => lead.stage === "W/o Potential").length },
      { label: "Status: Potential", value: salesPipeline.filter((lead) => lead.stage === "Potential").length },
      { label: "Status: Message", value: salesPipeline.filter((lead) => lead.stage === "Message").length },
      { label: "Status: Contract", value: salesPipeline.filter((lead) => lead.stage === "Contract").length },
      { label: "Contract Package: Auction", value: contractAuction },
      { label: "Contract Package: Plus", value: contractPlus },
      { label: "Contract Package: Diamond", value: contractDiamond },
      { label: "Contract Total Price (EUR)", value: Math.round(contractTotalPrice) },
      { label: "Contracts Migrated To Account", value: salesMigratedInPeriod.length },
      { label: "Sales Success Rate %", value: salesEnteredInPeriod.length ? Math.round((salesMigratedInPeriod.length / salesEnteredInPeriod.length) * 100) : 0 },
    ];

    const accountRows = [
      { label: "Active Leads In Account Pipeline", value: accountPipeline.length },
      { label: "Status: Need Time", value: accountPipeline.filter((lead) => lead.stage === "Need Time").length },
      { label: "Status: No Answer", value: accountPipeline.filter((lead) => lead.stage === "No Answer").length },
      { label: "Status: W/o Potential", value: accountPipeline.filter((lead) => lead.stage === "W/o Potential").length },
      { label: "Status: Potential", value: accountPipeline.filter((lead) => lead.stage === "Potential").length },
      { label: "Status: Message", value: accountPipeline.filter((lead) => lead.stage === "Message").length },
      { label: "Status: Contract", value: accountPipeline.filter((lead) => lead.stage === "Contract").length },
      { label: "Approvals From OperationManager", value: operationApprovedInPeriod },
      { label: "Account Success Rate %", value: accountReceivedInPeriod ? Math.round((operationApprovedInPeriod / accountReceivedInPeriod) * 100) : 0 },
    ];

    const teamLeadEntries = effectiveLeads.flatMap((lead) => lead.memoEvents.filter((event) => event.toStatus === "pending_teamlead").map((event) => event.at));
    const operationEntries = effectiveLeads.flatMap((lead) => lead.memoEvents.filter((event) => event.toStatus === "pending_operation").map((event) => event.at));
    const otherRows = [
      { label: "Sales Entered (period)", value: salesEnteredInPeriod.length },
      { label: "Account Received (period)", value: accountReceivedInPeriod },
      { label: "TeamLeadAM", value: teamLeadEntries.filter((at) => inRange(at, from, to)).length },
      { label: "OperationManager", value: operationEntries.filter((at) => inRange(at, from, to)).length },
      { label: "Logistics", value: effectiveLeads.filter((lead) => inRange(lead.transferredToLogisticsAt, from, to)).length },
      { label: "Insurance", value: effectiveLeads.filter((lead) => inRange(lead.insuranceTouchedAt, from, to)).length },
      { label: "Service", value: effectiveLeads.filter((lead) => inRange(lead.serviceTouchedAt, from, to)).length },
      { label: "Service Offer Uploads", value: effectiveLeads.filter((lead) => inRange(lead.serviceOfferUploadedAt, from, to)).length },
      { label: "Inspection Protocol Uploads", value: effectiveLeads.filter((lead) => inRange(lead.inspectionProtocolUploadedAt, from, to)).length },
    ];

    const salesMigratedPrev = effectiveLeads.filter((lead) => {
      if (inRange(lead.transferredToAccountAt, prevFrom, prevTo)) return true;
      return !lead.transferredToAccountAt && lead.handoverDepartment !== "sales" && (lead.stage === "Message" || lead.stage === "Contract") && inRange(lead.createdAt, prevFrom, prevTo);
    });
    const salesEnteredPrev = effectiveLeads.filter((lead) => inRange(lead.createdAt, prevFrom, prevTo));
    const accountReceivedPrev = salesMigratedPrev.length;
    const operationApprovedPrev = effectiveLeads.filter((lead) => inRange(lead.operationApprovedAt, prevFrom, prevTo)).length;

    const prevSalesRows = [
      { label: "Active Leads In Sales Pipeline", value: salesPipeline.length },
      { label: "Status: New Lead", value: salesPipeline.filter((lead) => lead.stage === "New Lead").length },
      { label: "Status: Need Time", value: salesPipeline.filter((lead) => lead.stage === "Need Time").length },
      { label: "Status: No Answer", value: salesPipeline.filter((lead) => lead.stage === "No Answer").length },
      { label: "Status: W/o Potential", value: salesPipeline.filter((lead) => lead.stage === "W/o Potential").length },
      { label: "Status: Potential", value: salesPipeline.filter((lead) => lead.stage === "Potential").length },
      { label: "Status: Message", value: salesPipeline.filter((lead) => lead.stage === "Message").length },
      { label: "Status: Contract", value: salesPipeline.filter((lead) => lead.stage === "Contract").length },
      { label: "Contract Package: Auction", value: contractAuction },
      { label: "Contract Package: Plus", value: contractPlus },
      { label: "Contract Package: Diamond", value: contractDiamond },
      { label: "Contract Total Price (EUR)", value: Math.round(contractTotalPrice) },
      { label: "Contracts Migrated To Account", value: salesMigratedPrev.length },
      { label: "Sales Success Rate %", value: salesEnteredPrev.length ? Math.round((salesMigratedPrev.length / salesEnteredPrev.length) * 100) : 0 },
    ];
    const prevAccountRows = [
      { label: "Active Leads In Account Pipeline", value: accountPipeline.length },
      { label: "Status: Need Time", value: accountPipeline.filter((lead) => lead.stage === "Need Time").length },
      { label: "Status: No Answer", value: accountPipeline.filter((lead) => lead.stage === "No Answer").length },
      { label: "Status: W/o Potential", value: accountPipeline.filter((lead) => lead.stage === "W/o Potential").length },
      { label: "Status: Potential", value: accountPipeline.filter((lead) => lead.stage === "Potential").length },
      { label: "Status: Message", value: accountPipeline.filter((lead) => lead.stage === "Message").length },
      { label: "Status: Contract", value: accountPipeline.filter((lead) => lead.stage === "Contract").length },
      { label: "Approvals From OperationManager", value: operationApprovedPrev },
      { label: "Account Success Rate %", value: accountReceivedPrev ? Math.round((operationApprovedPrev / accountReceivedPrev) * 100) : 0 },
    ];
    const prevOtherRows = [
      { label: "Sales Entered (period)", value: salesEnteredPrev.length },
      { label: "Account Received (period)", value: accountReceivedPrev },
      { label: "TeamLeadAM", value: teamLeadEntries.filter((at) => inRange(at, prevFrom, prevTo)).length },
      { label: "OperationManager", value: operationEntries.filter((at) => inRange(at, prevFrom, prevTo)).length },
      { label: "Logistics", value: effectiveLeads.filter((lead) => inRange(lead.transferredToLogisticsAt, prevFrom, prevTo)).length },
      { label: "Insurance", value: effectiveLeads.filter((lead) => inRange(lead.insuranceTouchedAt, prevFrom, prevTo)).length },
      { label: "Service", value: effectiveLeads.filter((lead) => inRange(lead.serviceTouchedAt, prevFrom, prevTo)).length },
      { label: "Service Offer Uploads", value: effectiveLeads.filter((lead) => inRange(lead.serviceOfferUploadedAt, prevFrom, prevTo)).length },
      { label: "Inspection Protocol Uploads", value: effectiveLeads.filter((lead) => inRange(lead.inspectionProtocolUploadedAt, prevFrom, prevTo)).length },
    ];

    const currentAfterSalesLeads = effectiveLeads.filter((lead) => hasAfterSalesActivityInRange(lead, from, to));
    const previousAfterSalesLeads = effectiveLeads.filter((lead) => hasAfterSalesActivityInRange(lead, prevFrom, prevTo));

    const insuranceMarginCurrent = currentAfterSalesLeads.reduce((sum, lead) => sum + leadInsuranceMargin(lead), 0);
    const serviceMarginCurrent = currentAfterSalesLeads.reduce((sum, lead) => sum + leadServiceMargin(lead), 0);
    const tiresMarginCurrent = currentAfterSalesLeads.reduce((sum, lead) => sum + leadTiresMargin(lead), 0);
    const insuranceMarginPrev = previousAfterSalesLeads.reduce((sum, lead) => sum + leadInsuranceMargin(lead), 0);
    const serviceMarginPrev = previousAfterSalesLeads.reduce((sum, lead) => sum + leadServiceMargin(lead), 0);
    const tiresMarginPrev = previousAfterSalesLeads.reduce((sum, lead) => sum + leadTiresMargin(lead), 0);

    const afterSalesMarginRows = [
      { label: "Insurance Margin", value: insuranceMarginCurrent },
      { label: "Service Margin", value: serviceMarginCurrent },
      { label: "Tires/Wheels Margin", value: tiresMarginCurrent },
      { label: "Total AfterSales Margin", value: insuranceMarginCurrent + serviceMarginCurrent + tiresMarginCurrent },
    ];
    const prevAfterSalesMarginRows = [
      { label: "Insurance Margin", value: insuranceMarginPrev },
      { label: "Service Margin", value: serviceMarginPrev },
      { label: "Tires/Wheels Margin", value: tiresMarginPrev },
      { label: "Total AfterSales Margin", value: insuranceMarginPrev + serviceMarginPrev + tiresMarginPrev },
    ];

    return {
      salesRows,
      accountRows,
      otherRows,
      afterSalesMarginRows,
      prevSalesRows,
      prevAccountRows,
      prevOtherRows,
      prevAfterSalesMarginRows,
      prevFrom,
      prevTo,
      maxSales: Math.max(1, ...salesRows.map((row) => row.value)),
      maxAccount: Math.max(1, ...accountRows.map((row) => row.value)),
      maxOther: Math.max(1, ...otherRows.map((row) => row.value)),
      maxAfterSalesMargin: Math.max(1, ...afterSalesMarginRows.map((row) => Math.abs(row.value))),
    };
  }, [effectiveLeads, from, to]);

  const calendarActivities = useMemo(
    () => activities.filter((activity) => inRange(activity.startsAt, from, to)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [activities, from, to],
  );
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const activity of calendarActivities) {
      const key = activity.startsAt.slice(0, 10);
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [calendarActivities]);
  const cells = useMemo(() => makeGrid(month), [month]);

  function exportCsv() {
    const salesHeader = "Sales Metric,Count";
    const salesRows = stats.salesRows.map((row) => `${csvCell(row.label)},${row.value}`);
    const accountHeader = "Account Metric,Count";
    const accountRows = stats.accountRows.map((row) => `${csvCell(row.label)},${row.value}`);
    const otherHeader = "Other Metric,Count";
    const otherRows = stats.otherRows.map((row) => `${csvCell(row.label)},${row.value}`);
    const afterSalesMarginHeader = "AfterSales Margin Metric,EUR";
    const afterSalesMarginRows = stats.afterSalesMarginRows.map((row) => `${csvCell(row.label)},${row.value.toFixed(2)}`);
    const activitiesHeader = "Activity Title,Department,Starts At,Status";
    const activityRows = calendarActivities.map((activity) =>
      [activity.title, activity.department, formatUiDateTime(activity.startsAt), activity.status].map(csvCell).join(","),
    );
    const lines = [
      `Period From,${csvCell(from)}`,
      `Period To,${csvCell(to)}`,
      `Include Synthetic Data,${includeSynthetic ? "Yes" : "No"}`,
      "",
      salesHeader,
      ...salesRows,
      "",
      accountHeader,
      ...accountRows,
      "",
      otherHeader,
      ...otherRows,
      "",
      afterSalesMarginHeader,
      ...afterSalesMarginRows,
      "",
      activitiesHeader,
      ...activityRows,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `boss-stats-${from}-to-${to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-5">
      <section className="module-shell">
        <div className="module-header">
          <h2 className="module-title">Boss Statistics</h2>
          <span className="badge brand-chip">Pipeline Events</span>
        </div>
        <div className="module-body space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="field-label">From</span>
              <input className="brand-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              <span className="field-label">To</span>
              <input className="brand-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={includeSynthetic} onChange={(e) => setIncludeSynthetic(e.target.checked)} />
            Include synthetic load data
          </label>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">Last update: {lastUpdated || "..."}</p>
            <div className="flex gap-2">
              <button type="button" className="mini-btn" onClick={() => void reload()}>
                Refresh
              </button>
              <button type="button" className="brand-btn px-4 py-2 text-sm" onClick={exportCsv}>
              Export CSV
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <StatsTable title="Sales" rows={stats.salesRows} max={stats.maxSales} />
            <AchievementTable title="Sales Achievement" current={stats.salesRows} previous={stats.prevSalesRows} prevFrom={stats.prevFrom} prevTo={stats.prevTo} />
            <StatsTable title="AccountManager" rows={stats.accountRows} max={stats.maxAccount} />
            <AchievementTable title="Account Achievement" current={stats.accountRows} previous={stats.prevAccountRows} prevFrom={stats.prevFrom} prevTo={stats.prevTo} />
            <StatsTable title="Other Levels" rows={stats.otherRows} max={stats.maxOther} />
            <AchievementTable title="Other Levels Achievement" current={stats.otherRows} previous={stats.prevOtherRows} prevFrom={stats.prevFrom} prevTo={stats.prevTo} />
            <MoneyStatsTable title="AfterSales Margin (EUR)" rows={stats.afterSalesMarginRows} max={stats.maxAfterSalesMargin} />
            <MoneyAchievementTable title="AfterSales Margin Achievement (EUR)" current={stats.afterSalesMarginRows} previous={stats.prevAfterSalesMarginRows} prevFrom={stats.prevFrom} prevTo={stats.prevTo} />
            <div className="grid gap-4 md:grid-cols-3">
              <ChartCard title="Sales Chart" rows={stats.salesRows} max={stats.maxSales} />
              <ChartCard title="Account Chart" rows={stats.accountRows} max={stats.maxAccount} />
              <ChartCard title="Other Levels Chart" rows={stats.otherRows} max={stats.maxOther} />
            </div>
            <div className="grid gap-4 md:grid-cols-1">
              <MoneyChartCard title="AfterSales Margin Chart (EUR)" rows={stats.afterSalesMarginRows} max={stats.maxAfterSalesMargin} />
            </div>
          </div>
        </div>
      </section>

      <section className="module-shell">
        <div className="module-header">
          <h2 className="module-title">Month Calendar</h2>
          <span className="badge brand-chip">Activities</span>
        </div>
        <div className="module-body space-y-3">
          <div className="flex items-center justify-between">
            <button type="button" className="mini-btn" onClick={() => setMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}>
              Prev
            </button>
            <p className="text-sm font-semibold">{formatUiMonth(month)}</p>
            <button type="button" className="mini-btn" onClick={() => setMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}>
              Next
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-600"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => (
              <div key={`${c.iso ?? "empty"}-${i}`} className="min-h-14 rounded border border-gray-200 p-1 text-left text-xs">
                {c.day ? (
                  <>
                    <p>{c.day}</p>
                    {c.iso && counts[c.iso] ? <p className="mt-1 rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-700">{counts[c.iso]} act</p> : null}
                  </>
                ) : null}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Activities In Period</p>
            {calendarActivities.length === 0 ? <p className="text-sm text-gray-600">No activities for selected period.</p> : null}
            {calendarActivities.slice(0, 8).map((activity) => (
              <article key={activity.id} className="rounded-lg border border-gray-200 p-3">
                <p className="font-semibold">{activity.title}</p>
                <p className="text-xs text-gray-600">{formatUiDateTime(activity.startsAt)}</p>
                {activity.note ? <p className="mt-1 text-sm text-gray-700">{activity.note}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function StatsTable({ title, rows, max }: { title: string; rows: Array<{ label: string; value: number }>; max: number }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <table className="brand-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Count</th>
            <th>Graph</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.label}`}>
              <td>{row.label}</td>
              <td>{row.value}</td>
              <td>
                <div className="h-3 rounded bg-gray-100">
                  <div className="h-3 rounded bg-[#b98e10]" style={{ width: `${(row.value / max) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartCard({ title, rows, max }: { title: string; rows: Array<{ label: string; value: number }>; max: number }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={`${title}-${row.label}`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="truncate text-xs text-gray-700">{row.label}</p>
              <p className="text-xs font-semibold">{row.value}</p>
            </div>
            <div className="h-2 rounded bg-gray-100">
              <div className="h-2 rounded bg-[#0d1242]" style={{ width: `${(row.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function AchievementTable({
  title,
  current,
  previous,
  prevFrom,
  prevTo,
}: {
  title: string;
  current: Array<{ label: string; value: number }>;
  previous: Array<{ label: string; value: number }>;
  prevFrom: string;
  prevTo: string;
}) {
  const previousMap = new Map(previous.map((row) => [row.label, row.value]));
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm font-semibold">
        {title} (vs {prevFrom} to {prevTo})
      </p>
      <table className="brand-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Current</th>
            <th>Previous</th>
            <th>Delta</th>
            <th>Achievement</th>
          </tr>
        </thead>
        <tbody>
          {current.map((row) => {
            const prev = previousMap.get(row.label) ?? 0;
            const delta = row.value - prev;
            const percent = prev === 0 ? (row.value > 0 ? 100 : 0) : Math.round((delta / prev) * 100);
            const good = delta >= 0;
            return (
              <tr key={`${title}-${row.label}`}>
                <td>{row.label}</td>
                <td>{row.value}</td>
                <td>{prev}</td>
                <td className={good ? "text-green-700" : "text-red-700"}>{delta > 0 ? `+${delta}` : delta}</td>
                <td className={good ? "text-green-700" : "text-red-700"}>{percent > 0 ? `+${percent}%` : `${percent}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(value);
}

function MoneyStatsTable({ title, rows, max }: { title: string; rows: Array<{ label: string; value: number }>; max: number }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <table className="brand-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Amount</th>
            <th>Graph</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.label}`}>
              <td>{row.label}</td>
              <td>{money(row.value)}</td>
              <td>
                <div className="h-3 rounded bg-gray-100">
                  <div className="h-3 rounded bg-[#b98e10]" style={{ width: `${(Math.abs(row.value) / max) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoneyChartCard({ title, rows, max }: { title: string; rows: Array<{ label: string; value: number }>; max: number }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={`${title}-${row.label}`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="truncate text-xs text-gray-700">{row.label}</p>
              <p className="text-xs font-semibold">{money(row.value)}</p>
            </div>
            <div className="h-2 rounded bg-gray-100">
              <div className="h-2 rounded bg-[#0d1242]" style={{ width: `${(Math.abs(row.value) / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function MoneyAchievementTable({
  title,
  current,
  previous,
  prevFrom,
  prevTo,
}: {
  title: string;
  current: Array<{ label: string; value: number }>;
  previous: Array<{ label: string; value: number }>;
  prevFrom: string;
  prevTo: string;
}) {
  const previousMap = new Map(previous.map((row) => [row.label, row.value]));
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm font-semibold">
        {title} (vs {prevFrom} to {prevTo})
      </p>
      <table className="brand-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Current</th>
            <th>Previous</th>
            <th>Delta</th>
            <th>Achievement</th>
          </tr>
        </thead>
        <tbody>
          {current.map((row) => {
            const prev = previousMap.get(row.label) ?? 0;
            const delta = row.value - prev;
            const percent = prev === 0 ? (row.value > 0 ? 100 : 0) : Math.round((delta / prev) * 100);
            const good = delta >= 0;
            return (
              <tr key={`${title}-${row.label}`}>
                <td>{row.label}</td>
                <td>{money(row.value)}</td>
                <td>{money(prev)}</td>
                <td className={good ? "text-green-700" : "text-red-700"}>{delta > 0 ? `+${money(delta)}` : money(delta)}</td>
                <td className={good ? "text-green-700" : "text-red-700"}>{percent > 0 ? `+${percent}%` : `${percent}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
