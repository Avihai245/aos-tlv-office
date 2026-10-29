-- lp_view is callable by anyone. Without a cap, a script could create an unlimited number of rows with made-up campaign values.
-- After 200 distinct campaign values for a page and day, new ones are counted under "other".
create or replace function public.lp_view(p_lp text, p_utm text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare v_day date := private.local_date(now()); v_utm text := coalesce(nullif(left(trim(coalesce(p_utm, '')), 160), ''), '—');
begin
  if p_lp not in ('room', 'offices', 'home') then return; end if;
  if not exists (select 1 from public.lp_views where lp = p_lp and day = v_day and utm = v_utm)
     and (select count(*) from public.lp_views where lp = p_lp and day = v_day) >= 200 then
    v_utm := 'other';
  end if;
  insert into public.lp_views (lp, day, utm, total) values (p_lp, v_day, v_utm, 1)
  on conflict (lp, day, utm) do update set total = public.lp_views.total + 1;
end $$;
