# AOS website

Next.js 15 (App Router, TypeScript) on top of the Supabase project `AOS-TLV`. Hebrew (RTL) and English, one route tree under `/he` and `/en`.
The database, its rules and the RPC contract are described in [supabase/README.md](supabase/README.md).

## Run

```bash
cp .env.example .env.local      # SUPABASE_SERVICE_ROLE_KEY is needed only to create new tenant/admin accounts from the back office
npm install
npm run dev                     # http://localhost:3000
npm run build && npm start      # production
```

## Layout

| Path | What |
|---|---|
| `src/proxy.ts` | redirects `/` to `/he` or `/en` (cookie `aos_lang`), refreshes the Supabase session |
| `src/app/(site)/[lang]/` | every public page; the layout holds header, footer and the accessibility widget |
| `src/app/admin/` | the back office (its own root layout); the layout shows a sign-in screen unless the user is an admin |
| `src/components/admin/` | back-office client components; they call the database functions and refresh the page |
| `src/app/auth/callback/` | landing for email links (sign-up confirmation, password reset) |
| `src/lib/data.ts` | server reads: site catalogue (`getSite`) and the signed-in user (`getViewer`) |
| `src/lib/slots.ts` | availability and quotes, computed by the database (`get_day_slots`, `quote_booking`) |
| `src/components/booking-widget.tsx` | date → time → summary → sign-in → hold → request, all through RPCs |
| `src/i18n/` | `he.json`/`en.json` (strings from the design), `extra.ts` (production-only strings), `docs.json` (privacy, terms, accessibility) |
| `src/styles/` | design tokens and page styles taken from the v7 design |

## Pages built

Home, meeting room with booking, booking status, offices list and office page, membership, sign-in and sign-up, account (my bookings), password reset,
privacy, terms and accessibility statement.

Back office (`/admin`, Hebrew only, admins only): overview, calendar (day, week, month) with manual bookings and blocks, bookings and payments,
customers, room editor (details, hours, prices and rules, photos), offices and tenants, tenant usage, service tickets, enquiries, admin team, settings and audit log.

## Not built yet

Tenant area, invoices and saved cards in the account, landing pages and their marketing stats, realtime updates, payment and email providers, Google sign-in.
The booking flow ends in a request that staff confirm by hand (`confirm_unpaid` / `record_payment`).

## Deploy on AWS Amplify

Amplify Hosting renders Next.js on its own compute only for Next.js 12 to 15, so the app stays on Next.js 15 (`middleware.ts`, not `proxy.ts`).
`amplify.yml` installs, builds and publishes `.next`.

The Amplify app must be a **server-side rendering** app (platform `WEB_COMPUTE`). A plain `WEB` app serves the repo as static files and answers `/` with 404.
Check it with `aws amplify get-app --app-id <id> --query app.platform`, and fix it with:

```bash
aws amplify update-app --app-id <id> --platform WEB_COMPUTE --custom-rules '[]' --build-spec "$(cat amplify.yml)" \
  --environment-variables NEXT_PUBLIC_SUPABASE_URL=...,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...,NEXT_PUBLIC_SITE_URL=https://<branch>.<id>.amplifyapp.com
aws amplify update-branch --app-id <id> --branch-name main --framework "Next.js - SSR"
aws amplify start-job --app-id <id> --branch-name main --job-type RELEASE
```

Environment variables (Amplify console → Hosting → Environment variables): the three above, plus `SUPABASE_SERVICE_ROLE_KEY` (secret, only for creating tenant/admin accounts).
`amplify.yml` writes `NEXT_PUBLIC_*` and `SUPABASE_*` into `.env.production` so the server runtime sees them.
In Supabase → Authentication → URL Configuration, set the Site URL and add `https://<domain>/**` to the redirect URLs, or email links (sign-up, password reset) will point elsewhere.

## Design reference

`design/` holds the original Claude Design prototype (reference only, see its README). It is not part of the build.

## Rules the code relies on

- Browser code never writes business data directly; it calls RPCs and reads what RLS allows.
- Times are Israel time (`Asia/Jerusalem`) everywhere; day keys are plain `YYYY-MM-DD` strings (`src/lib/format.ts`).
- Images are referenced as `uploads/...` in the database and served from `public/uploads/`.
