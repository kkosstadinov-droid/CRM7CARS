export type ActivityDto = {
  id: string;
  title: string;
  note: string;
  startsAt: string;
  status: "planned" | "done";
  department: "sales" | "account" | "logistics";
  ownerUsername: string;
  createdAt: string;
};
