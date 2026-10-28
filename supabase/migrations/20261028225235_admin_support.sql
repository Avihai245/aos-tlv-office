-- Admin UI support: role changes through a checked function, a public image bucket writable by admins only,
-- and read-only access to customers_v (it had inherited DML grants).

revoke all on public.customers_v from anon, authenticated;
grant select on public.customers_v to authenticated;

create or replace function public.admin_set_role(p_user uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_p public.profiles;
begin
  if not private.is_admin() then return jsonb_build_object('err', 'auth'); end if;
  if p_role not in ('admin', 'customer') then return jsonb_build_object('err', 'role'); end if;
  if p_user = auth.uid() then return jsonb_build_object('err', 'self'); end if;
  update public.profiles set role = p_role where id = p_user returning * into v_p;
  if not found then return jsonb_build_object('err', 'nf'); end if;
  if p_role = 'admin' then delete from public.office_tenants where user_id = p_user; end if;
  perform private.audit('role.' || p_role, p_user::text);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy site_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-images' and private.is_admin());
create policy site_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'site-images' and private.is_admin()) with check (bucket_id = 'site-images' and private.is_admin());
create policy site_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-images' and private.is_admin());
