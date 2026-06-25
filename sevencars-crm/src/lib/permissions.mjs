const statusManagerRoles = new Set(["Boss", "TeamLeadAM", "OperationManager"]);
const documentReaderRoles = new Set(["AccountManager", "TeamLeadAM", "OperationManager", "Boss"]);
const userManagerRoles = new Set(["OperationManager", "Boss", "Admin"]);
const dashboardRoles = new Set(["OperationManager", "Boss", "Admin"]);
const allRoles = new Set(["Admin", "Boss", "Sales", "AccountManager", "TeamLeadAM", "OperationManager", "Logistics", "Service", "Insurance", "Showroom"]);

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function canChangeLeadStatus(session) {
  return statusManagerRoles.has(session?.role);
}

export function canDeleteLead(session) {
  return statusManagerRoles.has(session?.role);
}

export function canSeeDocuments(session) {
  return documentReaderRoles.has(session?.role);
}

export function canEditLeadPrice(session) {
  return allRoles.has(session?.role);
}

export function canCreateUsers(session) {
  return userManagerRoles.has(session?.role);
}

export function canSeeDashboard(session) {
  return dashboardRoles.has(session?.role);
}

export function isLeadAssignedToUser(lead, username) {
  const user = normalize(username);
  if (!user) return false;
  return [lead?.assignedTo, lead?.salesOwner, lead?.lastUpdatedBy]
    .map(normalize)
    .filter(Boolean)
    .includes(user);
}

export function canViewLead(session, lead) {
  if (!session) return false;
  if (session.role === "Sales") return isLeadAssignedToUser(lead, session.username);
  return allRoles.has(session.role);
}

export function filterVisibleLeads(session, leads) {
  if (!Array.isArray(leads)) return [];
  return leads.filter((lead) => canViewLead(session, lead)).map((lead) => sanitizeLeadForRole(session, lead));
}

export function sanitizeLeadForRole(session, lead) {
  if (!lead || canSeeDocuments(session, lead)) return lead;
  return {
    ...lead,
    accountDocuments: [],
    showroomContract: [],
  };
}

const statusFields = new Set(["stage", "handoverDepartment", "transferredToAccountAt", "transferredToLogisticsAt", "operationApprovedAt", "returnToSalesComment"]);
const documentFields = new Set(["accountDocuments", "showroomContract", "contractLink", "memoContractLink", "serviceOfferLink", "inspectionProtocolLink"]);
const priceFields = new Set([
  "budget",
  "discount",
  "clientDiscount",
  "contractPrice",
  "deliveryPrice",
  "insuranceGoPrice",
  "insuranceCascoPrice",
  "serviceCostPrice",
  "servicePrice",
  "detailingPrice",
  "tiresCostPrice",
  "tiresPrice",
]);

export function forbiddenLeadPatchFields(session, patch, currentLead) {
  const forbidden = [];
  for (const key of Object.keys(patch ?? {})) {
    if (statusFields.has(key) && !canChangeLeadStatus(session, currentLead)) forbidden.push(key);
    if (documentFields.has(key) && !canSeeDocuments(session, currentLead)) forbidden.push(key);
    if (priceFields.has(key) && !canEditLeadPrice(session, currentLead)) forbidden.push(key);
  }
  return [...new Set(forbidden)];
}

export function permissionDenied(message = "Forbidden") {
  return { error: message };
}
