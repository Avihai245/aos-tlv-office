-- AOS · pricing, availability and the customer booking flow (server-side port of aos-data.js).
-- RPCs return jsonb: { booking } / { err: '<code>' }, using the prototype's error codes.
-- Validation happens before any write, so an { err } return never leaves partial changes behind.

-- ── Small helpers ──
create or replace function private.email_ok(p text) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p, '') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' $$;
create or replace function private.phone_ok(p text) returns boolean language sql immutable set search_path = '' as $$
  select length(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g')) >= 9 $$;

create or replace function private.local_date(p_ts timestamptz) returns date language sql stable set search_path = '' as $$
  select (p_ts at time zone 'Asia/Jerusalem')::date $$;
create or replace function private.local_hour(p_ts timestamptz) returns numeric language sql stable set search_path = '' as $$
  select round((extract(epoch from ((p_ts at time zone 'Asia/Jerusalem')::time)) / 3600.0)::numeric, 2) $$;
create or replace function private.at_local(p_date date, p_hour numeric) returns timestamptz language sql stable set search_path = '' as $$
  select (p_date::timestamp + (p_hour::double precision * interval '1 hour')) at time zone 'Asia/Jerusalem' $$;

create or replace function private.actor_email() returns text language sql stable security definer set search_path = '' as $$
  select email from public.profiles where id = (select auth.uid()) $$;

create or replace function private.booking_event(p_booking uuid, p_status text, p_by text, p_note text default '') returns void
language sql security definer set search_path = '' as $$
  insert into public.booking_events (booking_id, status, by, note) values (p_booking, p_status, coalesce(p_by, 'system'), coalesce(p_note, '')) $$;

create or replace function private.booking_json(b public.bookings) returns jsonb language sql stable set search_path = '' as $$
  select to_jsonb(b) || jsonb_build_object('date', private.local_date(b.starts_at),
                                           'start', private.local_hour(b.starts_at),
                                           'end', private.local_hour(b.ends_at)) $$;

-- Expired holds and unpaid requests free their slot. Runs from every write path and from pg_cron.
create or replace function private.sweep_expired() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with u as (
    update public.bookings
       set status = 'expired', pay = case when pay = 'awaiting' then 'none' else pay end
     where status in ('hold', 'pending_payment') and expires_at is not null and expires_at < now()
     returning id)
  insert into public.booking_events (booking_id, status, by, note) select id, 'expired', 'system', '' from u;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── Pricing: date-range overrides and time-of-day percentage discounts (blockPrice / quote) ──
create or replace function private.block_price(p_room uuid, p_date date, p_start numeric, p_pkg text) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare r public.rooms; p numeric; dr public.price_rules; hr public.price_rules;
begin
  select * into r from public.rooms where id = p_room;
  if not found then return 0; end if;
  p := case p_pkg when 'half' then r.price_half when 'day' then r.price_day else r.price end;
  select * into dr from public.price_rules
   where room_id = p_room and type = 'date' and p_date between from_date and to_date
   order by created_at desc limit 1;
  if found then
    -- A date rule sets the 3-hour price; longer packages scale by the same ratio.
    if p_pkg is not null and p_pkg <> 'p3' then
      if r.price > 0 then p := p * dr.price / r.price; end if;
    else
      p := dr.price;
    end if;
  end if;
  select * into hr from public.price_rules
   where room_id = p_room and type = 'hours' and p_start >= start_hour and p_start < end_hour
     and (cardinality(days) = 0 or extract(dow from p_date)::int = any (days))
     and (from_date is null or p_date >= from_date) and (to_date is null or p_date <= to_date)
   order by pct desc limit 1;
  if found then p := p * (100 - least(100, greatest(0, hr.pct))) / 100; end if;
  return round(p, 2);
end $$;

create or replace function private.quote(p_room uuid, p_date date, p_start numeric, p_pkg text, p_member boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.settings; r public.rooms; unit numeric; std numeric; disc numeric := 0; sub numeric; tax numeric := 0; total numeric; hrs numeric;
begin
  select * into s from public.settings where id = 1;
  select * into r from public.rooms where id = p_room;
  unit := private.block_price(p_room, p_date, p_start, p_pkg);
  std := case p_pkg when 'half' then r.price_half when 'day' then r.price_day else r.price end;
  select hours into hrs from public.packages where id = coalesce(p_pkg, 'p3');
  if p_member then disc := round(unit * s.member_discount, 2); end if;
  sub := unit - disc;
  if s.tax_mode = 'added' then
    tax := round(sub * s.tax_pct / 100, 2); total := sub + tax;
  elsif s.tax_mode = 'included' then
    tax := round(sub - sub / (1 + s.tax_pct / 100), 2); total := sub;
  else
    total := sub;
  end if;
  return jsonb_build_object('base', unit, 'unit', unit, 'special', unit <> std, 'blocks', 1, 'pkg', p_pkg, 'hours', hrs,
                            'disc', disc, 'member', coalesce(p_member, false), 'extras', '[]'::jsonb, 'sub', sub,
                            'tax', tax, 'taxMode', s.tax_mode, 'taxPct', s.tax_pct, 'total', round(total, 2));
end $$;

-- ── Availability ──
-- 'booked' | 'held' | 'blocked' | 'free'. Expired-but-unswept holds count as free.
create or replace function private.slot_state(p_room uuid, p_from timestamptz, p_to timestamptz, p_ignore uuid default null) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.bookings b where b.room_id = p_room and b.id is distinct from p_ignore
                   and b.status = 'confirmed' and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_from, p_to, '[)')) then 'booked'
    when exists (select 1 from public.bookings b where b.room_id = p_room and b.id is distinct from p_ignore
                   and b.status in ('hold', 'pending_payment') and (b.expires_at is null or b.expires_at > now())
                   and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_from, p_to, '[)')) then 'held'
    when exists (select 1 from public.blocks k where k.room_id = p_room
                   and tstzrange(k.starts_at, k.ends_at, '[)') && tstzrange(p_from, p_to, '[)')) then 'blocked'
    else 'free' end $$;

-- Public: slots for a range of days with their state and price for the caller (member prices when signed in as a member).
-- state: free | held | booked | blocked | past | members_only (same-day is a member benefit)
create or replace function public.get_day_slots(p_room uuid, p_from date default null, p_days int default 14, p_pkg text default 'p3')
returns table (day date, start_hour numeric, end_hour numeric, pkg text, state text, price numeric, total numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_room public.rooms; v_pkg public.packages; v_set public.settings; v_hours public.room_hours;
  v_uid uuid := auth.uid(); v_member boolean := false;
  v_now timestamp := now() at time zone 'Asia/Jerusalem'; v_today date; v_nowh numeric;
  v_d date; v_last date; v_s numeric; v_state text; v_q jsonb;
begin
  select * into v_room from public.rooms where id = p_room and visible;
  if not found then return; end if;
  select * into v_pkg from public.packages where id = coalesce(p_pkg, 'p3');
  if not found then return; end if;
  select * into v_set from public.settings where id = 1;
  if v_uid is not null then v_member := private.is_member(v_uid); end if;
  v_today := v_now::date;
  v_nowh := extract(hour from v_now) + extract(minute from v_now) / 60.0;
  v_d := coalesce(p_from, v_today);
  v_last := least(v_d + (greatest(1, least(coalesce(p_days, 14), 62)) - 1), v_today + v_set.window_days);
  while v_d <= v_last loop
    select * into v_hours from public.room_hours where room_id = p_room and dow = extract(dow from v_d)::int;
    if found then
      foreach v_s in array v_pkg.starts loop
        if v_s >= v_hours.open_hour and v_s + v_pkg.hours <= v_hours.close_hour then
          v_state := private.slot_state(p_room, private.at_local(v_d, v_s), private.at_local(v_d, v_s + v_pkg.hours));
          if v_state = 'free' then
            if v_d < v_today or (v_d = v_today and v_s <= v_nowh) then v_state := 'past';
            elsif v_d = v_today and not v_member then v_state := 'members_only';
            elsif v_d = v_today and v_s - v_nowh < v_set.sameday_lead_hours then v_state := 'past';
            end if;
          end if;
          v_q := private.quote(p_room, v_d, v_s, v_pkg.id, v_member);
          day := v_d; start_hour := v_s; end_hour := v_s + v_pkg.hours; pkg := v_pkg.id; state := v_state;
          price := (v_q ->> 'unit')::numeric; total := (v_q ->> 'total')::numeric;
          return next;
        end if;
      end loop;
    end if;
    v_d := v_d + 1;
  end loop;
end $$;

create or replace function public.quote_booking(p_room uuid, p_date date, p_start numeric, p_end numeric default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pkg public.packages; v_end numeric := coalesce(p_end, p_start + 3);
begin
  if not exists (select 1 from public.rooms where id = p_room and visible) then return jsonb_build_object('err', 'room'); end if;
  select * into v_pkg from public.packages where hours = v_end - p_start and p_start = any (starts) order by sort_order limit 1;
  if not found then return jsonb_build_object('err', 'slot'); end if;
  return private.quote(p_room, p_date, p_start, v_pkg.id, private.is_member(auth.uid()));
end $$;

-- ── Customer booking flow ──
create or replace function public.create_hold(p_room uuid, p_date date, p_start numeric, p_end numeric default null,
                                              p_source text default 'web', p_utm text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_user public.profiles; v_room public.rooms; v_set public.settings; v_pkg public.packages; v_hours public.room_hours;
  v_end numeric; v_from timestamptz; v_to timestamptz; v_member boolean; v_mine public.bookings; v_b public.bookings; v_q jsonb;
  v_now timestamp := now() at time zone 'Asia/Jerusalem'; v_today date; v_nowh numeric;
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  select * into v_user from public.profiles where id = v_uid;
  if not found then return jsonb_build_object('err', 'auth'); end if;
  perform private.sweep_expired();
  select * into v_room from public.rooms where id = p_room;
  if not found or v_room.status <> 'active' or not v_room.visible then return jsonb_build_object('err', 'room'); end if;
  if not (v_room.price > 0) then return jsonb_build_object('err', 'price'); end if;
  select * into v_set from public.settings where id = 1;
  v_today := v_now::date;
  v_nowh := extract(hour from v_now) + extract(minute from v_now) / 60.0;
  if p_date is null or p_start is null or p_date < v_today then return jsonb_build_object('err', 'slot'); end if;
  if p_date > v_today + v_set.window_days then return jsonb_build_object('err', 'window'); end if;
  v_member := private.is_member(v_uid);
  -- Same-day bookings are a member benefit; everyone else books from tomorrow.
  if p_date = v_today and not v_member then return jsonb_build_object('err', 'sameday'); end if;
  v_end := coalesce(p_end, p_start + 3);
  select * into v_pkg from public.packages where hours = v_end - p_start and p_start = any (starts) order by sort_order limit 1;
  if not found then return jsonb_build_object('err', 'slot'); end if;
  select * into v_hours from public.room_hours where room_id = p_room and dow = extract(dow from p_date)::int;
  if not found or p_start < v_hours.open_hour or v_end > v_hours.close_hour then return jsonb_build_object('err', 'slot'); end if;
  if p_date = v_today then
    if p_start <= v_nowh then return jsonb_build_object('err', 'slot'); end if;
    if p_start - v_nowh < v_set.sameday_lead_hours then return jsonb_build_object('err', 'lead'); end if;
  end if;
  v_from := private.at_local(p_date, p_start);
  v_to := private.at_local(p_date, v_end);
  v_q := private.quote(p_room, p_date, p_start, v_pkg.id, v_member);

  select * into v_mine from public.bookings where user_id = v_uid and status = 'hold' limit 1;
  if v_mine.id is not null and v_mine.room_id = p_room and v_mine.starts_at = v_from and v_mine.ends_at = v_to then
    update public.bookings
       set expires_at = now() + make_interval(mins => v_set.hold_minutes), quote = v_q, total = (v_q ->> 'total')::numeric
     where id = v_mine.id returning * into v_b;
    return jsonb_build_object('booking', private.booking_json(v_b));
  end if;
  if private.slot_state(p_room, v_from, v_to, v_mine.id) <> 'free' then return jsonb_build_object('err', 'taken'); end if;

  begin
    if v_mine.id is not null then
      update public.bookings set status = 'released', expires_at = null where id = v_mine.id;
      perform private.booking_event(v_mine.id, 'released', 'customer', 'new selection');
    end if;
    insert into public.bookings (room_id, user_id, name, email, phone, company, starts_at, ends_at, package, status, pay,
                                 quote, total, source, utm, expires_at)
    values (p_room, v_uid, v_user.name, v_user.email, v_user.phone, v_user.company, v_from, v_to, v_pkg.id, 'hold', 'none',
            v_q, (v_q ->> 'total')::numeric, left(coalesce(nullif(trim(p_source), ''), 'web'), 40), left(coalesce(p_utm, ''), 160),
            now() + make_interval(mins => v_set.hold_minutes))
    returning * into v_b;
  exception when exclusion_violation then
    return jsonb_build_object('err', 'taken');
  end;
  perform private.booking_event(v_b.id, 'hold', v_user.email);
  perform private.audit('hold.create', v_b.id::text);
  return jsonb_build_object('booking', private.booking_json(v_b));
end $$;

-- Turns the hold into a booking request awaiting payment (payment provider not connected yet: staff record payment).
create or replace function public.request_booking(p_booking uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_b public.bookings; v_set public.settings;
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  perform private.sweep_expired();
  select * into v_b from public.bookings where id = p_booking and user_id = v_uid for update;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  if v_b.status = 'pending_payment' then return jsonb_build_object('booking', private.booking_json(v_b)); end if;
  if v_b.status <> 'hold' then return jsonb_build_object('err', 'expired'); end if;
  select * into v_set from public.settings where id = 1;
  update public.bookings
     set status = 'pending_payment', pay = 'awaiting', expires_at = now() + make_interval(hours => v_set.request_hours)
   where id = v_b.id returning * into v_b;
  perform private.booking_event(v_b.id, 'pending_payment', v_b.email);
  perform private.audit('booking.request', v_b.id::text);
  return jsonb_build_object('booking', private.booking_json(v_b));
end $$;

create or replace function public.release_hold(p_booking uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_b public.bookings;
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  update public.bookings set status = 'released', expires_at = null
   where id = p_booking and user_id = v_uid and status = 'hold' returning * into v_b;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  perform private.booking_event(v_b.id, 'released', v_b.email);
  return jsonb_build_object('booking', private.booking_json(v_b));
end $$;

-- Owner or admin. Customers cannot cancel a confirmed booking inside the cancellation window.
create or replace function public.cancel_booking(p_booking uuid, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_b public.bookings; v_set public.settings; v_adm boolean;
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  select * into v_b from public.bookings where id = p_booking for update;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  v_adm := private.is_admin();
  if not v_adm and v_b.user_id is distinct from v_uid then return jsonb_build_object('err', 'auth'); end if;
  if v_b.status not in ('hold', 'pending_payment', 'confirmed') then return jsonb_build_object('err', 'status'); end if;
  select * into v_set from public.settings where id = 1;
  if not v_adm and v_b.status = 'confirmed' and v_b.starts_at - now() < make_interval(hours => v_set.cancel_hours) then
    return jsonb_build_object('err', 'late');
  end if;
  update public.bookings
     set status = 'cancelled', expires_at = null,
         pay = case when pay = 'paid' then 'refund_pending' when pay = 'awaiting' then 'none' else pay end
   where id = v_b.id returning * into v_b;
  perform private.booking_event(v_b.id, 'cancelled', private.actor_email(), left(coalesce(p_reason, ''), 300));
  perform private.audit('booking.cancel', v_b.id::text);
  return jsonb_build_object('booking', private.booking_json(v_b));
end $$;

-- ── Function privileges: nothing is callable by default ──
revoke all on function public.get_day_slots(uuid, date, int, text), public.quote_booking(uuid, date, numeric, numeric),
  public.create_hold(uuid, date, numeric, numeric, text, text), public.request_booking(uuid), public.release_hold(uuid),
  public.cancel_booking(uuid, text) from public, anon, authenticated;
grant execute on function public.get_day_slots(uuid, date, int, text), public.quote_booking(uuid, date, numeric, numeric) to anon, authenticated;
grant execute on function public.create_hold(uuid, date, numeric, numeric, text, text), public.request_booking(uuid),
  public.release_hold(uuid), public.cancel_booking(uuid, text) to authenticated;
