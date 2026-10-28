-- AOS · access rules. Mirrors project/db/rls.sql, adapted to the real schema.
-- Clients can READ what their role allows; every booking/payment/membership WRITE goes through an RPC (next migrations).

-- ── Helpers. In `private` so they are not exposed through the Data API. ──
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
create or replace function private.my_office_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select office_id from public.office_tenants where user_id = (select auth.uid());
$$;
create or replace function private.is_member(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.user_id = p_uid and m.status = 'active' and (m.until is null or m.until > now()));
$$;
revoke all on function private.is_admin(), private.my_office_ids(), private.is_member(uuid) from public;
grant execute on function private.is_admin(), private.my_office_ids(), private.is_member(uuid) to anon, authenticated, service_role;

-- ── Public catalogue ──
create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_admin_update on public.settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy packages_read on public.packages for select to anon, authenticated using (true);
create policy packages_admin_write on public.packages for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy rooms_read on public.rooms for select to anon, authenticated
  using (visible or (select private.is_admin()));
create policy rooms_admin_write on public.rooms for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy room_hours_read on public.room_hours for select to anon, authenticated using (true);
create policy room_hours_admin_write on public.room_hours for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Price rules are applied inside the pricing functions; only admins read or edit them directly.
create policy price_rules_admin on public.price_rules for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy offices_read on public.offices for select to anon, authenticated
  using (visible or (select private.is_admin()) or id in (select private.my_office_ids()));
create policy offices_admin_write on public.offices for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy office_admin_admin on public.office_admin for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy office_tenants_read on public.office_tenants for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ── Profiles: own row (or admin). Clients may change name/phone/company only (column grants). ──
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ── Bookings: owner, the tenant's office, or admin. No client write policies: writes are RPC-only. ──
create policy bookings_read on public.bookings for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin())
         or (office_id is not null and office_id in (select private.my_office_ids())));
create policy booking_events_read on public.booking_events for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_events.booking_id));

create policy blocks_admin on public.blocks for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ── Money ──
create policy payments_read on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy payment_methods_read on public.payment_methods for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy payment_methods_delete on public.payment_methods for delete to authenticated
  using (user_id = (select auth.uid()));
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ── Tickets: shared by every tenant of the office ──
create policy tickets_read on public.tickets for select to authenticated
  using (office_id in (select private.my_office_ids()) or (select private.is_admin()));
create policy ticket_messages_read on public.ticket_messages for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_messages.ticket_id));
create policy ticket_internal_admin on public.ticket_internal for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ── Inquiries / stats / audit: submissions go through RPCs; only admins read ──
create policy inquiries_admin_read on public.inquiries for select to authenticated using ((select private.is_admin()));
create policy inquiries_admin_update on public.inquiries for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy lp_views_admin_read on public.lp_views for select to authenticated using ((select private.is_admin()));
create policy audit_log_admin_read on public.audit_log for select to authenticated using ((select private.is_admin()));

-- ── Table privileges (RLS decides the rows; these decide whether the table is reachable at all) ──
grant select on public.settings, public.packages, public.rooms, public.room_hours, public.offices to anon, authenticated;
grant select on public.profiles, public.office_tenants, public.bookings, public.booking_events, public.payments,
                public.memberships, public.tickets, public.ticket_messages, public.audit_log, public.lp_views to authenticated;
grant update (name, phone, company) on public.profiles to authenticated;
-- Never expose the provider token to browsers.
grant select (user_id, brand, last4, exp, created_at) on public.payment_methods to authenticated;
grant delete on public.payment_methods to authenticated;
-- Admin-edited tables (policies above restrict to admins).
grant insert, update, delete on public.rooms, public.room_hours, public.packages, public.price_rules,
                                public.offices, public.office_admin, public.blocks to authenticated;
grant update on public.settings to authenticated;
grant select on public.office_admin, public.price_rules, public.blocks to authenticated;
grant select, insert, update, delete on public.ticket_internal to authenticated;
grant select, update on public.inquiries to authenticated;
