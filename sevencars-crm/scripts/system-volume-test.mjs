import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const monthlyProfile = Object.freeze({
  incomingLeads: 800,
  searchContracts: 80,
  orderedPurchases: 60,
  resaleIntake: 10,
  resaleSold: 10,
});

const team = Object.freeze({
  sales: ["sales1", "sales2", "sales3", "sales4"],
  accountManagers: ["am1", "am2", "am3", "am4", "am5", "am6"],
  teamLeadAM: ["teamleadam1"],
  operationManagers: ["op1", "op2"],
  logistics: ["logistics1", "logistics2"],
  service: ["service1", "service2"],
  insurance: ["insurance1", "insurance2"],
  management: ["HVitanov", "boss2"],
});

function roundRobin(items, index) {
  return items[index % items.length];
}

function createLead(index) {
  const isSearchContract = index < monthlyProfile.searchContracts;
  const isOrderedPurchase = index < monthlyProfile.orderedPurchases;
  const resaleIndex = index - monthlyProfile.searchContracts;
  const isResaleIntake = resaleIndex >= 0 && resaleIndex < monthlyProfile.resaleIntake;
  const isResaleSold = isResaleIntake && resaleIndex < monthlyProfile.resaleSold;
  const handoverDepartment = isResaleIntake ? "showroom" : isOrderedPurchase ? "logistics" : isSearchContract ? "account" : "sales";
  const stage = isOrderedPurchase || isSearchContract ? "Contract" : index % 5 === 0 ? "Potential" : "New Lead";
  const salesOwner = roundRobin(team.sales, index);
  const am = isSearchContract ? roundRobin(team.accountManagers, index) : "";

  return {
    id: `sys_lead_${String(index + 1).padStart(4, "0")}`,
    fullName: `System Test Client ${index + 1}`,
    phone: `+359888${String(index + 1).padStart(6, "0")}`,
    email: `client${index + 1}@example.test`,
    vehicleRequest: index % 3 === 0 ? "BMW X5 2022" : index % 3 === 1 ? "Mercedes GLE 2021" : "Audi Q7 2020",
    handoverDepartment,
    salesOwner,
    assignedTo: isSearchContract ? am : salesOwner,
    am,
    source: ["call", "facebook", "instagram", "whatsapp", "viber", "mail", "other"][index % 7],
    stage,
    contractPackage: isSearchContract ? ["Auction", "Plus", "Diamond"][index % 3] : "",
    contractPrice: isSearchContract ? String(1500 + (index % 6) * 250) : "",
    purchaseDate: isOrderedPurchase ? "2026-06-15" : "",
    showroomOwnership: isResaleIntake ? "Own" : "Client",
    showroomReserved: isResaleIntake && !isResaleSold ? "Yes" : "No",
    showroomSold: isResaleSold ? "Yes" : "No",
    brand: ["BMW", "Mercedes", "Audi", "VW"][index % 4],
    model: ["X5", "GLE", "Q7", "Touareg"][index % 4],
    firstRegistrationDate: String(2018 + (index % 7)),
    budget: String(25000 + (index % 40) * 1000),
    createdAt: new Date(Date.UTC(2026, 5, 1 + (index % 30), 9 + (index % 9))).toISOString(),
  };
}

function groupCount(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function simulateListQueries(leads) {
  const durations = [];
  const queryResults = {};
  const queries = [
    ["all", () => leads],
    ["sales1-visible", () => leads.filter((lead) => lead.salesOwner === "sales1" || lead.assignedTo === "sales1")],
    ["account", () => leads.filter((lead) => lead.handoverDepartment === "account")],
    ["logistics", () => leads.filter((lead) => lead.handoverDepartment === "logistics")],
    ["showroom", () => leads.filter((lead) => lead.handoverDepartment === "showroom")],
    ["contracts", () => leads.filter((lead) => lead.stage === "Contract")],
    ["resale-sold", () => leads.filter((lead) => lead.showroomSold === "Yes")],
  ];

  for (let repeat = 0; repeat < 100; repeat += 1) {
    for (const [name, fn] of queries) {
      const started = performance.now();
      const result = fn();
      durations.push(performance.now() - started);
      queryResults[name] = result.length;
    }
  }

  return { queryResults, p95Ms: percentile(durations, 0.95), maxMs: Math.max(...durations) };
}

const started = performance.now();
const leads = Array.from({ length: monthlyProfile.incomingLeads }, (_, index) => createLead(index));
const generatedMs = performance.now() - started;

assert.equal(leads.length, monthlyProfile.incomingLeads, "Should generate exact incoming lead count");
assert.equal(new Set(leads.map((lead) => lead.id)).size, monthlyProfile.incomingLeads, "Lead IDs must be unique");
assert.equal(leads.filter((lead) => lead.contractPackage).length, monthlyProfile.searchContracts, "Search contract count mismatch");
assert.equal(leads.filter((lead) => lead.purchaseDate).length, monthlyProfile.orderedPurchases, "Ordered purchase count mismatch");
assert.equal(leads.filter((lead) => lead.handoverDepartment === "showroom" && lead.showroomOwnership === "Own").length, monthlyProfile.resaleIntake, "Resale intake count mismatch");
assert.equal(leads.filter((lead) => lead.showroomSold === "Yes").length, monthlyProfile.resaleSold, "Resale sold count mismatch");
assert.ok(leads.every((lead) => team.sales.includes(lead.salesOwner)), "Every lead should have one of 4 Sales owners");
assert.ok(leads.filter((lead) => lead.contractPackage).every((lead) => team.accountManagers.includes(lead.am)), "Every search contract should have one of 6 AM owners");

const bySales = groupCount(leads, (lead) => lead.salesOwner);
const byAccountManager = groupCount(leads.filter((lead) => lead.contractPackage), (lead) => lead.am);
assert.deepEqual(Object.keys(bySales).sort(), team.sales.toSorted(), "All 4 Sales users should receive leads");
assert.deepEqual(Object.keys(byAccountManager).sort(), team.accountManagers.toSorted(), "All 6 AccountManagers should receive contracts");
assert.ok(Math.max(...Object.values(bySales)) - Math.min(...Object.values(bySales)) <= 1, "Sales distribution should be balanced");
assert.ok(Math.max(...Object.values(byAccountManager)) - Math.min(...Object.values(byAccountManager)) <= 1, "AM contract distribution should be balanced");

const conversion = {
  leadToSearchContractPct: (monthlyProfile.searchContracts / monthlyProfile.incomingLeads) * 100,
  searchContractToPurchasePct: (monthlyProfile.orderedPurchases / monthlyProfile.searchContracts) * 100,
  resaleSellThroughPct: (monthlyProfile.resaleSold / monthlyProfile.resaleIntake) * 100,
};
assert.equal(conversion.leadToSearchContractPct, 10, "Expected 10% lead-to-search-contract conversion");
assert.equal(conversion.searchContractToPurchasePct, 75, "Expected 75% search-contract-to-purchase conversion");
assert.equal(conversion.resaleSellThroughPct, 100, "Expected 100% monthly resale sell-through for provided profile");

const { queryResults, p95Ms, maxMs } = simulateListQueries(leads);
assert.equal(queryResults.all, 800, "All query should return 800 leads");
assert.equal(queryResults.account, 20, "Account handover should include contracts not already purchased/logistics");
assert.equal(queryResults.logistics, 60, "Logistics handover should include ordered purchases");
assert.equal(queryResults.showroom, 10, "Showroom handover should include resale intake");
assert.equal(queryResults.contracts, 80, "Contract stage should include all search contracts");
assert.equal(queryResults["resale-sold"], 10, "Sold resale query should include 10 cars");
assert.ok(p95Ms < 5, `In-memory query p95 too slow: ${p95Ms.toFixed(3)}ms`);

console.log(JSON.stringify({
  profile: monthlyProfile,
  teamShape: Object.fromEntries(Object.entries(team).map(([key, value]) => [key, value.length])),
  totals: {
    leads: leads.length,
    searchContracts: leads.filter((lead) => lead.contractPackage).length,
    orderedPurchases: leads.filter((lead) => lead.purchaseDate).length,
    resaleIntake: leads.filter((lead) => lead.handoverDepartment === "showroom" && lead.showroomOwnership === "Own").length,
    resaleSold: leads.filter((lead) => lead.showroomSold === "Yes").length,
  },
  conversion,
  distribution: { bySales, byAccountManager },
  queryResults,
  performance: {
    generatedMs: Number(generatedMs.toFixed(3)),
    queryP95Ms: Number(p95Ms.toFixed(3)),
    queryMaxMs: Number(maxMs.toFixed(3)),
  },
}, null, 2));
