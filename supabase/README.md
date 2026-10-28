# AOS database (Supabase project `AOS-TLV`, ref `mehghpqxlxoduxzhegsf`)

Server-side port of `project/aos-data.js`. The browser never writes bookings, payments or memberships directly:
it reads what RLS allows and calls the RPCs below. Migrations in `migrations/` are exactly what was applied.

## Model
- `profiles` (1:1 with `auth.users`, created by trigger; `role` is `customer` | `admin`, never taken from user metadata).
- Public catalogue: `rooms`, `room_hours` (no row = closed), `packages` (`p3` 3h, `half` 5h, `day` 9h), `offices`, `settings`.
- `bookings`: one calendar for every channel (web, landing pages, member, tenant hourly, manual). Times are `timestamptz`, interpreted in `Asia/Jerusalem`.
  `bookings_no_overlap` (GiST exclusion) makes double booking impossible; triggers make blocks and bookings mutually exclusive.
  Expired holds are released by `private.sweep_expired()` (every write path + pg_cron every minute).
- Private to admins: `office_admin` (tenant contact, notes), `price_rules`, `blocks`, `ticket_internal`, `inquiries`, `audit_log`, `lp_views`.
- `payment_methods.token` is never readable by browser roles (column grants).

## RPC contract (all return jsonb `{...}` or `{ "err": "<code>" }`)
| Function | Caller | Error codes |
|---|---|---|
| `get_day_slots(room, from, days, pkg)` → rows `day,start_hour,end_hour,pkg,state,price,total` | anon, authenticated | – (state: free, held, booked, blocked, past, members_only) |
| `quote_booking(room, date, start, end)` | anon, authenticated | room, slot |
| `create_hold(room, date, start, end, source, utm)` | authenticated | auth, room, price, slot, window, sameday, lead, taken |
| `request_booking(id)`, `release_hold(id)` | owner | auth, nf, expired |
| `cancel_booking(id, reason)` | owner or admin | auth, nf, status, late |
| `tenant_book(date, start, hours)` | office tenant | auth, tenant, room, slot, window, taken |
| `request_membership()`, `cancel_membership()`, `resume_membership()` | customer | auth, nf, status |
| `open_ticket(kind, subject, msg, images)`, `post_ticket_msg(id, text)` | tenant (post: or admin) | auth, tenant, subject, msg, nf |
| `set_auto_pay(on)`, `remove_payment_method()` | customer | auth, card |
| `add_inquiry(kind, office, interest, name, phone, email, msg, source, utm)`, `lp_view(lp, utm)` | anon, authenticated | name, contact, email, office, busy |
| `record_payment(booking, amount, ref, method)` | admin **or service role (payment webhook)** | auth, nf, already, amount, status, conflict; `dup:true` when `ref` already recorded |
| `confirm_unpaid`, `mark_refunded`, `admin_create_booking`, `admin_add_block`, `admin_set_membership`, `admin_update_ticket`, `admin_update_customer`, `admin_set_office_available`, `admin_link_tenant`, `admin_unlink_tenant` | admin | auth + the codes of the prototype |
| `admin_set_role(user, role)` | admin | auth, role, self, nf |
| `save_payment_method(user, token, brand, last4, exp)` | **service role only** | auth, card |

Plain table writes by admins (rooms, room_hours, packages, price_rules, offices, office_admin, blocks delete, settings, inquiries status/notes) go straight through RLS.
`customers_v` gives the admin the customer kind: tenant > member > onetime > registered.

## First admin
Admins are never created through sign-up. Create the account in Supabase Dashboard → Authentication → Add user (strong password; enable MFA),
then promote it once, from the SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'office@sabatiers.com';
```

Further admins and tenant accounts are added from the back office (`/admin/team`, `/admin/offices`). The Next.js server action `createAccount` makes the auth user with the service role key (`SUPABASE_SERVICE_ROLE_KEY`), then the admin's own session calls `admin_set_role` or `admin_link_tenant`. Without the key, only people who already have an account can be promoted or linked.

## Storage
`site-images` is a public bucket for photos uploaded from the back office (5 MB, JPEG/PNG/WebP). Only admins can write to it.

## Before launch
- Auth → SMTP: connect a real email provider (the built-in sender only reaches team members and is rate limited). Keep email confirmation on.
- Auth → Providers → Google: add the Client ID/secret.
- Payment provider: webhook → server verifies signature → `record_payment` with the service role. Card forms must be the provider's hosted fields.
- Confirm prices (`rooms.price`, `price_half`, `price_day`) and VAT (`settings.tax_mode`, currently `none`) with the accountant.
- The Supabase linter reports `*_security_definer_function_executable` warnings for the RPCs above. This is intentional: each one checks `auth.uid()` / `private.is_admin()` itself.
