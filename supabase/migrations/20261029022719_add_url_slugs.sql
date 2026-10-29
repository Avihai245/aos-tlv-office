-- Readable English addresses for the public pages: /room/meeting-room, /office/office-1 instead of a UUID.
create or replace function private.slugify(p_text text) returns text
language sql immutable set search_path = '' as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'))
$$;

alter table public.rooms add column slug text;
alter table public.offices add column slug text;

-- The first room is the meeting room; the rest and the offices take their English name (code as a fallback).
update public.rooms r
   set slug = case when r.id = (select id from public.rooms order by sort_order, id limit 1) then 'meeting-room'
                   else coalesce(nullif(private.slugify(r.name_en), ''), nullif(private.slugify(r.code), ''), 'room-' || substr(r.id::text, 1, 6)) end;
update public.offices o
   set slug = coalesce(nullif(private.slugify(o.name_en), ''), nullif(private.slugify(o.code), ''), 'office-' || substr(o.id::text, 1, 6));

alter table public.rooms alter column slug set not null;
alter table public.offices alter column slug set not null;
alter table public.rooms add constraint rooms_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.offices add constraint offices_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create unique index rooms_slug_key on public.rooms (slug);
create unique index offices_slug_key on public.offices (slug);

-- New rows (created from the back office) get a unique slug from their English name; an explicit slug is only normalised.
create or replace function private.set_slug() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_base text; v_slug text; v_n int := 1; v_taken boolean;
begin
  v_base := coalesce(nullif(private.slugify(new.slug), ''), nullif(private.slugify(new.name_en), ''), nullif(private.slugify(new.code), ''), tg_table_name);
  v_slug := v_base;
  loop
    execute format('select exists (select 1 from public.%I where slug = $1 and id <> $2)', tg_table_name) into v_taken using v_slug, new.id;
    exit when not v_taken;
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  new.slug := v_slug;
  return new;
end $$;
revoke all on function private.set_slug() from public, anon, authenticated;

create trigger rooms_set_slug before insert or update of slug on public.rooms for each row execute function private.set_slug();
create trigger offices_set_slug before insert or update of slug on public.offices for each row execute function private.set_slug();
