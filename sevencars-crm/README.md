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

```bash
npm install
npm run dev
```

## Database Setup

1. Copy `.env.example` to `.env`.
2. Create Prisma client:

```bash
npx prisma generate
```

3. Create local database and migration:

```bash
npx prisma migrate dev --name init
```

## Next Build Steps

- Authentication and role-based access control
- CRUD screens for Leads, Clients, Deals, Tasks, Interactions
- Communication connectors (email, WhatsApp, Viber, Facebook)
- Excel import/export flows
- Reports and SLA/overdue monitoring
- Mobile app shell (React Native or PWA)

## Demo Login

- Admin / Admin
- Sales / Sales
- AccountManager / AccountManager
- Logistics / Logistics
- Service / Service

