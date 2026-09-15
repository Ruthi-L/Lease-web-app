This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
# Rent App

Full-stack Next.js App Router starter with Prisma and SQLite for landlord lease workflows.

## Setup

Install dependencies and generate the Prisma client:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
```

The local SQLite database is configured through `DATABASE_URL="file:./dev.db"` in `.env`.

Start the development server:

```bash
npm run dev
```

The Prisma client is available from `src/lib/prisma.ts`. The schema defines cascading deletes from landlords to leases and from leases to tenants.

## Workflow

- Homeowners can register or log in at `/login`.
- Create applications from `/` and invite one or more adult tenants by email.
- Tenants use their private `/tenant/sign/[token]` link to complete remaining details and sign.
- Homeowners review applications at `/dashboard` and add their signature.
- Configure `SMTP_*` in `.env` for email invitations and completion notifications.
- Configure the Twilio variables in `.env` for the optional WhatsApp/SMS fallback.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open (https://lease-web-app-five.vercel.app/) with your browser to see the result.


