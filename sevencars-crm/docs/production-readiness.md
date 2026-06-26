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

The backup JSON includes users, leads, activities, and audit log counts. Backup output is local and gitignored under `backups/`.

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
