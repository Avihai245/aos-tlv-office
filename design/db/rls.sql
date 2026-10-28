-- AOS · production schema access rules (PostgreSQL / Supabase).
-- Mirrors the access rules enforced client-side in aos-data.js (guard() + per-function ownership checks).
-- Every table has RLS ENABLED and FORCED; nothing is readable or writable without a matching policy.
-- auth.uid() = the signed-in user. Roles live in public.profiles.role: 'customer' | 'admin'.
-- Tenancy: a tenant belongs to an office through public.office_tenants (several tenants per office allowed).

create extension if not exists btree_gist;

-- ── Helpers (SECURITY DEFINER so policies can read roles without recursion) ──
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.my_office_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select office_id from office_tenants where user_id = auth.uid();
$$;
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where user_id = auth.uid() and status = 'active' and (until is null or until > now()));
$$;

-- ── profiles: everyone sees and edits only their own row; role cannot be self-assigned ──
alter table profiles enable row level security; alter table profiles force row level security;
create policy profiles_self_read   on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));
create policy profiles_admin_all   on profiles for all using (is_admin()) with check (is_admin());
-- Sign-up (customer only) happens through the auth trigger; there is no INSERT policy for clients.
-- Tenants are created ONLY by an admin (server function using the service role after is_admin()).

-- ── offices / rooms: public catalogue, admin writes ──
alter table offices enable row level security; alter table offices force row level security;
create policy offices_public_read on offices for select using (available or is_admin() or id in (select my_office_ids()));
create policy offices_admin_write on offices for all using (is_admin()) with check (is_admin());
alter table rooms enable row level security; alter table rooms force row level security;
create policy rooms_public_read on rooms for select using (true);
create policy rooms_admin_write on rooms for all using (is_admin()) with check (is_admin());

-- ── office_tenants: a tenant sees only their own link; only admin links/unlinks ──
alter table office_tenants enable row level security; alter table office_tenants force row level security;
create policy ot_self_read   on office_tenants for select using (user_id = auth.uid() or is_admin());
create policy ot_admin_write on office_tenants for all using (is_admin()) with check (is_admin());

-- ── bookings: one calendar, owner rows only; double booking impossible at the database level ──
alter table bookings enable row level security; alter table bookings force row level security;
alter table bookings add constraint bookings_no_overlap exclude using gist (
  room_id with =, tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('hold', 'pending_payment', 'confirmed'));
create policy bookings_owner_read on bookings for select using (user_id = auth.uid() or is_admin());
-- Clients never insert/update bookings directly: create_hold(), tenant_book(), cancel_booking() are
-- SECURITY DEFINER functions that check auth.uid(), membership/tenancy, the same-day rule and price.
create policy bookings_admin_write on bookings for all using (is_admin()) with check (is_admin());
-- Public availability without personal data:
create or replace view public.busy_slots with (security_barrier) as
  select room_id, starts_at, ends_at from bookings where status in ('hold', 'pending_payment', 'confirmed')
  union all select room_id, starts_at, ends_at from blocks;
grant select on public.busy_slots to anon, authenticated;

alter table blocks enable row level security; alter table blocks force row level security;
create policy blocks_admin on blocks for all using (is_admin()) with check (is_admin());

-- ── payments / invoices / saved cards: owner read-only; written only by the payment webhook (service role) ──
alter table payments enable row level security; alter table payments force row level security;
create policy payments_owner_read on payments for select using (user_id = auth.uid() or is_admin());
alter table payment_methods enable row level security; alter table payment_methods force row level security;
create policy pm_owner_read on payment_methods for select using (user_id = auth.uid() or is_admin());
create policy pm_owner_delete on payment_methods for delete using (user_id = auth.uid());
-- Card data is a provider token + brand/last4 only. Raw card numbers never reach this database.

-- ── memberships: owner reads; activation via payment webhook; self-cancel via function ──
alter table memberships enable row level security; alter table memberships force row level security;
create policy mem_owner_read  on memberships for select using (user_id = auth.uid() or is_admin());
create policy mem_admin_write on memberships for all using (is_admin()) with check (is_admin());

-- ── tickets: scoped to the tenant's OFFICE (all tenants of that office share them) ──
alter table tickets enable row level security; alter table tickets force row level security;
create policy tickets_office_read   on tickets for select using (office_id in (select my_office_ids()) or is_admin());
create policy tickets_tenant_insert on tickets for insert with check (office_id in (select my_office_ids()) and user_id = auth.uid());
create policy tickets_admin_update  on tickets for update using (is_admin()) with check (is_admin());
alter table ticket_messages enable row level security; alter table ticket_messages force row level security;
create policy tm_read on ticket_messages for select using (
  is_admin() or ticket_id in (select id from tickets where office_id in (select my_office_ids())));
create policy tm_insert on ticket_messages for insert with check (
  author_id = auth.uid() and (is_admin() or ticket_id in (select id from tickets where office_id in (select my_office_ids()))));
-- Internal admin notes live in tickets.internal_note; expose tickets to tenants through a view that omits it.

-- ── inquiries / landing-page stats / audit: anyone may submit, only admin reads ──
alter table inquiries enable row level security; alter table inquiries force row level security;
create policy inq_submit on inquiries for insert with check (true);
create policy inq_admin  on inquiries for select using (is_admin());
create policy inq_admin_upd on inquiries for update using (is_admin()) with check (is_admin());
alter table lp_views enable row level security; alter table lp_views force row level security;
create policy lpv_insert on lp_views for insert with check (true);
create policy lpv_admin  on lp_views for select using (is_admin());
alter table audit_log enable row level security; alter table audit_log force row level security;
create policy audit_admin_read on audit_log for select using (is_admin());
-- audit_log is append-only: written by triggers, no UPDATE/DELETE policy for anyone.
