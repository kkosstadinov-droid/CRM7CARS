import { NextResponse } from "next/server";
import { createLead, listLeads } from "@/lib/leads-store";
import { sourceEnumToInput, sourceInputToEnum, splitFullName, splitVehicleRequest, type ContractPackage, type LeadDocument, type LeadHistoryEvent, type LeadNoteEntry, type MemoEvent, type MemoStatus, type MemoSubject, type RegistrationStatus, type ShowroomOwnership, type ShowroomPackage, type YesNo } from "@/lib/leads";

type CreateLeadBody = {
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
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department");
  const includeShowroom = searchParams.get("includeShowroom") === "1";
  const customerType = searchParams.get("customerType");
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const hasLimit = Number.isFinite(limitRaw) && limitRaw > 0;
  const limit = Math.min(hasLimit ? limitRaw : 2500, 5000);
  const leads = await listLeads({
    department: department === "sales" || department === "account" || department === "logistics" || department === "showroom" ? department : undefined,
    includeShowroom,
    customerType: customerType === "new" || customerType === "existing" ? customerType : undefined,
    limit,
  });
  return NextResponse.json(leads);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateLeadBody;
    const handoverDepartment = body.handoverDepartment === "showroom" ? "showroom" : "sales";

    const fullName = body.fullName?.trim() ?? "";
    const phone = body.phone?.trim() ?? "";
    const vehicleRequest = body.vehicleRequest?.trim() ?? "";
    const firstRegistrationDate = body.firstRegistrationDate?.trim() ?? "";

    if (!fullName || !phone || !vehicleRequest) {
      return NextResponse.json({ error: "Full name, phone and vehicle request are required." }, { status: 400 });
    }
    if (handoverDepartment === "showroom" && firstRegistrationDate && !/^\d{4}$/.test(firstRegistrationDate)) {
      return NextResponse.json({ error: "Showroom year must be exactly 4 digits (YYYY)." }, { status: 400 });
    }

    const { firstName, lastName } = splitFullName(fullName);
    const { requestedBrand, requestedModel, requestedTrim } = splitVehicleRequest(vehicleRequest);

    const created = await createLead({
      fullName: `${firstName} ${lastName}`.trim(),
      phone,
      email: body.email?.trim() ?? "",
      egn: body.egn?.trim() ?? "",
      address: body.address?.trim() ?? "",
      vehicleRequest: [requestedBrand, requestedModel, requestedTrim].filter(Boolean).join(" "),
      contractLink: body.contractLink?.trim() ?? "",
      handoverNote: body.handoverNote?.trim() ?? "",
      handoverDepartment,
      isFamily: body.isFamily === true,
      familyAt: body.familyAt?.trim() ?? "",
      lastUpdatedBy: body.lastUpdatedBy?.trim() ?? "",
      car: body.car?.trim() ?? "",
      purchaseDate: body.purchaseDate?.trim() ?? "",
      am: body.am?.trim() ?? "",
      referral: body.referral?.trim() ?? "",
      discount: body.discount?.trim() ?? "",
      clientDiscount: body.clientDiscount?.trim() ?? "",
      budget: body.budget?.trim() ?? "",
      contractPackage: body.contractPackage === "Auction" || body.contractPackage === "Plus" || body.contractPackage === "Diamond" ? body.contractPackage : "",
      contractPrice: body.contractPrice?.trim() ?? "",
      brand: body.brand?.trim() ?? "",
      model: body.model?.trim() ?? "",
      engine: body.engine?.trim() ?? "",
      keylessStart: body.keylessStart === "Yes" ? "Yes" : "No",
      weight: body.weight?.trim() ?? "",
      color: body.color?.trim() ?? "",
      powerKw: body.powerKw?.trim() ?? "",
      powerHp: body.powerHp?.trim() ?? "",
      seatsCount: body.seatsCount?.trim() ?? "",
      doorsCount: body.doorsCount?.trim() ?? "",
      vin: body.vin?.trim() ?? "",
      serviced: body.serviced === "Yes" ? "Yes" : "No",
      servicedDate: body.servicedDate?.trim() ?? "",
      secondKey: body.secondKey === "Yes" ? "Yes" : "No",
      secondTireSet: body.secondTireSet === "Yes" ? "Yes" : "No",
      payoffDate: body.payoffDate?.trim() ?? "",
      aftersalesWarranty: body.aftersalesWarranty === "Yes" ? "Yes" : "No",
      aftersalesWarrantyDate: body.aftersalesWarrantyDate?.trim() ?? "",
      aftersalesWarrantyMileage: body.aftersalesWarrantyMileage?.trim() ?? "",
      purchaseLocation: body.purchaseLocation?.trim() ?? "",
      vatKey: body.vatKey?.trim() ?? "",
      deliveryPrice: body.deliveryPrice?.trim() ?? "",
      showroomOwnership: body.showroomOwnership === "Client" ? "Client" : "Own",
      showroomPackage: body.showroomPackage === "Basic" || body.showroomPackage === "Standart" || body.showroomPackage === "VIP" ? body.showroomPackage : "",
      showroomContract: Array.isArray(body.showroomContract) ? body.showroomContract : [],
      showroomReserved: body.showroomReserved === "Yes" ? "Yes" : "No",
      showroomSold: body.showroomSold === "Yes" ? "Yes" : "No",
      warranty: body.warranty === "Yes" ? "Yes" : "No",
      insuranceInfo: body.insuranceInfo?.trim() ?? "",
      insuranceGoPrice: body.insuranceGoPrice?.trim() ?? "",
      insuranceCascoPrice: body.insuranceCascoPrice?.trim() ?? "",
      insuranceAccepted: body.insuranceAccepted === "Yes" ? "Yes" : "No",
      registrationInfo: body.registrationInfo?.trim() ?? "",
      registrationAccepted: body.registrationAccepted === "Yes" ? "Yes" : "No",
      serviceOfferDetails: body.serviceOfferDetails?.trim() ?? "",
      serviceCostPrice: body.serviceCostPrice?.trim() ?? "",
      servicePrice: body.servicePrice?.trim() ?? "",
      serviceOfferAccepted: body.serviceOfferAccepted === "Yes" ? "Yes" : "No",
      detailingInfo: body.detailingInfo?.trim() ?? "",
      detailingPrice: body.detailingPrice?.trim() ?? "",
      detailingAccepted: body.detailingAccepted === "Yes" ? "Yes" : "No",
      tiresAccepted: body.tiresAccepted === "Yes" ? "Yes" : "No",
      registrationStatus: body.registrationStatus === "Yes" || body.registrationStatus === "Yes transit" ? body.registrationStatus : "No",
      cascoPhotos: body.cascoPhotos === "Yes" ? "Yes" : "No",
      inspection: body.inspection === "Yes" ? "Yes" : "No",
      serviceOffer: body.serviceOffer === "Yes" ? "Yes" : "No",
      serviceOfferLink: body.serviceOfferLink?.trim() ?? "",
      inspectionProtocolLink: body.inspectionProtocolLink?.trim() ?? "",
      detailing: body.detailing?.trim() ?? "",
      tiresInfo: body.tiresInfo?.trim() ?? "",
      tiresCostPrice: body.tiresCostPrice?.trim() ?? "",
      tiresPrice: body.tiresPrice?.trim() ?? "",
      wheelsInfo: body.wheelsInfo?.trim() ?? "",
      addonOther: body.addonOther?.trim() ?? "",
      firstRegistrationDate,
      mileage: body.mileage?.trim() ?? "",
      memoStatus: body.memoStatus ?? "none",
      memoSubject: body.memoSubject === "Buy car" || body.memoSubject === "Complain" ? body.memoSubject : "",
      memoContractLink: body.memoContractLink?.trim() ?? "",
      memoDescription: body.memoDescription?.trim() ?? "",
      memoAccountSubmittedAt: body.memoAccountSubmittedAt?.trim() ?? "",
      memoTeamLeadComment: body.memoTeamLeadComment?.trim() ?? "",
      memoTeamLeadDecisionAt: body.memoTeamLeadDecisionAt?.trim() ?? "",
      memoOperationComment: body.memoOperationComment?.trim() ?? "",
      memoOperationDecisionAt: body.memoOperationDecisionAt?.trim() ?? "",
      memoEvents: Array.isArray(body.memoEvents) ? body.memoEvents : [],
      callbackAt: body.callbackAt?.trim() ?? "",
      callbackNotes: body.callbackNotes?.trim() ?? "",
      callbackActivityId: body.callbackActivityId?.trim() ?? "",
      familyFollowUpActivityId: body.familyFollowUpActivityId?.trim() ?? "",
      pickupDate: body.pickupDate?.trim() ?? "",
      pickupActivityId: body.pickupActivityId?.trim() ?? "",
      accountDocuments: Array.isArray(body.accountDocuments) ? body.accountDocuments : [],
      returnToSalesComment: body.returnToSalesComment?.trim() ?? "",
      noteEntries: Array.isArray(body.noteEntries) ? body.noteEntries : [],
      history: Array.isArray(body.history) ? body.history : [],
      transferredToAccountAt: body.transferredToAccountAt?.trim() ?? "",
      transferredToLogisticsAt: body.transferredToLogisticsAt?.trim() ?? "",
      operationApprovedAt: body.operationApprovedAt?.trim() ?? "",
      serviceOfferUploadedAt: body.serviceOfferUploadedAt?.trim() ?? "",
      inspectionProtocolUploadedAt: body.inspectionProtocolUploadedAt?.trim() ?? "",
      insuranceTouchedAt: body.insuranceTouchedAt?.trim() ?? "",
      serviceTouchedAt: body.serviceTouchedAt?.trim() ?? "",
      source: sourceEnumToInput(sourceInputToEnum(body.source ?? "other")),
      stage: "New Lead",
      createdAt: body.createdAt?.trim() ?? new Date().toISOString(),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Failed to create lead.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
