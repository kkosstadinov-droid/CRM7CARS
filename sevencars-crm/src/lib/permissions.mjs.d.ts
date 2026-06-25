import type { AppRole, SessionInfo } from "@/lib/auth";
import type { LeadDto } from "@/lib/leads";

type SessionLike = Pick<SessionInfo, "username" | "role"> | { username?: string; role?: AppRole | string } | null | undefined;
type LeadLike = Partial<LeadDto> & { assignedTo?: string; salesOwner?: string };

export function canChangeLeadStatus(session: SessionLike, lead?: LeadLike | null): boolean;
export function canDeleteLead(session: SessionLike, lead?: LeadLike | null): boolean;
export function canSeeDocuments(session: SessionLike, lead?: LeadLike | null): boolean;
export function canEditLeadPrice(session: SessionLike, lead?: LeadLike | null): boolean;
export function canCreateUsers(session: SessionLike): boolean;
export function canSeeDashboard(session: SessionLike): boolean;
export function isLeadAssignedToUser(lead: LeadLike | null | undefined, username: string | null | undefined): boolean;
export function canViewLead(session: SessionLike, lead: LeadLike | null | undefined): boolean;
export function filterVisibleLeads<T extends LeadLike>(session: SessionLike, leads: T[]): T[];
export function sanitizeLeadForRole<T extends LeadLike | null | undefined>(session: SessionLike, lead: T): T;
export function forbiddenLeadPatchFields(session: SessionLike, patch: Record<string, unknown>, currentLead?: LeadLike | null): string[];
export function permissionDenied(message?: string): { error: string };
