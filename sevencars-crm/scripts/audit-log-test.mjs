import assert from 'node:assert/strict';
import { appendAuditEvent, listAuditEvents, summarizeAuditPatch } from '../src/lib/audit-store.mjs';

const now = new Date('2026-06-26T08:00:00.000Z');
const before = await listAuditEvents({ limit: 5 });

const event = await appendAuditEvent({
  actor: { username: 'admin', role: 'Admin' },
  action: 'lead.update',
  entityType: 'lead',
  entityId: 'lead-1',
  entityLabel: 'Test Lead',
  at: now.toISOString(),
  summary: 'Updated lead fields: stage, budget',
  changes: summarizeAuditPatch({ stage: 'New Lead', budget: '1000' }, { stage: 'Contract', budget: '1200', hidden: undefined }),
});

assert.equal(event.actorUsername, 'admin');
assert.equal(event.actorRole, 'Admin');
assert.equal(event.action, 'lead.update');
assert.deepEqual(event.changes.map((change) => change.field), ['stage', 'budget']);
assert.deepEqual(event.changes[0], { field: 'stage', from: 'New Lead', to: 'Contract' });

const after = await listAuditEvents({ limit: 5 });
assert.equal(after[0].id, event.id, 'Newest event should be returned first');
assert.equal(after.length, Math.min(before.length + 1, 5));

const filtered = await listAuditEvents({ entityType: 'lead', entityId: 'lead-1', limit: 20 });
assert.ok(filtered.some((item) => item.id === event.id), 'Can filter by entity');

console.log('audit log checks passed');
