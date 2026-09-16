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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
