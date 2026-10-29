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

## Speed, SEO and AI search (GEO)

- **Speed:** the hero photo ships as pre-sized AVIF/WebP in `public/uploads/hero-*`; the hero video loads only after the page is idle and never on data-saver or reduced-motion;
  the public catalogue and anonymous availability are shared between requests for 60 s and 15 s (`src/lib/data.ts`, `src/lib/slots-server.ts`; the back office clears them after saving);
  Google Maps loads on click; below-the-fold sections use `content-visibility`; static photos are cached for a month (`next.config.ts`).
- **SEO:** per-page title, description, canonical and hreflang (he, en, x-default) from `src/lib/seo.ts`; structured data from `src/lib/schema.ts`
  (LocalBusiness, WebSite, Product with offers for the room and each office, FAQPage, BreadcrumbList, ItemList); `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`; account, booking and admin pages are `noindex`.
- **GEO:** `/llms.txt` is generated from the database (prices, hours, rules, FAQ in both languages); the FAQ answers carry concrete numbers; `robots.txt` explicitly allows search and answer-engine crawlers.
- **Link previews (WhatsApp, Facebook, LinkedIn, X):** every page carries Open Graph and Twitter tags with a branded 1200x630 card under 100 KB, one per language
  (`public/uploads/og-home-{he,en}.jpg`, `og-room-{he,en}.jpg`). Regenerate them with `node scripts/make-share-cards.mjs` after changing the wording in that file.
  WhatsApp and Facebook cache previews, so after a change re-scrape the address in the Facebook Sharing Debugger, or share it with `?v=2` added.
  Set `NEXT_PUBLIC_SITE_URL` in production, because canonical links, the sitemap and structured data are built from it. Optional map coordinates can be entered in the back office settings.

## Readable addresses

Public pages use English slugs, never ids: `/he/room/meeting-room`, `/he/office/office-1`, `/he/booking/AOS-3F9A1C2` (the booking reference).
`rooms.slug` and `offices.slug` come from migration `add_url_slugs`; rows created in the back office get a unique slug from their English name by a trigger.
Links shared with the old UUID addresses redirect permanently (308) to the slug address and keep their query string. Build addresses with `src/lib/urls.ts`, not by hand.

## Landing pages and marketing stats

- `/he|en/lp/offices` (tour request, becomes an inquiry with source `lp-office`) and `/he|en/lp/meeting-room` (booking card with the same availability, hold and request functions as the booking page, source `lp-room`).
  They live in their own route group `(lp)` with a dark layout, are `noindex` and are not in the sitemap: they are meant for paid campaigns.
- Campaign tags (`utm_source`, `utm_medium`, `utm_campaign`) are read from the address, kept for the visit and written on the inquiry or booking request.
  Each visit adds one to a daily counter per campaign (`lp_view`, no personal data), and events (`lp_view`, `lp_cta_click`, `select_date`, `select_time`, `begin_checkout`, `generate_lead`, `booking_request_submit`) go to `window.dataLayer` for a tag manager.
  Nothing is loaded or sent to a third party from these pages.
- The back office tab **שיווק ודפי נחיתה** (`/admin/marketing`) shows views, tour requests, booking requests and conversion by campaign and by day, and where all inquiries and bookings came from.
- If advertising or analytics tags are added later, the cookie notice must become a real consent prompt (see below) before those tags load.

## Cookie notice

A small translucent notice at the bottom of the public pages (`src/components/cookie-notice.tsx`) says the site uses only essential cookies (sign-in, language, accessibility) and links to the privacy policy.
It is informational: it stores one flag in the browser (`aos_cookie_notice`) and changes nothing else. Israel's Privacy Protection Law (Amendment 13, in force since 14 August 2025) has no cookie-specific rule,
but non-essential tracking or advertising cookies need informed, unambiguous consent with an equally prominent way to refuse. This is not legal advice.

## Design reference

`design/` holds the original Claude Design prototype (reference only, see its README). It is not part of the build.

## Rules the code relies on

- Browser code never writes business data directly; it calls RPCs and reads what RLS allows.
- Times are Israel time (`Asia/Jerusalem`) everywhere; day keys are plain `YYYY-MM-DD` strings (`src/lib/format.ts`).
- Images are referenced as `uploads/...` in the database and served from `public/uploads/`.
