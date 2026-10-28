-- AOS · core schema.
-- Ported from the prototype data layer (project/aos-data.js). Times are stored as timestamptz and
-- interpreted in Asia/Jerusalem; the prototype's (date, decimal hour) pairs are derived in the RPCs.
-- Every table has RLS enabled in this same migration; policies and grants come in the next one.

create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ── Profiles (1:1 with auth.users). Role is never taken from user-editable metadata. ──
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text not null default '' check (char_length(name) <= 80),
  phone text not null default '' check (char_length(phone) <= 30),
  company text not null default '' check (char_length(company) <= 80),
  role text not null default 'customer' check (role in ('customer', 'admin')),
  type text not null default 'meeting' check (type in ('meeting', 'tenant')),
  notes text not null default '' check (char_length(notes) <= 3000),
  auto_pay boolean not null default false,
  via text not null default 'email',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_uq on public.profiles (lower(email)) where email <> '';
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name, phone, via)
  values (new.id, lower(coalesce(new.email, '')),
          left(coalesce(new.raw_user_meta_data ->> 'name', ''), 80),
          left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 30),
          coalesce(new.raw_app_meta_data ->> 'provider', 'email'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function private.sync_profile_email();

-- ── Settings (singleton) and packages ──
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  content jsonb not null default '{}'::jsonb,
  tax_mode text not null default 'none' check (tax_mode in ('none', 'included', 'added')),
  tax_pct numeric(5, 2) not null default 18 check (tax_pct between 0 and 50),
  hold_minutes int not null default 10 check (hold_minutes between 5 and 30),
  request_hours int not null default 24 check (request_hours between 1 and 72),
  window_days int not null default 60 check (window_days between 7 and 365),
  cancel_hours int not null default 24 check (cancel_hours between 0 and 168),
  member_price numeric(10, 2) not null default 120 check (member_price >= 0),
  member_discount numeric(4, 3) not null default 0.20 check (member_discount between 0 and 1),
  sameday_lead_hours numeric(4, 2) not null default 1 check (sameday_lead_hours >= 0),
  updated_at timestamptz not null default now()
);
create trigger settings_touch before update on public.settings for each row execute function private.touch_updated_at();

create table public.packages (
  id text primary key,
  hours numeric(4, 2) not null check (hours > 0),
  name_he text not null,
  name_en text not null,
  starts numeric(4, 2)[] not null check (cardinality(starts) > 0),
  sort_order int not null default 0
);

-- ── Meeting rooms ──
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_he text not null,
  name_en text not null,
  desc_he text not null default '',
  desc_en text not null default '',
  capacity int not null default 1 check (capacity between 1 and 500),
  amenities_he text[] not null default '{}',
  amenities_en text[] not null default '{}',
  equip_he text[] not null default '{}',
  equip_en text[] not null default '{}',
  price numeric(10, 2) not null default 0 check (price >= 0),        -- 3-hour package
  price_half numeric(10, 2) not null default 500 check (price_half >= 0),
  price_day numeric(10, 2) not null default 1200 check (price_day >= 0),
  status text not null default 'inactive' check (status in ('active', 'inactive')),
  visible boolean not null default false,
  sort_order int not null default 1,
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger rooms_touch before update on public.rooms for each row execute function private.touch_updated_at();

-- Opening hours per weekday (0 = Sunday). No row = closed.
create table public.room_hours (
  room_id uuid not null references public.rooms (id) on delete cascade,
  dow smallint not null check (dow between 0 and 6),
  open_hour numeric(4, 2) not null check (open_hour >= 0),
  close_hour numeric(4, 2) not null check (close_hour <= 24),
  primary key (room_id, dow),
  check (close_hour > open_hour)
);

create table public.price_rules (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  type text not null check (type in ('date', 'hours')),
  from_date date,
  to_date date,
  price numeric(10, 2) check (price >= 0),
  start_hour numeric(4, 2),
  end_hour numeric(4, 2),
  pct numeric(5, 2),
  days smallint[] not null default '{}',
  label text not null default '' check (char_length(label) <= 80),
  created_at timestamptz not null default now(),
  constraint price_rules_date_ck check (type <> 'date' or (from_date is not null and to_date is not null and to_date >= from_date and price is not null)),
  constraint price_rules_hours_ck check (type <> 'hours' or (start_hour is not null and end_hour is not null and end_hour > start_hour and pct > 0 and pct <= 100))
);
create index price_rules_room_idx on public.price_rules (room_id);

-- ── Offices. Tenant contact details and internal notes live in office_admin (admin only). ──
create table public.offices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_he text not null,
  name_en text not null,
  desc_he text not null default '',
  desc_en text not null default '',
  amenities_he text[] not null default '{}',
  amenities_en text[] not null default '{}',
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  price numeric(10, 2) check (price >= 0),                 -- monthly rent, ex VAT
  mgmt_fee numeric(10, 2) check (mgmt_fee >= 0),           -- monthly management fee, ex VAT
  status text not null default 'unset' check (status in ('available', 'occupied', 'reserved', 'unavailable', 'unset')),
  visible boolean not null default true,
  sort_order int not null default 1,
  free_hours numeric(5, 2) not null default 3 check (free_hours between 0 and 200),
  hour_rate numeric(10, 2) check (hour_rate >= 0),         -- null = room 3h price / 3
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger offices_touch before update on public.offices for each row execute function private.touch_updated_at();

create table public.office_admin (
  office_id uuid primary key references public.offices (id) on delete cascade,
  notes text not null default '' check (char_length(notes) <= 3000),
  tenant_name text not null default '',
  tenant_phone text not null default '',
  tenant_email text not null default '',
  tenant_since date
);

create table public.office_tenants (
  office_id uuid not null references public.offices (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  primary key (office_id, user_id),
  unique (user_id)
);

-- ── Bookings: one calendar for every channel. The exclusion constraint makes double booking impossible. ──
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('AOS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))),
  room_id uuid not null references public.rooms (id),
  user_id uuid references public.profiles (id) on delete set null,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  company text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  package text references public.packages (id),
  status text not null default 'hold' check (status in ('hold', 'pending_payment', 'confirmed', 'cancelled', 'expired', 'released')),
  pay text not null default 'none' check (pay in ('none', 'awaiting', 'paid', 'unpaid', 'refund_pending', 'refunded')),
  quote jsonb not null default '{}'::jsonb,
  total numeric(10, 2) not null default 0 check (total >= 0),
  source text not null default 'web',
  utm text not null default '',
  expires_at timestamptz,
  note text not null default '' check (char_length(note) <= 500),
  tenant boolean not null default false,
  office_id uuid references public.offices (id) on delete set null,
  free_hours numeric(5, 2) not null default 0,
  paid_hours numeric(5, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_period_ck check (ends_at > starts_at),
  constraint bookings_no_overlap exclude using gist (
    room_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('hold', 'pending_payment', 'confirmed'))
);
create unique index bookings_one_hold_per_user on public.bookings (user_id) where status = 'hold';
create index bookings_user_idx on public.bookings (user_id);
create index bookings_room_start_idx on public.bookings (room_id, starts_at);
create index bookings_office_idx on public.bookings (office_id) where office_id is not null;
create index bookings_expiry_idx on public.bookings (expires_at) where status in ('hold', 'pending_payment');
create trigger bookings_touch before update on public.bookings for each row execute function private.touch_updated_at();

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  at timestamptz not null default now(),
  status text not null,
  by text not null default 'system',
  note text not null default ''
);
create index booking_events_booking_idx on public.booking_events (booking_id);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index blocks_room_start_idx on public.blocks (room_id, starts_at);

-- A block and an active booking may never overlap. Both directions take the same per-room lock.
create or replace function private.bookings_vs_blocks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('hold', 'pending_payment', 'confirmed') then
    perform pg_advisory_xact_lock(hashtextextended(new.room_id::text, 0));
    if exists (select 1 from public.blocks k where k.room_id = new.room_id
               and tstzrange(k.starts_at, k.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')) then
      raise exception 'slot is blocked' using errcode = '23P01';
    end if;
  end if;
  return new;
end $$;
create trigger bookings_vs_blocks before insert or update of status, room_id, starts_at, ends_at on public.bookings
  for each row execute function private.bookings_vs_blocks();

create or replace function private.blocks_vs_bookings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.room_id::text, 0));
  if exists (select 1 from public.bookings b where b.room_id = new.room_id
             and b.status in ('hold', 'pending_payment', 'confirmed')
             and (b.status = 'confirmed' or b.expires_at is null or b.expires_at > now())
             and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')) then
    raise exception 'slot is booked' using errcode = '23P01';
  end if;
  return new;
end $$;
create trigger blocks_vs_bookings before insert or update of room_id, starts_at, ends_at on public.blocks
  for each row execute function private.blocks_vs_bookings();

-- ── Money ──
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  amount numeric(10, 2) not null,                          -- negative for refunds
  ref text not null unique,                                -- provider reference: makes recording idempotent
  method text not null,
  status text not null check (status in ('verified', 'refund')),
  by_email text not null default '',
  at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id);
create index payments_booking_idx on public.payments (booking_id);

-- Provider token + display data only. Raw card numbers never reach this database.
create table public.payment_methods (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token text not null,
  brand text not null default '',
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  exp text not null default '',
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending_payment', 'active', 'cancelled')),
  price numeric(10, 2) not null,
  vat_pct numeric(5, 2) not null,
  total numeric(10, 2) not null,
  requested_at timestamptz not null default now(),
  since timestamptz,
  until timestamptz,
  cancel_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger memberships_touch before update on public.memberships for each row execute function private.touch_updated_at();

-- ── Tenant service tickets (scoped to the office; internal notes in a separate admin-only table) ──
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'fault' check (kind in ('fault', 'request')),
  subject text not null check (char_length(subject) between 1 and 120),
  status text not null default 'open' check (status in ('open', 'progress', 'done')),
  images text[] not null default '{}' check (cardinality(images) <= 3),   -- storage paths
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_office_idx on public.tickets (office_id);
create trigger tickets_touch before update on public.tickets for each row execute function private.touch_updated_at();

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  by text not null check (by in ('tenant', 'staff', 'system')),
  name text not null default '',
  text text not null default '' check (char_length(text) <= 3000),
  status text,                                              -- set on 'system' rows (status changes)
  at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, at);

create table public.ticket_internal (
  ticket_id uuid primary key references public.tickets (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 3000)
);

-- ── Inquiries, landing-page stats, audit ──
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'contact' check (kind in ('contact', 'office', 'membership', 'tour')),
  office_id uuid references public.offices (id) on delete set null,
  interest text,
  name text not null check (char_length(name) between 1 and 80),
  phone text not null default '',
  email text not null default '',
  msg text not null default '' check (char_length(msg) <= 2000),
  status text not null default 'new' check (status in ('new', 'contacted', 'progress', 'closed')),
  notes text not null default '' check (char_length(notes) <= 3000),
  source text,
  utm text not null default '',
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inquiries_status_idx on public.inquiries (status, created_at desc);
create trigger inquiries_touch before update on public.inquiries for each row execute function private.touch_updated_at();

create table public.lp_views (
  lp text not null,
  day date not null,
  utm text not null default '',
  total int not null default 0,
  primary key (lp, day, utm)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text not null default '',
  action text not null,
  ref text not null default ''
);
create index audit_log_at_idx on public.audit_log (at desc);

create or replace function private.audit(p_action text, p_ref text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_email text;
begin
  if v_uid is not null then select email into v_email from public.profiles where id = v_uid; end if;
  insert into public.audit_log (actor_id, actor_email, action, ref) values (v_uid, coalesce(v_email, ''), p_action, coalesce(p_ref, ''));
end $$;

-- Generic audit trigger for tables an admin edits directly. Skipped when there is no signed-in user (seeding, service role).
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  if auth.uid() is not null then
    perform private.audit(tg_table_name || '.' || lower(tg_op), coalesce(r ->> 'id', r ->> 'office_id', ''));
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger rooms_audit after insert or update or delete on public.rooms for each row execute function private.audit_row();
create trigger room_hours_audit after insert or update or delete on public.room_hours for each row execute function private.audit_row();
create trigger price_rules_audit after insert or update or delete on public.price_rules for each row execute function private.audit_row();
create trigger packages_audit after insert or update or delete on public.packages for each row execute function private.audit_row();
create trigger offices_audit after insert or update or delete on public.offices for each row execute function private.audit_row();
create trigger office_admin_audit after insert or update or delete on public.office_admin for each row execute function private.audit_row();
create trigger settings_audit after update on public.settings for each row execute function private.audit_row();
create trigger blocks_audit after insert or update or delete on public.blocks for each row execute function private.audit_row();
create trigger inquiries_audit after update on public.inquiries for each row execute function private.audit_row();

-- ── Row level security: on for every table. New tables inherit open grants, so close them here too. ──
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.packages enable row level security;
alter table public.rooms enable row level security;
alter table public.room_hours enable row level security;
alter table public.price_rules enable row level security;
alter table public.offices enable row level security;
alter table public.office_admin enable row level security;
alter table public.office_tenants enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.blocks enable row level security;
alter table public.payments enable row level security;
alter table public.payment_methods enable row level security;
alter table public.memberships enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_internal enable row level security;
alter table public.inquiries enable row level security;
alter table public.lp_views enable row level security;
alter table public.audit_log enable row level security;

revoke all on all tables in schema public from anon, authenticated;
