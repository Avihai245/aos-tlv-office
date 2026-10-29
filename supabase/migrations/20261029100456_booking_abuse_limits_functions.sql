-- Stops one account (or a bot) from tying up the calendar without paying: a customer may have at most two open booking
-- requests waiting for payment, and may start at most twelve holds an hour. Contact forms also cap repeat sends from the
-- same phone or email, so one sender cannot use up the shared per-minute allowance.

create or replace function public.create_hold(p_room uuid, p_date date, p_start numeric, p_end numeric default null::numeric,
                                              p_source text default 'web'::text, p_utm text default ''::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  if (select count(*) from public.bookings where user_id = v_uid and status = 'pending_payment' and not tenant
        and (expires_at is null or expires_at > now())) >= 2 then
    return jsonb_build_object('err', 'limit');
  end if;
  if (select count(*) from public.bookings where user_id = v_uid and created_at > now() - interval '1 hour') >= 12 then
    return jsonb_build_object('err', 'rate');
  end if;
  select * into v_room from public.rooms where id = p_room;
  if not found or v_room.status <> 'active' or not v_room.visible then return jsonb_build_object('err', 'room'); end if;
  if not (v_room.price > 0) then return jsonb_build_object('err', 'price'); end if;
  select * into v_set from public.settings where id = 1;
  v_today := v_now::date;
  v_nowh := extract(hour from v_now) + extract(minute from v_now) / 60.0;
  if p_date is null or p_start is null or p_date < v_today then return jsonb_build_object('err', 'slot'); end if;
  if p_date > v_today + v_set.window_days then return jsonb_build_object('err', 'window'); end if;
  v_member := private.is_member(v_uid);
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
end $function$;

-- The same cap when a hold turns into a request, in case several holds were opened before the first request was sent.
create or replace function public.request_booking(p_booking uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_uid uuid := auth.uid(); v_b public.bookings; v_set public.settings;
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  perform private.sweep_expired();
  select * into v_b from public.bookings where id = p_booking and user_id = v_uid for update;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  if v_b.status = 'pending_payment' then return jsonb_build_object('booking', private.booking_json(v_b)); end if;
  if v_b.status <> 'hold' then return jsonb_build_object('err', 'expired'); end if;
  perform pg_advisory_xact_lock(hashtextextended('requests:' || v_uid::text, 0));
  if (select count(*) from public.bookings where user_id = v_uid and status = 'pending_payment' and not tenant
        and (expires_at is null or expires_at > now())) >= 2 then
    return jsonb_build_object('err', 'limit');
  end if;
  select * into v_set from public.settings where id = 1;
  update public.bookings
     set status = 'pending_payment', pay = 'awaiting', expires_at = now() + make_interval(hours => v_set.request_hours)
   where id = v_b.id returning * into v_b;
  perform private.booking_event(v_b.id, 'pending_payment', v_b.email);
  perform private.audit('booking.request', v_b.id::text);
  return jsonb_build_object('booking', private.booking_json(v_b));
end $function$;

create or replace function public.add_inquiry(p_kind text, p_office uuid, p_interest text, p_name text, p_phone text default ''::text,
                                              p_email text default ''::text, p_msg text default ''::text, p_source text default null::text,
                                              p_utm text default ''::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  -- One sender gets five enquiries an hour; more are answered as duplicates and not stored.
  select * into v_q from public.inquiries
   where created_at > now() - interval '1 hour' and ((v_email <> '' and email = v_email) or (v_phone <> '' and phone = v_phone))
   order by created_at desc offset 4 limit 1;
  if found then return jsonb_build_object('inquiry', jsonb_build_object('id', v_q.id), 'dup', true); end if;
  insert into public.inquiries (kind, office_id, interest, name, phone, email, msg, source, utm, user_id)
  values (case when p_kind in ('contact', 'office', 'membership', 'tour') then p_kind else 'contact' end, p_office, left(p_interest, 40),
          v_name, v_phone, v_email, left(coalesce(p_msg, ''), 2000), left(nullif(trim(coalesce(p_source, '')), ''), 40), left(coalesce(p_utm, ''), 160), auth.uid())
  returning * into v_q;
  perform private.audit('inquiry.create', v_q.id::text);
  return jsonb_build_object('inquiry', jsonb_build_object('id', v_q.id));
end $function$;
