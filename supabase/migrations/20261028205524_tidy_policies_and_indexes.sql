-- AOS · advisor follow-ups: one SELECT policy per table (admin writes split by action) and covering indexes for foreign keys.

drop policy rooms_admin_write on public.rooms;
create policy rooms_admin_insert on public.rooms for insert to authenticated with check ((select private.is_admin()));
create policy rooms_admin_update on public.rooms for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy rooms_admin_delete on public.rooms for delete to authenticated using ((select private.is_admin()));

drop policy room_hours_admin_write on public.room_hours;
create policy room_hours_admin_insert on public.room_hours for insert to authenticated with check ((select private.is_admin()));
create policy room_hours_admin_update on public.room_hours for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy room_hours_admin_delete on public.room_hours for delete to authenticated using ((select private.is_admin()));

drop policy packages_admin_write on public.packages;
create policy packages_admin_insert on public.packages for insert to authenticated with check ((select private.is_admin()));
create policy packages_admin_update on public.packages for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy packages_admin_delete on public.packages for delete to authenticated using ((select private.is_admin()));

drop policy offices_admin_write on public.offices;
create policy offices_admin_insert on public.offices for insert to authenticated with check ((select private.is_admin()));
create policy offices_admin_update on public.offices for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy offices_admin_delete on public.offices for delete to authenticated using ((select private.is_admin()));

create index blocks_created_by_idx on public.blocks (created_by);
create index bookings_package_idx on public.bookings (package);
create index inquiries_office_idx on public.inquiries (office_id);
create index inquiries_user_idx on public.inquiries (user_id);
create index office_tenants_created_by_idx on public.office_tenants (created_by);
create index ticket_messages_author_idx on public.ticket_messages (author_id);
create index tickets_user_idx on public.tickets (user_id);
