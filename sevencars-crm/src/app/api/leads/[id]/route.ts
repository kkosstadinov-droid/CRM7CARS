import { NextResponse } from "next/server";
import { deleteLead, updateLead } from "@/lib/leads-store";
import { sourceEnumToInput, sourceInputToEnum, splitFullName, splitVehicleRequest, stageToStatus, type ContractPackage, type LeadDocument, type LeadDto, type LeadHistoryEvent, type LeadNoteEntry, type LeadStage, type MemoEvent, type MemoStatus, type MemoSubject, type RegistrationStatus, type ShowroomOwnership, type ShowroomPackage, type YesNo } from "@/lib/leads";

type UpdateLeadBody = {
  fullName?: string;
  phone?: string;
  email?: string;
  egn?: string;
  address?: string;
  vehicleRequest?: string;
  contractLink?: string;
  handoverNote?: string;
  handoverDepartment?: "sales" | "account" | "logistics" | "showroom";
  isFamily?: boolean;
  familyAt?: string;
  lastUpdatedBy?: string;
  car?: string;
  purchaseDate?: string;
  am?: string;
  referral?: string;
  discount?: string;
  clientDiscount?: string;
  budget?: string;
  contractPackage?: ContractPackage;
  contractPrice?: string;
  brand?: string;
  model?: string;
  engine?: string;
  keylessStart?: YesNo;
  weight?: string;
  color?: string;
  powerKw?: string;
  powerHp?: string;
  seatsCount?: string;
  doorsCount?: string;
  vin?: string;
  serviced?: YesNo;
  servicedDate?: string;
  secondKey?: YesNo;
  secondTireSet?: YesNo;
  payoffDate?: string;
  aftersalesWarranty?: YesNo;
  aftersalesWarrantyDate?: string;
  aftersalesWarrantyMileage?: string;
  purchaseLocation?: string;
  vatKey?: string;
  deliveryPrice?: string;
  showroomOwnership?: ShowroomOwnership;
  showroomPackage?: ShowroomPackage;
  showroomContract?: LeadDocument[];
  showroomReserved?: YesNo;
  showroomSold?: YesNo;
  warranty?: YesNo;
  insuranceInfo?: string;
  insuranceGoPrice?: string;
  insuranceCascoPrice?: string;
  insuranceAccepted?: YesNo;
  registrationInfo?: string;
  registrationAccepted?: YesNo;
  serviceOfferDetails?: string;
  serviceCostPrice?: string;
  servicePrice?: string;
  serviceOfferAccepted?: YesNo;
  detailingInfo?: string;
  detailingPrice?: string;
  detailingAccepted?: YesNo;
  tiresAccepted?: YesNo;
  registrationStatus?: RegistrationStatus;
  cascoPhotos?: YesNo;
  inspection?: YesNo;
  serviceOffer?: YesNo;
  serviceOfferLink?: string;
  inspectionProtocolLink?: string;
  detailing?: string;
  tiresInfo?: string;
  tiresCostPrice?: string;
  tiresPrice?: string;
  wheelsInfo?: string;
  addonOther?: string;
  firstRegistrationDate?: string;
  mileage?: string;
  memoStatus?: MemoStatus;
  memoSubject?: MemoSubject;
  memoContractLink?: string;
  memoDescription?: string;
  memoAccountSubmittedAt?: string;
  memoTeamLeadComment?: string;
  memoTeamLeadDecisionAt?: string;
  memoOperationComment?: string;
  memoOperationDecisionAt?: string;
  memoEvents?: MemoEvent[];
  callbackAt?: string;
  callbackNotes?: string;
  callbackActivityId?: string;
  familyFollowUpActivityId?: string;
  pickupDate?: string;
  pickupActivityId?: string;
  accountDocuments?: LeadDocument[];
  returnToSalesComment?: string;
  noteEntries?: LeadNoteEntry[];
  history?: LeadHistoryEvent[];
  transferredToAccountAt?: string;
  transferredToLogisticsAt?: string;
  operationApprovedAt?: string;
  serviceOfferUploadedAt?: string;
  inspectionProtocolUploadedAt?: string;
  insuranceTouchedAt?: string;
  serviceTouchedAt?: string;
  createdAt?: string;
  source?: string;
  stage?: LeadStage;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as UpdateLeadBody;
  const isShowroomPayload = body.handoverDepartment === "showroom";
  const firstRegistrationDate = body.firstRegistrationDate?.trim();

  if (isShowroomPayload && typeof firstRegistrationDate === "string" && firstRegistrationDate && !/^\d{4}$/.test(firstRegistrationDate)) {
    return NextResponse.json({ error: "Showroom year must be exactly 4 digits (YYYY)." }, { status: 400 });
  }

  const patch: Partial<Omit<LeadDto, "id">> = {};

  if (typeof body.fullName === "string") {
    const { firstName, lastName } = splitFullName(body.fullName);
    patch.fullName = `${firstName} ${lastName}`.trim();
  }

  if (typeof body.phone === "string") patch.phone = body.phone.trim();
  if (typeof body.email === "string") patch.email = body.email.trim();
  if (typeof body.egn === "string") patch.egn = body.egn.trim();
  if (typeof body.address === "string") patch.address = body.address.trim();
  if (typeof body.contractLink === "string") patch.contractLink = body.contractLink.trim();
  if (typeof body.handoverNote === "string") patch.handoverNote = body.handoverNote.trim();
  if (typeof body.lastUpdatedBy === "string") patch.lastUpdatedBy = body.lastUpdatedBy.trim();
  if (typeof body.familyAt === "string") patch.familyAt = body.familyAt.trim();
  if (typeof body.isFamily === "boolean") patch.isFamily = body.isFamily;
  if (typeof body.car === "string") patch.car = body.car.trim();
  if (typeof body.purchaseDate === "string") patch.purchaseDate = body.purchaseDate.trim();
  if (typeof body.am === "string") patch.am = body.am.trim();
  if (typeof body.referral === "string") patch.referral = body.referral.trim();
  if (typeof body.discount === "string") patch.discount = body.discount.trim();
  if (typeof body.clientDiscount === "string") patch.clientDiscount = body.clientDiscount.trim();
  if (typeof body.budget === "string") patch.budget = body.budget.trim();
  if (body.contractPackage === "Auction" || body.contractPackage === "Plus" || body.contractPackage === "Diamond" || body.contractPackage === "") {
    patch.contractPackage = body.contractPackage;
  }
  if (typeof body.contractPrice === "string") patch.contractPrice = body.contractPrice.trim();
  if (typeof body.brand === "string") patch.brand = body.brand.trim();
  if (typeof body.model === "string") patch.model = body.model.trim();
  if (typeof body.engine === "string") patch.engine = body.engine.trim();
  if (body.keylessStart === "Yes" || body.keylessStart === "No") patch.keylessStart = body.keylessStart;
  if (typeof body.weight === "string") patch.weight = body.weight.trim();
  if (typeof body.color === "string") patch.color = body.color.trim();
  if (typeof body.powerKw === "string") patch.powerKw = body.powerKw.trim();
  if (typeof body.powerHp === "string") patch.powerHp = body.powerHp.trim();
  if (typeof body.seatsCount === "string") patch.seatsCount = body.seatsCount.trim();
  if (typeof body.doorsCount === "string") patch.doorsCount = body.doorsCount.trim();
  if (typeof body.vin === "string") patch.vin = body.vin.trim();
  if (body.serviced === "Yes" || body.serviced === "No") patch.serviced = body.serviced;
  if (typeof body.servicedDate === "string") patch.servicedDate = body.servicedDate.trim();
  if (body.secondKey === "Yes" || body.secondKey === "No") patch.secondKey = body.secondKey;
  if (body.secondTireSet === "Yes" || body.secondTireSet === "No") patch.secondTireSet = body.secondTireSet;
  if (typeof body.payoffDate === "string") patch.payoffDate = body.payoffDate.trim();
  if (body.aftersalesWarranty === "Yes" || body.aftersalesWarranty === "No") patch.aftersalesWarranty = body.aftersalesWarranty;
  if (typeof body.aftersalesWarrantyDate === "string") patch.aftersalesWarrantyDate = body.aftersalesWarrantyDate.trim();
  if (typeof body.aftersalesWarrantyMileage === "string") patch.aftersalesWarrantyMileage = body.aftersalesWarrantyMileage.trim();
  if (typeof body.purchaseLocation === "string") patch.purchaseLocation = body.purchaseLocation.trim();
  if (typeof body.vatKey === "string") patch.vatKey = body.vatKey.trim();
  if (typeof body.deliveryPrice === "string") patch.deliveryPrice = body.deliveryPrice.trim();
  if (body.showroomOwnership === "Own" || body.showroomOwnership === "Client") patch.showroomOwnership = body.showroomOwnership;
  if (body.showroomPackage === "Basic" || body.showroomPackage === "Standart" || body.showroomPackage === "VIP" || body.showroomPackage === "") {
    patch.showroomPackage = body.showroomPackage;
  }
  if (Array.isArray(body.showroomContract)) patch.showroomContract = body.showroomContract;
  if (body.showroomReserved === "Yes" || body.showroomReserved === "No") patch.showroomReserved = body.showroomReserved;
  if (body.showroomSold === "Yes" || body.showroomSold === "No") patch.showroomSold = body.showroomSold;
  if (body.warranty === "Yes" || body.warranty === "No") patch.warranty = body.warranty;
  if (typeof body.insuranceInfo === "string") patch.insuranceInfo = body.insuranceInfo.trim();
  if (typeof body.insuranceGoPrice === "string") patch.insuranceGoPrice = body.insuranceGoPrice.trim();
  if (typeof body.insuranceCascoPrice === "string") patch.insuranceCascoPrice = body.insuranceCascoPrice.trim();
  if (body.insuranceAccepted === "Yes" || body.insuranceAccepted === "No") patch.insuranceAccepted = body.insuranceAccepted;
  if (typeof body.registrationInfo === "string") patch.registrationInfo = body.registrationInfo.trim();
  if (body.registrationAccepted === "Yes" || body.registrationAccepted === "No") patch.registrationAccepted = body.registrationAccepted;
  if (typeof body.serviceOfferDetails === "string") patch.serviceOfferDetails = body.serviceOfferDetails.trim();
  if (typeof body.serviceCostPrice === "string") patch.serviceCostPrice = body.serviceCostPrice.trim();
  if (typeof body.servicePrice === "string") patch.servicePrice = body.servicePrice.trim();
  if (body.serviceOfferAccepted === "Yes" || body.serviceOfferAccepted === "No") patch.serviceOfferAccepted = body.serviceOfferAccepted;
  if (typeof body.detailingInfo === "string") patch.detailingInfo = body.detailingInfo.trim();
  if (typeof body.detailingPrice === "string") patch.detailingPrice = body.detailingPrice.trim();
  if (body.detailingAccepted === "Yes" || body.detailingAccepted === "No") patch.detailingAccepted = body.detailingAccepted;
  if (body.tiresAccepted === "Yes" || body.tiresAccepted === "No") patch.tiresAccepted = body.tiresAccepted;
  if (body.registrationStatus === "Yes" || body.registrationStatus === "Yes transit" || body.registrationStatus === "No") patch.registrationStatus = body.registrationStatus;
  if (body.cascoPhotos === "Yes" || body.cascoPhotos === "No") patch.cascoPhotos = body.cascoPhotos;
  if (body.inspection === "Yes" || body.inspection === "No") patch.inspection = body.inspection;
  if (body.serviceOffer === "Yes" || body.serviceOffer === "No") patch.serviceOffer = body.serviceOffer;
  if (typeof body.serviceOfferLink === "string") patch.serviceOfferLink = body.serviceOfferLink.trim();
  if (typeof body.inspectionProtocolLink === "string") patch.inspectionProtocolLink = body.inspectionProtocolLink.trim();
  if (typeof body.detailing === "string") patch.detailing = body.detailing.trim();
  if (typeof body.tiresInfo === "string") patch.tiresInfo = body.tiresInfo.trim();
  if (typeof body.tiresCostPrice === "string") patch.tiresCostPrice = body.tiresCostPrice.trim();
  if (typeof body.tiresPrice === "string") patch.tiresPrice = body.tiresPrice.trim();
  if (typeof body.wheelsInfo === "string") patch.wheelsInfo = body.wheelsInfo.trim();
  if (typeof body.addonOther === "string") patch.addonOther = body.addonOther.trim();
  if (typeof body.firstRegistrationDate === "string") patch.firstRegistrationDate = firstRegistrationDate ?? "";
  if (typeof body.mileage === "string") patch.mileage = body.mileage.trim();
  if (body.memoStatus === "none" || body.memoStatus === "pending_teamlead" || body.memoStatus === "rejected_by_teamlead" || body.memoStatus === "pending_operation" || body.memoStatus === "rejected_by_operation" || body.memoStatus === "approved") {
    patch.memoStatus = body.memoStatus;
  }
  if (body.memoSubject === "" || body.memoSubject === "Buy car" || body.memoSubject === "Complain") patch.memoSubject = body.memoSubject;
  if (typeof body.memoContractLink === "string") patch.memoContractLink = body.memoContractLink.trim();
  if (typeof body.memoDescription === "string") patch.memoDescription = body.memoDescription.trim();
  if (typeof body.memoAccountSubmittedAt === "string") patch.memoAccountSubmittedAt = body.memoAccountSubmittedAt.trim();
  if (typeof body.memoTeamLeadComment === "string") patch.memoTeamLeadComment = body.memoTeamLeadComment.trim();
  if (typeof body.memoTeamLeadDecisionAt === "string") patch.memoTeamLeadDecisionAt = body.memoTeamLeadDecisionAt.trim();
  if (typeof body.memoOperationComment === "string") patch.memoOperationComment = body.memoOperationComment.trim();
  if (typeof body.memoOperationDecisionAt === "string") patch.memoOperationDecisionAt = body.memoOperationDecisionAt.trim();
  if (Array.isArray(body.memoEvents)) patch.memoEvents = body.memoEvents;
  if (typeof body.callbackAt === "string") patch.callbackAt = body.callbackAt.trim();
  if (typeof body.callbackNotes === "string") patch.callbackNotes = body.callbackNotes.trim();
  if (typeof body.callbackActivityId === "string") patch.callbackActivityId = body.callbackActivityId.trim();
  if (typeof body.familyFollowUpActivityId === "string") patch.familyFollowUpActivityId = body.familyFollowUpActivityId.trim();
  if (typeof body.pickupDate === "string") patch.pickupDate = body.pickupDate.trim();
  if (typeof body.pickupActivityId === "string") patch.pickupActivityId = body.pickupActivityId.trim();
  if (Array.isArray(body.accountDocuments)) patch.accountDocuments = body.accountDocuments;
  if (typeof body.returnToSalesComment === "string") patch.returnToSalesComment = body.returnToSalesComment.trim();
  if (Array.isArray(body.noteEntries)) patch.noteEntries = body.noteEntries;
  if (Array.isArray(body.history)) patch.history = body.history;
  if (typeof body.transferredToAccountAt === "string") patch.transferredToAccountAt = body.transferredToAccountAt.trim();
  if (typeof body.transferredToLogisticsAt === "string") patch.transferredToLogisticsAt = body.transferredToLogisticsAt.trim();
  if (typeof body.operationApprovedAt === "string") patch.operationApprovedAt = body.operationApprovedAt.trim();
  if (typeof body.serviceOfferUploadedAt === "string") patch.serviceOfferUploadedAt = body.serviceOfferUploadedAt.trim();
  if (typeof body.inspectionProtocolUploadedAt === "string") patch.inspectionProtocolUploadedAt = body.inspectionProtocolUploadedAt.trim();
  if (typeof body.insuranceTouchedAt === "string") patch.insuranceTouchedAt = body.insuranceTouchedAt.trim();
  if (typeof body.serviceTouchedAt === "string") patch.serviceTouchedAt = body.serviceTouchedAt.trim();
  if (body.handoverDepartment === "sales" || body.handoverDepartment === "account" || body.handoverDepartment === "logistics" || body.handoverDepartment === "showroom") {
    patch.handoverDepartment = body.handoverDepartment;
  }
  if (typeof body.createdAt === "string") patch.createdAt = body.createdAt.trim();
  if (typeof body.source === "string") patch.source = sourceEnumToInput(sourceInputToEnum(body.source));
  if (typeof body.stage === "string") {
    stageToStatus(body.stage);
    patch.stage = body.stage;
  }

  if (typeof body.vehicleRequest === "string") {
    const { requestedBrand, requestedModel, requestedTrim } = splitVehicleRequest(body.vehicleRequest);
    patch.vehicleRequest = [requestedBrand, requestedModel, requestedTrim].filter(Boolean).join(" ");
  }

  const updated = await updateLead(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteLead(id);
  if (!deleted) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
