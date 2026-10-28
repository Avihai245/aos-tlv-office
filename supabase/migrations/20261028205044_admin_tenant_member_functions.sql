-- AOS · payments, admin operations, tenants, membership, tickets, inquiries, landing-page stats.
-- Same conventions as the booking functions: jsonb { ... } / { err }, validation before writes.

-- Direct deletes of a saved card would leave auto-pay on; go through remove_payment_method().
drop policy payment_methods_delete on public.payment_methods;
revoke delete on public.payment_methods from authenticated;

-- ── Payments (admin, or the payment webhook running with the service role) ──
create or replace function public.record_payment(p_booking uuid, p_amount numeric, p_ref text default null, p_method text default 'offline') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.bookings; v_p public.payments; v_who text; v_ref text;
begin
  if not (private.is_admin() or coalesce(auth.role(), '') = 'service_role') then return jsonb_build_object('err', 'auth'); end if;
  v_who := coalesce(private.actor_email(), 'webhook');
  v_ref := nullif(left(trim(coalesce(p_ref, '')), 80), '');
  if v_ref is not null then
    select * into v_p from public.payments where ref = v_ref;
    if found then return jsonb_build_object('payment', to_jsonb(v_p), 'dup', true); end if;
  end if;
  select * into v_b from public.bookings where id = p_booking for update;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  if v_b.pay = 'paid' then return jsonb_build_object('err', 'already'); end if;
  if p_amount is null or abs(p_amount - v_b.total) > 0.009 then return jsonb_build_object('err', 'amount'); end if;
  if v_b.status not in ('hold', 'pending_payment', 'expired', 'confirmed') then return jsonb_build_object('err', 'status'); end if;
  begin
    -- An expired request re-enters the overlap constraint here: a slot that was lost meanwhile is refused.
    update public.bookings set pay = 'paid', status = 'confirmed', expires_at = null where id = v_b.id returning * into v_b;
    insert into public.payments (booking_id, user_id, amount, ref, method, status, by_email)
    values (v_b.id, v_b.user_id, v_b.total, coalesce(v_ref, 'OFF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))),
            left(coalesce(nullif(trim(p_method), ''), 'offline'), 30), 'verified', v_who)
    returning * into v_p;
  exception
    when exclusion_violation then return jsonb_build_object('err', 'conflict');
    when unique_violation then
      select * into v_p from public.payments where ref = v_ref;
      return jsonb_build_object('payment', to_jsonb(v_p), 'dup', true);
  end;
  perform private.booking_event(v_b.id, 'confirmed', v_who, 'payment ' || v_p.method || ' ' || v_p.ref);
  perform private.audit('payment.record', v_b.id::text);
  return jsonb_build_object('payment', to_jsonb(v_p), 'booking', private.booking_json(v_b));
end $$;

create or replace function public.confirm_unpaid(p_booking uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.bookings;
begin
  if not private.is_admin() then return jsonb_build_object('err', 'auth'); end if;
  select * into v_b from public.bookings where id = p_booking and status in ('hold', 'pending_payment') for update;
  if not found then return jsonb_build_object('err', 'status'); end if;
  update public.bookings set status = 'confirmed', pay = 'unpaid', expires_at = null where id = v_b.id returning * into v_b;
  perform private.booking_event(v_b.id, 'confirmed', private.actor_email(), 'manual, unpaid');
  perform private.audit('booking.confirm', v_b.id::text);
  return jsonb_build_object('booking', private.booking_json(v_b));
end $$;

create or replace function public.mark_refunded(p_booking uuid, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.bookings; v_ref text := nullif(left(trim(coalesce(p_ref, '')), 80), '');
begin
  if not private.is_admin() then return jsonb_build_object('err', 'auth'); end if;
  select * into v_b from public.bookings where id = p_booking and pay = 'refund_pending' for update;
  if not found then return jsonb_build_object('err', 'status'); end if;
  begin
    insert into public.payments (booking_id, user_id, amount, ref, method, status, by_email)
    values (v_b.id, v_b.user_id, -v_b.total, coalesce(v_ref, 'RF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))),
            'refund', 'refund', private.actor_email());
  exception when unique_violation then return jsonb_build_object('err', 'dup');
  end;
  update public.bookings set pay = 'refunded' where id = v_b.id returning * into v_b;
  perform private.booking_event(v_b.id, 'refunded', private.actor_email(), coalesce(v_ref, ''));
  perform private.audit('payment.refund', v_b.id::text);
  return jsonb_build_object('booking', private.booking_json(v_b));
end $$;

-- ── Admin: manual bookings and blocks ──
create or replace function public.admin_create_booking(p_room uuid, p_date date, p_start numeric, p_end numeric, p_name text,
                                                       p_email text default '', p_phone text default '', p_paid boolean default false,
                                                       p_note text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 80); v_email text := lower(left(trim(coalesce(p_email, '')), 120));
  v_room public.rooms; v_pkg public.packages; v_hours public.room_hours; v_uid uuid; v_prof public.profiles;
  v_from timestamptz; v_to timestamptz; v_q jsonb; v_b public.bookings; v_who text;
  v_now timestamp := now() at time zone 'Asia/Jerusalem'; v_nowh numeric;
begin
  if not private.is_admin() then return jsonb_build_object('err', 'auth'); end if;
  if v_name = '' then return jsonb_build_object('err', 'name'); end if;
  if v_email <> '' and not private.email_ok(v_email) then return jsonb_build_object('err', 'email'); end if;
  select * into v_room from public.rooms where id = p_room;
  if not found then return jsonb_build_object('err', 'room'); end if;
  perform private.sweep_expired();
  select * into v_pkg from public.packages where hours = coalesce(p_end, p_start + 3) - p_start and p_start = any (starts) order by sort_order limit 1;
  if not found then select * into v_pkg from public.packages order by sort_order limit 1; end if;
  select * into v_hours from public.room_hours where room_id = p_room and dow = extract(dow from p_date)::int;
  if not found or p_start < v_hours.open_hour or p_start + v_pkg.hours > v_hours.close_hour or not (p_start = any (v_pkg.starts)) then
    return jsonb_build_object('err', 'slot');
  end if;
  v_nowh := extract(hour from v_now) + extract(minute from v_now) / 60.0;
  if p_date < v_now::date or (p_date = v_now::date and p_start <= v_nowh) then return jsonb_build_object('err', 'slot'); end if;
  v_from := private.at_local(p_date, p_start);
  v_to := private.at_local(p_date, p_start + v_pkg.hours);
  if private.slot_state(p_room, v_from, v_to) <> 'free' then return jsonb_build_object('err', 'taken'); end if;
  if v_email <> '' then select * into v_prof from public.profiles where lower(email) = v_email; v_uid := v_prof.id; end if;
  v_q := private.quote(p_room, p_date, p_start, v_pkg.id, false);
  v_who := private.actor_email();
  begin
    insert into public.bookings (room_id, user_id, name, email, phone, company, starts_at, ends_at, package, status, pay, quote, total, source, note)
    values (p_room, v_uid, v_name, v_email, left(trim(coalesce(p_phone, '')), 30), coalesce(v_prof.company, ''), v_from, v_to, v_pkg.id,
            'confirmed', 'unpaid', v_q, (v_q ->> 'total')::numeric, 'admin', left(coalesce(p_note, ''), 500))
    returning * into v_b;
  exception when exclusion_violation then return jsonb_build_object('err', 'taken');
  end;
  perform private.booking_event(v_b.id, 'confirmed', v_who, 'manual booking');
  if p_paid then
    insert into public.payments (booking_id, user_id, amount, ref, method, status, by_email)
    values (v_b.id, v_uid, v_b.total, 'OFF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7)), 'offline', 'verified', v_who);
    update public.bookings set pay = 'paid' where id = v_b.id returning * into v_b;
  end if;
  perform private.audit('booking.manual', v_b.id::text);
  return jsonb_build_object('booking', private.booking_json(v_b));
end $$;

-- p_room null = every room.
create or replace function public.admin_add_block(p_room uuid, p_date date, p_start numeric, p_end numeric, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_from timestamptz; v_to timestamptz; v_r uuid; v_ids uuid[];
begin
  if not private.is_admin() then return jsonb_build_object('err', 'auth'); end if;
  if p_date is null or p_start is null or p_end is null or not (p_end > p_start) then return jsonb_build_object('err', 'range'); end if;
  v_from := private.at_local(p_date, p_start);
  v_to := private.at_local(p_date, p_end);
  select array_agg(id) into v_ids from public.rooms where p_room is null or id = p_room;
  if v_ids is null then return jsonb_build_object('err', 'nf'); end if;
  perform private.sweep_expired();
  foreach v_r in array v_ids loop
    if private.slot_state(v_r, v_from, v_to) in ('booked', 'held') then return jsonb_build_object('err', 'conflict'); end if;
  end loop;
  begin
    foreach v_r in array v_ids loop
      insert into public.blocks (room_id, starts_at, ends_at, reason, created_by)
      values (v_r, v_from, v_to, left(coalesce(p_reason, ''), 200), auth.uid());
    end loop;
  exception when exclusion_violation then return jsonb_build_object('err', 'conflict');
  end;
  return jsonb_build_object('ok', true);
end $$;

-- ── Office tenants: hourly meeting-room bookings, monthly free hours first ──
create or replace function public.tenant_book(p_date date, p_start numeric, p_hours int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_user public.profiles; v_o public.offices; v_room public.rooms; v_set public.settings; v_hours public.room_hours;
  v_start numeric := floor(coalesce(p_start, -1)); v_from timestamptz; v_to timestamptz; v_used numeric; v_free numeric; v_paid numeric;
  v_rate numeric; v_base numeric; v_tax numeric := 0; v_total numeric; v_q jsonb; v_b public.bookings;
  v_now timestamp := now() at time zone 'Asia/Jerusalem'; v_today date; v_nowh numeric;
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  select * into v_user from public.profiles where id = v_uid;
  if not found then return jsonb_build_object('err', 'auth'); end if;
  select o.* into v_o from public.offices o join public.office_tenants t on t.office_id = o.id where t.user_id = v_uid;
  if not found then return jsonb_build_object('err', 'tenant'); end if;
  select * into v_room from public.rooms where status = 'active' order by sort_order limit 1;
  if not found then return jsonb_build_object('err', 'room'); end if;
  if p_date is null or v_start < 0 or p_hours is null or p_hours < 1 then return jsonb_build_object('err', 'slot'); end if;
  select * into v_set from public.settings where id = 1;
  v_today := v_now::date;
  v_nowh := extract(hour from v_now) + extract(minute from v_now) / 60.0;
  if p_date < v_today or (p_date = v_today and v_start < v_nowh) then return jsonb_build_object('err', 'slot'); end if;
  if p_date > v_today + v_set.window_days then return jsonb_build_object('err', 'window'); end if;
  select * into v_hours from public.room_hours where room_id = v_room.id and dow = extract(dow from p_date)::int;
  if not found or v_start < v_hours.open_hour or v_start + p_hours > v_hours.close_hour then return jsonb_build_object('err', 'slot'); end if;
  perform private.sweep_expired();
  v_from := private.at_local(p_date, v_start);
  v_to := private.at_local(p_date, v_start + p_hours);
  if private.slot_state(v_room.id, v_from, v_to) <> 'free' then return jsonb_build_object('err', 'taken'); end if;

  perform pg_advisory_xact_lock(hashtextextended('office:' || v_o.id::text, 0));   -- free hours are a shared monthly allowance
  select coalesce(sum(free_hours), 0) into v_used from public.bookings
   where office_id = v_o.id and tenant and status = 'confirmed' and to_char(private.local_date(starts_at), 'YYYY-MM') = to_char(p_date, 'YYYY-MM');
  v_free := least(p_hours, greatest(0, v_o.free_hours - v_used));
  v_paid := p_hours - v_free;
  v_rate := coalesce(v_o.hour_rate, round(v_room.price / 3));
  v_base := v_paid * v_rate;
  v_total := v_base;
  if v_set.tax_mode = 'added' then v_tax := round(v_base * v_set.tax_pct / 100, 2); v_total := v_base + v_tax;
  elsif v_set.tax_mode = 'included' then v_tax := round(v_base - v_base / (1 + v_set.tax_pct / 100), 2);
  end if;
  v_q := jsonb_build_object('base', v_base, 'unit', v_rate, 'blocks', 1, 'disc', 0, 'extras', '[]'::jsonb, 'sub', v_base, 'tax', v_tax,
                            'taxMode', v_set.tax_mode, 'taxPct', v_set.tax_pct, 'total', round(v_total, 2), 'tenant', true,
                            'hours', p_hours, 'freeHours', v_free, 'paidHours', v_paid);
  begin
    insert into public.bookings (room_id, user_id, name, email, phone, company, starts_at, ends_at, status, pay, quote, total, source,
                                 tenant, office_id, free_hours, paid_hours)
    values (v_room.id, v_uid, v_user.name, v_user.email, v_user.phone, v_user.company, v_from, v_to, 'confirmed',
            case when v_paid > 0 then 'unpaid' else 'none' end, v_q, round(v_total, 2), 'tenant', true, v_o.id, v_free, v_paid)
    returning * into v_b;
  exception when exclusion_violation then return jsonb_build_object('err', 'taken');
  end;
  perform private.booking_event(v_b.id, 'confirmed', v_user.email, 'tenant booking · ' || v_o.code);
  perform private.audit('tenant.book', v_b.id::text);
  return jsonb_build_object('booking', private.booking_json(v_b));
end $$;

-- ── Membership (20% off, same-day booking). Activation after payment is admin/webhook (admin_set_membership). ──
create or replace function public.request_membership() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_user public.profiles; v_set public.settings; v_m public.memberships; v_vat numeric; v_total numeric;
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  select * into v_user from public.profiles where id = v_uid and role = 'customer';
  if not found then return jsonb_build_object('err', 'auth'); end if;
  select * into v_m from public.memberships where user_id = v_uid;
  if found and v_m.status in ('active', 'pending_payment') then return jsonb_build_object('membership', to_jsonb(v_m), 'dup', true); end if;
  select * into v_set from public.settings where id = 1;
  v_vat := round(v_set.member_price * v_set.tax_pct / 100, 2);
  v_total := round(v_set.member_price * (100 + v_set.tax_pct) / 100, 2);
  insert into public.memberships (user_id, status, price, vat_pct, total, requested_at)
  values (v_uid, 'pending_payment', v_set.member_price, v_set.tax_pct, v_total, now())
  on conflict (user_id) do update
    set status = 'pending_payment', price = excluded.price, vat_pct = excluded.vat_pct, total = excluded.total,
        requested_at = now(), since = null, until = null, cancel_at = null, cancelled_at = null
  returning * into v_m;
  insert into public.inquiries (kind, interest, name, phone, email, msg, user_id)
  values ('membership', 'membership', coalesce(nullif(v_user.name, ''), v_user.email), v_user.phone, v_user.email,
          'בקשת מנוי חדר ישיבות · ' || v_total || ' ₪ לחודש כולל מע״מ', v_uid);
  perform private.audit('membership.request', v_uid::text);
  return jsonb_build_object('membership', to_jsonb(v_m));
end $$;

create or replace function public.cancel_membership() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_m public.memberships;
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  select * into v_m from public.memberships where user_id = v_uid for update;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  if v_m.status = 'pending_payment' then
    update public.memberships set status = 'cancelled', cancelled_at = now() where user_id = v_uid returning * into v_m;
    perform private.audit('membership.cancel_request', v_uid::text);
    return jsonb_build_object('membership', to_jsonb(v_m), 'immediate', true);
  end if;
  if not private.is_member(v_uid) then return jsonb_build_object('err', 'status'); end if;
  if v_m.cancel_at is not null then return jsonb_build_object('membership', to_jsonb(v_m), 'dup', true); end if;
  -- Benefits stay until the end of the paid period.
  update public.memberships set cancel_at = coalesce(v_m.until, now()), cancelled_at = now() where user_id = v_uid returning * into v_m;
  perform private.audit('membership.cancel', v_uid::text);
  return jsonb_build_object('membership', to_jsonb(v_m));
end $$;

create or replace function public.resume_membership() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_m public.memberships;
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  select * into v_m from public.memberships where user_id = v_uid for update;
  if not found then return jsonb_build_object('err', 'auth'); end if;
  if not private.is_member(v_uid) or v_m.cancel_at is null then return jsonb_build_object('err', 'status'); end if;
  update public.memberships set cancel_at = null, cancelled_at = null where user_id = v_uid returning * into v_m;
  perform private.audit('membership.resume', v_uid::text);
  return jsonb_build_object('membership', to_jsonb(v_m));
end $$;

create or replace function public.admin_set_membership(p_user uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_m public.memberships;
begin
  if not private.is_admin() then return jsonb_build_object('err', 'auth'); end if;
  if p_status not in ('active', 'cancelled', 'pending_payment') then return jsonb_build_object('err', 'status'); end if;
  select * into v_m from public.memberships where user_id = p_user for update;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  if p_status = 'active' then
    update public.memberships set status = 'active', since = now(), until = now() + interval '31 days', cancel_at = null, cancelled_at = null
     where user_id = p_user returning * into v_m;
  else
    update public.memberships set status = p_status, cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
     where user_id = p_user returning * into v_m;
  end if;
  perform private.audit('membership.' || p_status, p_user::text);
  return jsonb_build_object('membership', to_jsonb(v_m));
end $$;

-- ── Tenant service tickets ──
create or replace function public.open_ticket(p_kind text, p_subject text, p_msg text default '', p_images text[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_user public.profiles; v_office uuid; v_t public.tickets; v_subject text := left(trim(coalesce(p_subject, '')), 120); v_msg text := left(trim(coalesce(p_msg, '')), 3000);
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  select * into v_user from public.profiles where id = v_uid;
  if not found then return jsonb_build_object('err', 'auth'); end if;
  select office_id into v_office from public.office_tenants where user_id = v_uid;
  if v_office is null then return jsonb_build_object('err', 'tenant'); end if;
  if v_subject = '' then return jsonb_build_object('err', 'subject'); end if;
  insert into public.tickets (office_id, user_id, kind, subject, images)
  values (v_office, v_uid, case when p_kind = 'request' then 'request' else 'fault' end, v_subject, (coalesce(p_images, '{}'))[1:3])
  returning * into v_t;
  if v_msg <> '' then
    insert into public.ticket_messages (ticket_id, author_id, by, name, text) values (v_t.id, v_uid, 'tenant', coalesce(nullif(v_user.name, ''), v_user.email), v_msg);
  end if;
  perform private.audit('ticket.open', v_t.id::text);
  return jsonb_build_object('ticket', to_jsonb(v_t));
end $$;

create or replace function public.post_ticket_msg(p_ticket uuid, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_user public.profiles; v_t public.tickets; v_adm boolean; v_text text := left(trim(coalesce(p_text, '')), 3000);
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  select * into v_user from public.profiles where id = v_uid;
  if not found then return jsonb_build_object('err', 'auth'); end if;
  select * into v_t from public.tickets where id = p_ticket;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  v_adm := private.is_admin();
  if not v_adm and not exists (select 1 from public.office_tenants where user_id = v_uid and office_id = v_t.office_id) then
    return jsonb_build_object('err', 'auth');
  end if;
  if v_text = '' then return jsonb_build_object('err', 'msg'); end if;
  insert into public.ticket_messages (ticket_id, author_id, by, name, text)
  values (v_t.id, v_uid, case when v_adm then 'staff' else 'tenant' end, coalesce(nullif(v_user.name, ''), v_user.email), v_text);
  update public.tickets set updated_at = now() where id = v_t.id returning * into v_t;
  perform private.audit('ticket.msg', v_t.id::text);
  return jsonb_build_object('ticket', to_jsonb(v_t));
end $$;

create or replace function public.admin_update_ticket(p_ticket uuid, p_status text default null, p_reply text default null, p_internal text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_t public.tickets; v_user public.profiles; v_reply text := left(trim(coalesce(p_reply, '')), 3000);
begin
  if not private.is_admin() then return jsonb_build_object('err', 'auth'); end if;
  select * into v_t from public.tickets where id = p_ticket for update;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  select * into v_user from public.profiles where id = auth.uid();
  if p_status in ('open', 'progress', 'done') and p_status <> v_t.status then
    update public.tickets set status = p_status where id = v_t.id;
    insert into public.ticket_messages (ticket_id, author_id, by, status) values (v_t.id, auth.uid(), 'system', p_status);
  end if;
  if v_reply <> '' then
    insert into public.ticket_messages (ticket_id, author_id, by, name, text) values (v_t.id, auth.uid(), 'staff', coalesce(nullif(v_user.name, ''), v_user.email), v_reply);
  end if;
  if p_internal is not null then
    insert into public.ticket_internal (ticket_id, note) values (v_t.id, left(p_internal, 3000))
    on conflict (ticket_id) do update set note = excluded.note;
  end if;
  update public.tickets set updated_at = now() where id = v_t.id returning * into v_t;
  perform private.audit('ticket.' || v_t.status, v_t.id::text);
  return jsonb_build_object('ticket', to_jsonb(v_t));
end $$;

-- ── Public forms ──
create or replace function public.add_inquiry(p_kind text, p_office uuid, p_interest text, p_name text, p_phone text default '', p_email text default '',
                                              p_msg text default '', p_source text default null, p_utm text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 80); v_phone text := left(trim(coalesce(p_phone, '')), 30);
  v_email text := lower(left(trim(coalesce(p_email, '')), 120)); v_q public.inquiries;
begin
  if v_name = '' then return jsonb_build_object('err', 'name'); end if;
  if not (private.phone_ok(v_phone) or private.email_ok(v_email)) then return jsonb_build_object('err', 'contact'); end if;
  if v_email <> '' and not private.email_ok(v_email) then return jsonb_build_object('err', 'email'); end if;
  if p_office is not null and not exists (select 1 from public.offices where id = p_office and visible and status in ('available', 'unset')) then
    return jsonb_build_object('err', 'office');
  end if;
  if (select count(*) from public.inquiries where created_at > now() - interval '1 minute') >= 30 then return jsonb_build_object('err', 'busy'); end if;
  select * into v_q from public.inquiries
   where office_id is not distinct from p_office and created_at > now() - interval '1 minute'
     and ((v_email <> '' and email = v_email) or (v_phone <> '' and phone = v_phone)) limit 1;
  if found then return jsonb_build_object('inquiry', jsonb_build_object('id', v_q.id), 'dup', true); end if;
  insert into public.inquiries (kind, office_id, interest, name, phone, email, msg, source, utm, user_id)
  values (case when p_kind in ('contact', 'office', 'membership', 'tour') then p_kind else 'contact' end, p_office, left(p_interest, 40),
          v_name, v_phone, v_email, left(coalesce(p_msg, ''), 2000), left(nullif(trim(coalesce(p_source, '')), ''), 40), left(coalesce(p_utm, ''), 160), auth.uid())
  returning * into v_q;
  perform private.audit('inquiry.create', v_q.id::text);
  return jsonb_build_object('inquiry', jsonb_build_object('id', v_q.id));
end $$;

create or replace function public.lp_view(p_lp text, p_utm text default '') returns void
language sql security definer set search_path = '' as $$
  insert into public.lp_views (lp, day, utm, total)
  select p_lp, private.local_date(now()), coalesce(nullif(left(trim(coalesce(p_utm, '')), 160), ''), '—'), 1
   where p_lp in ('room', 'offices', 'home')
  on conflict (lp, day, utm) do update set total = public.lp_views.total + 1 $$;

-- ── Admin: customers, offices, tenants ──
create or replace function public.admin_update_customer(p_user uuid, p_type text default null, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_p public.profiles;
begin
  if not private.is_admin() then return jsonb_build_object('err', 'auth'); end if;
  update public.profiles
     set type = case when p_type in ('meeting', 'tenant') then p_type else type end,
         notes = coalesce(left(p_notes, 3000), notes)
   where id = p_user and role = 'customer' returning * into v_p;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  perform private.audit('customer.update', p_user::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_set_office_available(p_office uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_o public.offices;
begin
  if not private.is_admin() then return jsonb_build_object('err', 'auth'); end if;
  update public.offices set status = case when p_on then 'available' else 'unavailable' end, visible = coalesce(p_on, false)
   where id = p_office returning * into v_o;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  return jsonb_build_object('office', to_jsonb(v_o));
end $$;

-- The account itself is created by the server (auth admin API); this links it to an office. Tenant access is never self-service.
create or replace function public.admin_link_tenant(p_office uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_o public.offices; v_p public.profiles;
begin
  if not private.is_admin() then return jsonb_build_object('err', 'auth'); end if;
  select * into v_o from public.offices where id = p_office;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  select * into v_p from public.profiles where id = p_user and role = 'customer';
  if not found then return jsonb_build_object('err', 'taken'); end if;
  delete from public.office_tenants where user_id = p_user and office_id <> p_office;
  insert into public.office_tenants (office_id, user_id, created_by) values (p_office, p_user, auth.uid()) on conflict do nothing;
  update public.profiles set type = 'tenant' where id = p_user;
  update public.offices set status = 'occupied' where id = p_office and status in ('available', 'unset');
  insert into public.office_admin (office_id, tenant_name, tenant_email, tenant_phone, tenant_since)
  values (p_office, coalesce(nullif(v_p.company, ''), v_p.name), v_p.email, v_p.phone, private.local_date(now()))
  on conflict (office_id) do update
    set tenant_name = coalesce(nullif(public.office_admin.tenant_name, ''), excluded.tenant_name),
        tenant_email = coalesce(nullif(public.office_admin.tenant_email, ''), excluded.tenant_email),
        tenant_phone = coalesce(nullif(public.office_admin.tenant_phone, ''), excluded.tenant_phone),
        tenant_since = coalesce(public.office_admin.tenant_since, excluded.tenant_since);
  perform private.audit('tenant.create', p_office::text || ':' || v_p.email);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_unlink_tenant(p_office uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then return jsonb_build_object('err', 'auth'); end if;
  delete from public.office_tenants where office_id = p_office and user_id = p_user;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  update public.profiles set type = 'meeting' where id = p_user;
  perform private.audit('tenant.unlink', p_office::text);
  return jsonb_build_object('ok', true);
end $$;

-- ── Billing preferences. The card token is written only by the server after the provider's hosted form returns it. ──
create or replace function public.set_auto_pay(p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  if p_on and not exists (select 1 from public.payment_methods where user_id = v_uid) then return jsonb_build_object('err', 'card'); end if;
  update public.profiles set auto_pay = coalesce(p_on, false) where id = v_uid;
  return jsonb_build_object('autoPay', coalesce(p_on, false));
end $$;

create or replace function public.remove_payment_method() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  delete from public.payment_methods where user_id = v_uid;
  update public.profiles set auto_pay = false where id = v_uid;
  perform private.audit('card.remove', v_uid::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.save_payment_method(p_user uuid, p_token text, p_brand text, p_last4 text, p_exp text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then return jsonb_build_object('err', 'auth'); end if;
  if coalesce(p_token, '') = '' or coalesce(p_last4, '') !~ '^[0-9]{4}$' then return jsonb_build_object('err', 'card'); end if;
  insert into public.payment_methods (user_id, token, brand, last4, exp)
  values (p_user, left(p_token, 200), left(coalesce(p_brand, ''), 20), p_last4, left(coalesce(p_exp, ''), 7))
  on conflict (user_id) do update set token = excluded.token, brand = excluded.brand, last4 = excluded.last4, exp = excluded.exp, created_at = now();
  return jsonb_build_object('card', jsonb_build_object('brand', left(coalesce(p_brand, ''), 20), 'last4', p_last4, 'exp', left(coalesce(p_exp, ''), 7)));
end $$;

-- ── Customer classification for the admin: tenant > member > one-time buyer > registered ──
create or replace view public.customers_v with (security_invoker = true) as
select p.id, p.email, p.name, p.phone, p.company, p.type, p.notes, p.created_at, p.last_login_at,
  case
    when exists (select 1 from public.office_tenants t where t.user_id = p.id) then 'tenant'
    when exists (select 1 from public.memberships m where m.user_id = p.id
                   and (m.status = 'pending_payment' or (m.status = 'active' and (m.until is null or m.until > now())))) then 'member'
    when exists (select 1 from public.bookings b where b.user_id = p.id and b.status not in ('hold', 'released')) then 'onetime'
    else 'registered' end as kind
from public.profiles p where p.role = 'customer';
grant select on public.customers_v to authenticated;

-- ── Sweep: close every function by default, then open exactly what is meant to be callable ──
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('public', 'private') and p.prokind = 'f' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function private.is_admin(), private.my_office_ids(), private.is_member(uuid) to anon, authenticated;

grant execute on function
  public.get_day_slots(uuid, date, int, text), public.quote_booking(uuid, date, numeric, numeric),
  public.add_inquiry(text, uuid, text, text, text, text, text, text, text), public.lp_view(text, text)
  to anon, authenticated;

grant execute on function
  public.create_hold(uuid, date, numeric, numeric, text, text), public.request_booking(uuid), public.release_hold(uuid),
  public.cancel_booking(uuid, text), public.tenant_book(date, numeric, int),
  public.request_membership(), public.cancel_membership(), public.resume_membership(),
  public.open_ticket(text, text, text, text[]), public.post_ticket_msg(uuid, text),
  public.set_auto_pay(boolean), public.remove_payment_method(),
  public.record_payment(uuid, numeric, text, text), public.confirm_unpaid(uuid), public.mark_refunded(uuid, text),
  public.admin_create_booking(uuid, date, numeric, numeric, text, text, text, boolean, text),
  public.admin_add_block(uuid, date, numeric, numeric, text), public.admin_set_membership(uuid, text),
  public.admin_update_ticket(uuid, text, text, text), public.admin_update_customer(uuid, text, text),
  public.admin_set_office_available(uuid, boolean), public.admin_link_tenant(uuid, uuid), public.admin_unlink_tenant(uuid, uuid)
  to authenticated;
-- save_payment_method stays service_role only.
