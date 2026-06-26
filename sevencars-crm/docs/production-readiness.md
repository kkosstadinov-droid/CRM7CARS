# CRM7CARS production readiness

## Current production setup

- App hosting: Vercel, GitHub auto-deploy from `main`.
- Durable MVP storage: Vercel Blob JSON for users, leads, activities, documents, and audit log.
- Daily backup: Hermes scheduled job `CRM7CARS daily production backup` runs `npm run backup:export` at 03:00 Europe/Sofia time.
- Placeholder users are provisioned by `npm run users:provision`.

## Placeholder user policy

Initial placeholder usernames intentionally follow simple role naming until real names are assigned:

- Admin/Boss: `admin`, `boss`, `boss1`
- Sales: `sales`, `sales1`, `sales2`, `sales3`
- Account Managers: `accountmanager`, `accountmanager1`, `accountmanager2`, `accountmanager3`, `accountmanager4`, `accountmanager5`
- TeamLeadAM: `teamleadam`
- Operation Managers: `operationmanager`, `operationmanager1`
- Logistics: `logistics`, `logistics1`
- Service: `service`, `service1`
- Insurance: `insurance`, `insurance1`
- Showroom: `showroom`, `showroom1`

Temporary password policy for placeholders: password equals username, and `mustChangePassword=true`.
Before real production use, replace placeholder usernames with real usernames and rotate passwords from the Admin panel.

## Daily backup verification

Manual backup command:

```bash
BASE_URL=https://sevencars-crm.vercel.app npm run backup:export
```

Dry run:

```bash
npm run backup:export -- --dry-run
```

Restore validation:

```bash
npm run backup:restore-test
```

The backup JSON includes users, usersRestore, leads, activities, and audit log counts. Backup output is local and gitignored under `backups/`. If private Blob user hashes are not available to the backup runner, `usersRestore` falls back to a safe emergency reset policy: temporary password equals username and `mustChangePassword=true`.

## Data/privacy and delete policy

- Leads are archived, not physically deleted, when a manager deletes them from the UI/API.
- Archived leads are hidden from normal lead lists by default but remain in backups and audit history.
- Users are deactivated, not physically deleted, when removed from Admin; deactivated users cannot log in.
- Audit log records create/update/archive/password-reset operations and should be retained for accountability.
- Sales users may only see assigned/owned leads.
- Sales and other non-management roles must not see Admin users or Audit Log.
- Documents are visible only to permitted management/account roles according to the permission matrix.
- Before entering real customer data, use non-real sample data for tester onboarding.

## Tester handoff checklist

Before giving access to internal testers:

1. Confirm `npm run production:check` passes against production.
2. Confirm `npm run backup:export` and `npm run backup:restore-test` pass.
3. Tell testers to use placeholder accounts only for test data.
4. Tell testers not to enter real EGN/personal addresses until real usernames/passwords are finalized.
5. Ask testers to report role/permission surprises immediately.
6. Keep daily backup job enabled during testing.
7. Revoke any old Vercel token visible in the Vercel dashboard.

## Postgres migration readiness

Do **not** flip the app to Postgres until all prerequisites below are complete:

1. Choose managed Postgres provider: Neon or Supabase.
2. Add production env var `DATABASE_URL` in Vercel.
3. Keep `BLOB_READ_WRITE_TOKEN` for uploaded documents and optional export snapshots.
4. Create a fresh backup with `npm run backup:export` immediately before migration.
5. Convert Prisma datasource provider from `sqlite` to `postgresql` in a migration branch.
6. Add migration/import script that reads latest backup JSON and writes users/leads/activities/audit rows to Postgres.
7. Run local gates: `npm run storage:test`, `npm run permissions:test`, `npm run audit:test`, `npm run system:volume`, `npm run postgres:readiness`, `npm run lint`, `npm run build`.
8. Deploy to preview first, run role smoke checks, then promote production.

## Production safety blockers before full business rollout

- Revoke temporary Vercel token used by Hermes after setup work is complete.
- Replace placeholder usernames with real usernames from the Admin panel.
- Require every real user to set a non-placeholder password.
- Keep daily backups enabled and verify at least one restore/export file after user migration.
