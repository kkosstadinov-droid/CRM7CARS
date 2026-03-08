export type Role = "Admin" | "Sales" | "AccountManager" | "Logistics" | "Service";

export type LeadSource = "Email" | "Phone" | "WhatsApp" | "Viber" | "Facebook" | "Instagram";

export type DealStage =
  | "Lead"
  | "Contract Signed"
  | "Vehicle Search"
  | "Vehicle Purchased"
  | "In Logistics"
  | "Service Review"
  | "Insurance Offer"
  | "Registration"
  | "Tires & Detailing"
  | "Delivered"
  | "Closed Won"
  | "Closed Lost";

export type KanbanItem = {
  id: string;
  customer: string;
  vehicle: string;
  source: LeadSource;
  stage: DealStage;
  owner: Role;
  nextAction: string;
  deadline: string;
};

export const lifecycle: DealStage[] = [
  "Lead",
  "Contract Signed",
  "Vehicle Search",
  "Vehicle Purchased",
  "In Logistics",
  "Service Review",
  "Insurance Offer",
  "Registration",
  "Tires & Detailing",
  "Delivered",
  "Closed Won",
];

export const intakeChannels: LeadSource[] = ["Email", "Phone", "WhatsApp", "Viber", "Facebook", "Instagram"];

export const roles: Role[] = ["Admin", "Sales", "AccountManager", "Logistics", "Service"];

export const kpis = {
  activeLeads: 34,
  activeDeals: 21,
  contractsThisMonth: 12,
  vehiclesInLogistics: 9,
  serviceOffersPending: 6,
  dueTodayTasks: 11,
};

export const pipeline: KanbanItem[] = [
  {
    id: "7C-2026-001",
    customer: "Ivan Petrov",
    vehicle: "BMW X5 2021 M50d, < 90k km",
    source: "Viber",
    stage: "Vehicle Search",
    owner: "AccountManager",
    nextAction: "Shortlist 3 Germany listings",
    deadline: "Today, 17:00",
  },
  {
    id: "7C-2026-002",
    customer: "Nikolay Georgiev",
    vehicle: "Audi A6 2020 45 TDI",
    source: "Phone",
    stage: "In Logistics",
    owner: "Logistics",
    nextAction: "Book customs clearance",
    deadline: "Tomorrow",
  },
  {
    id: "7C-2026-003",
    customer: "Elena Dimitrova",
    vehicle: "Mercedes GLC 2022 AMG Line",
    source: "Facebook",
    stage: "Insurance Offer",
    owner: "Logistics",
    nextAction: "Send 2 insurance options",
    deadline: "In 2 days",
  },
  {
    id: "7C-2026-004",
    customer: "Georgi Simeonov",
    vehicle: "VW Tiguan 2021 R-Line",
    source: "Email",
    stage: "Contract Signed",
    owner: "Sales",
    nextAction: "Handover to account manager",
    deadline: "Today, 15:30",
  },
  {
    id: "7C-2026-005",
    customer: "Mila Stoyanova",
    vehicle: "Toyota RAV4 Hybrid 2023",
    source: "WhatsApp",
    stage: "Service Review",
    owner: "Service",
    nextAction: "Prepare service quotation",
    deadline: "Tomorrow",
  },
];

export const automations = [
  "When lead is created: assign Sales and create follow-up task in 24h.",
  "No interaction for 7 days: raise reminder for owner and Admin.",
  "Stage changed to Contract Signed: auto-create Vehicle Search task for AccountManager.",
  "Stage changed to In Logistics: auto-create checklist tasks for delivery, registration, insurance, tires, detailing.",
  "Task overdue by 24h: escalate to Admin dashboard.",
];

export const integrations = ["Phone", "Email", "WhatsApp", "Viber", "Facebook"];
