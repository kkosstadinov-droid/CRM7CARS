# 7CARS CRM (MVP)

Web-based CRM for 7CARS operations: lead intake, contracting, vehicle sourcing, logistics, and aftersales services.

## Stack

- Next.js 16 + TypeScript + Tailwind CSS
- Prisma ORM (SQLite in local development)
- Responsive UI (mobile-ready foundation)

## Current Scope

- Lead intake channels: Email, Phone, WhatsApp, Viber, Facebook, Instagram
- Lifecycle coverage: Lead -> Contract -> Search -> Purchase -> Logistics -> Service/Insurance/Registration -> Delivery
- Roles: Admin, Sales Person, Account Manager, Logistics
- KPI dashboard + pipeline board + automation rules preview
- Prisma schema for real data and future Excel imports

## Run

Create a local `.env` file first:

```bash
DATABASE_URL="file:./dev.db"
SEVENCARS_SESSION_SECRET="replace-with-a-long-random-secret"
```

Then install and run:

```bash
DATABASE_URL="file:./dev.db" npm install
npm run dev
```

## Database Setup

1. Create `.env` with `DATABASE_URL` and `SEVENCARS_SESSION_SECRET`.
2. Create Prisma client:

```bash
npx prisma generate
```

3. Create local database and migration:

```bash
npx prisma migrate dev --name init
```

## Vercel Persistence

For local development, leads and activities use SQLite via `DATABASE_URL`, while users can use `data/users.json`.

Lead document uploads also work locally and are written to `public/uploads/lead-documents/`.

### Required Vercel environment variables

Production Vercel deployments must have durable storage configured before operators use the CRM:

```text
SEVENCARS_SESSION_SECRET=<long random secret>
BLOB_READ_WRITE_TOKEN=<Vercel Blob read/write token>
```

With `BLOB_READ_WRITE_TOKEN`, pipeline leads, activities, users, and uploaded lead documents are stored durably in Vercel Blob. Without that token, CRM data APIs return `503` instead of writing to Vercel's temporary `/tmp` filesystem.

Optional Blob key overrides:

```text
USERS_BLOB_PATH=crm/users.json
LEADS_BLOB_PREFIX=crm/leads/
ACTIVITIES_BLOB_PREFIX=crm/activities/
```

### Migrating local data to Vercel Blob

After setting `BLOB_READ_WRITE_TOKEN` locally or in your shell, run:

```bash
npm run migrate:blob
```

The migration uploads:

- `data/users.json` to `crm/users.json`
- Prisma `CrmLead` rows from `dev.db` to `crm/leads/<id>.json`
- Prisma `CrmActivity` rows, or legacy `data/activities.json`, to `crm/activities/<id>.json`

Verify storage config locally with:

```bash
npm run storage:test
```

## Auto Deploy

GitHub Actions workflow `.github/workflows/vercel-production.yml` deploys to Vercel Production on every push to `main`.

Required GitHub repository secret:

- `VERCEL_TOKEN`

## Next Build Steps

- Authentication and role-based access control
- CRUD screens for Leads, Clients, Deals, Tasks, Interactions
- Communication connectors (email, WhatsApp, Viber, Facebook)
- Excel import/export flows
- Reports and SLA/overdue monitoring
- Mobile app shell (React Native or PWA)

## Default Development Users

When the user store is empty, the app seeds one account per role with lowercase development passwords matching the username. Change these passwords immediately in any shared or production environment.

