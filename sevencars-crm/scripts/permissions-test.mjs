import assert from 'node:assert/strict';
import { canCreateUsers, canDeleteLead, canEditLeadPrice, canSeeDashboard, canSeeDocuments, canViewLead, canChangeLeadStatus, filterVisibleLeads, sanitizeLeadForRole } from '../src/lib/permissions.mjs';

const baseLead = {
  id: 'lead-1',
  lastUpdatedBy: 'sales1',
  assignedTo: 'sales1',
  salesOwner: 'sales1',
  am: 'account1',
  stage: 'New Lead',
  handoverDepartment: 'sales',
  accountDocuments: [{ id: 'doc1', name: 'contract.pdf', url: '/doc', pathname: 'doc', uploadedAt: '2026-01-01T00:00:00.000Z', size: 123 }],
  showroomContract: [{ id: 'doc2', name: 'showroom.pdf', url: '/showroom', pathname: 'showroom', uploadedAt: '2026-01-01T00:00:00.000Z', size: 123 }],
};

const otherLead = { ...baseLead, id: 'lead-2', lastUpdatedBy: 'sales2', assignedTo: 'sales2', salesOwner: 'sales2' };

assert.equal(canViewLead({ username: 'sales1', role: 'Sales' }, baseLead), true, 'Sales should see own assigned lead');
assert.equal(canViewLead({ username: 'sales1', role: 'Sales' }, otherLead), false, 'Sales should not see other sales user leads');
assert.deepEqual(filterVisibleLeads({ username: 'sales1', role: 'Sales' }, [baseLead, otherLead]).map((lead) => lead.id), ['lead-1']);
assert.equal(canViewLead({ username: 'boss1', role: 'Boss' }, otherLead), true, 'Boss should see all leads');

for (const role of ['Boss', 'TeamLeadAM', 'OperationManager']) {
  assert.equal(canChangeLeadStatus({ username: role.toLowerCase(), role }, baseLead), true, `${role} should change status`);
  assert.equal(canDeleteLead({ username: role.toLowerCase(), role }, baseLead), true, `${role} should delete leads`);
}
for (const role of ['Sales', 'AccountManager', 'Admin', 'Showroom']) {
  assert.equal(canChangeLeadStatus({ username: role.toLowerCase(), role }, baseLead), false, `${role} should not change status`);
  assert.equal(canDeleteLead({ username: role.toLowerCase(), role }, baseLead), false, `${role} should not delete leads`);
}

for (const role of ['AccountManager', 'TeamLeadAM', 'OperationManager', 'Boss']) {
  assert.equal(canSeeDocuments({ username: role.toLowerCase(), role }, baseLead), true, `${role} should see documents`);
}
for (const role of ['Sales', 'Admin', 'Logistics', 'Service', 'Insurance', 'Showroom']) {
  assert.equal(canSeeDocuments({ username: role.toLowerCase(), role }, baseLead), false, `${role} should not see documents`);
}

for (const role of ['Admin', 'Boss', 'Sales', 'AccountManager', 'TeamLeadAM', 'OperationManager', 'Logistics', 'Service', 'Insurance', 'Showroom']) {
  assert.equal(canEditLeadPrice({ username: role.toLowerCase(), role }, baseLead), true, `${role} should edit prices`);
}

for (const role of ['OperationManager', 'Boss', 'Admin']) {
  assert.equal(canCreateUsers({ username: role.toLowerCase(), role }), true, `${role} should create users`);
  assert.equal(canSeeDashboard({ username: role.toLowerCase(), role }), true, `${role} should see dashboard`);
}
for (const role of ['Sales', 'AccountManager', 'TeamLeadAM', 'Logistics', 'Service', 'Insurance', 'Showroom']) {
  assert.equal(canCreateUsers({ username: role.toLowerCase(), role }), false, `${role} should not create users`);
  assert.equal(canSeeDashboard({ username: role.toLowerCase(), role }), false, `${role} should not see dashboard`);
}

const salesSafeLead = sanitizeLeadForRole({ username: 'sales1', role: 'Sales' }, baseLead);
assert.deepEqual(salesSafeLead.accountDocuments, [], 'Sales API response should hide account documents');
assert.deepEqual(salesSafeLead.showroomContract, [], 'Sales API response should hide showroom documents');

console.log('permissions checks passed');
