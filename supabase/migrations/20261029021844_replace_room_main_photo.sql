-- The room's main photo is now the current picture of a meeting with a video call on the screen.
-- Only the entry whose src is the old file changes; the order, captions and other photos stay as they are.
update public.rooms
set images = (
  select jsonb_agg(
    case when e.elem ->> 'src' = 'uploads/AOS7.PNG'
         then jsonb_set(e.elem, '{src}', '"uploads/aos-meeting-zoom.webp"')
         else e.elem end
    order by e.ord)
  from jsonb_array_elements(public.rooms.images) with ordinality as e(elem, ord)
)
where images::text like '%uploads/AOS7.PNG%';
