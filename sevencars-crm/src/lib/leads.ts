export type LeadStage = "New leed" | "Contacted" | "No Answer" | "Faild" | "Potential" | "Contract";
export type YesNo = "Yes" | "No";
export type RegistrationStatus = "Yes" | "Yes transit" | "No";
export type ContractPackage = "" | "Auction" | "Plus" | "Diamond";
export type MemoStatus = "none" | "pending_teamlead" | "rejected_by_teamlead" | "pending_operation" | "rejected_by_operation" | "approved";

export type LeadSourceInput = "call" | "mail" | "whatsapp" | "viber" | "facebook" | "instagram" | "other";
export type MemoActorRole = "AccountManager" | "TeamLeadAM" | "OperationManager";
export type MemoEventAction = "submitted" | "rejected" | "approved";
export type MemoEvent = {
  id: string;
  at: string;
  actorRole: MemoActorRole;
  action: MemoEventAction;
  fromStatus: MemoStatus;
  toStatus: MemoStatus;
  comment: string;
};

export type LeadDto = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  egn: string;
  address: string;
  vehicleRequest: string;
  contractLink: string;
  handoverNote: string;
  handoverDepartment: "sales" | "account" | "logistics" | "showroom";
  isFamily: boolean;
  familyAt: string;
  lastUpdatedBy: string;
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
  keylessStart: YesNo;
  weight: string;
  color: string;
  powerKw: string;
  powerHp: string;
  seatsCount: string;
  doorsCount: string;
  vin: string;
  serviced: YesNo;
  servicedDate: string;
  secondKey: YesNo;
  secondTireSet: YesNo;
  purchaseLocation: string;
  vatKey: string;
  deliveryPrice: string;
  warranty: YesNo;
  insuranceInfo: string;
  insuranceGoPrice: string;
  insuranceCascoPrice: string;
  insuranceAccepted: YesNo;
  registrationInfo: string;
  registrationAccepted: YesNo;
  serviceOfferDetails: string;
  serviceCostPrice: string;
  servicePrice: string;
  serviceOfferAccepted: YesNo;
  detailingInfo: string;
  detailingPrice: string;
  detailingAccepted: YesNo;
  tiresAccepted: YesNo;
  registrationStatus: RegistrationStatus;
  cascoPhotos: YesNo;
  inspection: YesNo;
  serviceOffer: YesNo;
  serviceOfferLink: string;
  inspectionProtocolLink: string;
  detailing: string;
  tiresInfo: string;
  tiresCostPrice: string;
  tiresPrice: string;
  wheelsInfo: string;
  addonOther: string;
  firstRegistrationDate: string;
  mileage: string;
  memoStatus: MemoStatus;
  memoContractLink: string;
  memoDescription: string;
  memoAccountSubmittedAt: string;
  memoTeamLeadComment: string;
  memoTeamLeadDecisionAt: string;
  memoOperationComment: string;
  memoOperationDecisionAt: string;
  memoEvents: MemoEvent[];
  transferredToAccountAt: string;
  transferredToLogisticsAt: string;
  operationApprovedAt: string;
  serviceOfferUploadedAt: string;
  inspectionProtocolUploadedAt: string;
  insuranceTouchedAt: string;
  serviceTouchedAt: string;
  source: LeadSourceInput;
  stage: LeadStage;
  createdAt: string;
};

const sourceMap: Record<LeadSourceInput, LeadSource> = {
  call: "PHONE",
  mail: "EMAIL",
  whatsapp: "WHATSAPP",
  viber: "VIBER",
  facebook: "FACEBOOK",
  instagram: "INSTAGRAM",
  other: "OTHER",
};

const sourceReverseMap: Record<LeadSource, LeadSourceInput> = {
  PHONE: "call",
  EMAIL: "mail",
  WHATSAPP: "whatsapp",
  VIBER: "viber",
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  OTHER: "other",
};

export function sourceInputToEnum(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase() as LeadSourceInput;
  return sourceMap[normalized] ?? "OTHER";
}

export function sourceEnumToInput(value: LeadSource): LeadSourceInput {
  return sourceReverseMap[value] ?? "other";
}

export function stageToStatus(stage: LeadStage): LeadStatus {
  if (stage === "Contacted") return "QUALIFIED";
  if (stage === "Potential") return "QUALIFIED";
  if (stage === "Contract") return "CONTRACT_SIGNED";
  return "NEW";
}

export function statusToStage(status: LeadStatus): LeadStage {
  if (status === "QUALIFIED") return "Contacted";
  if (status === "CONTRACT_SIGNED") return "Contract";
  return "New leed";
}

export function splitFullName(fullName: string) {
  const cleaned = String(fullName ?? "").trim().replace(/\s+/g, " ");
  const [firstName = "Unknown", ...rest] = cleaned.split(" ");
  const lastName = rest.join(" ") || "Client";
  return { firstName, lastName };
}

export function splitVehicleRequest(vehicleRequest: string) {
  const cleaned = String(vehicleRequest ?? "").trim().replace(/\s+/g, " ");
  const tokens = cleaned.split(" ").filter(Boolean);
  const requestedBrand = tokens[0] ?? "Unknown";
  const requestedModel = tokens[1] ?? "Model";
  const requestedTrim = tokens.slice(2).join(" ") || null;

  return { requestedBrand, requestedModel, requestedTrim };
}

export function composeVehicleRequest(lead: {
  requestedBrand?: string | null;
  requestedModel?: string | null;
  requestedYearFrom?: number | null;
  requestedTrim?: string | null;
}) {
  const parts = [lead.requestedBrand ?? "", lead.requestedModel ?? ""].filter(Boolean);
  if (lead.requestedYearFrom != null) parts.push(String(lead.requestedYearFrom));
  if (lead.requestedTrim) parts.push(lead.requestedTrim);
  return parts.join(" ");
}

export type LeadSource = "EMAIL" | "PHONE" | "WHATSAPP" | "VIBER" | "FACEBOOK" | "INSTAGRAM" | "OTHER";
export type LeadStatus = "NEW" | "QUALIFIED" | "CONTRACT_SIGNED" | "LOST";
