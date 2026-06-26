export type AuditChange = {
  field: string;
  from: unknown;
  to: unknown;
};

export type AuditEvent = {
  id: string;
  at: string;
  actorUsername: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes: AuditChange[];
  metadata: Record<string, unknown>;
};

export function summarizeAuditPatch(before?: Record<string, unknown>, after?: Record<string, unknown>): AuditChange[];
export function appendAuditEvent(input: {
  id?: string;
  at?: string;
  actor?: { username?: string; role?: string };
  actorUsername?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  summary?: string;
  changes?: AuditChange[];
  metadata?: Record<string, unknown>;
}): Promise<AuditEvent>;
export function listAuditEvents(filters?: {
  limit?: number;
  entityType?: string;
  entityId?: string;
  actorUsername?: string;
  action?: string;
}): Promise<AuditEvent[]>;
