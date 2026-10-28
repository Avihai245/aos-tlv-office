-- AOS · starting data, taken from the prototype's latest defaults (aos-data.js after all in-file migrations).
-- Everything here is editable from the admin. No demo bookings, inquiries or accounts are created.
-- NOTE: room price 350 / half-day 500 / full-day 1200 is what the prototype produces on a fresh store;
-- HANDOFF.md says 650 (members 520). Confirm and update rooms.price if 650 is right.

insert into public.settings (id, content) values (1, jsonb_build_object(
  'addressHe', 'דרך מנחם בגין 150, תל אביב', 'addressEn', '150 Menachem Begin Road, Tel Aviv',
  'hoursAHe', 'א׳–ה׳ 08:00–20:00', 'hoursAEn', 'Sun–Thu 08:00–20:00',
  'hoursBHe', 'שישי 08:00–15:00', 'hoursBEn', 'Fri 08:00–15:00',
  'phone', '', 'email', '', 'whatsapp', '',
  'heroAHe', 'משרדים וחדר ישיבות', 'heroAEn', 'Offices and a boardroom',
  'heroBHe', 'בלב תל אביב.', 'heroBEn', 'in central Tel Aviv.',
  'heroSubHe', 'משרדים פרטיים להשכרה וחדר ישיבות מאובזר להזמנה באתר.',
  'heroSubEn', 'Private offices to rent and a fully equipped boardroom you book online.'));

insert into public.packages (id, hours, name_he, name_en, starts, sort_order) values
  ('p3', 3, '3 שעות', '3 hours', '{9,12,15}', 1),
  ('half', 5, 'חצי יום', 'Half day', '{9,13}', 2),
  ('day', 9, 'יום מלא', 'Full day', '{9}', 3);

with r as (
  insert into public.rooms (code, name_he, name_en, desc_he, desc_en, capacity, amenities_he, amenities_en, equip_he, equip_en,
                            price, price_half, price_day, status, visible, sort_order, images)
  values ('AOS-01', 'חדר הישיבות', 'The Boardroom',
    'חדר ישיבות מעוצב לעד 10 משתתפים, עם טלוויזיה 75 אינץ׳ למצגות ולשיחות וידאו, אינטרנט מהיר ומיזוג. קפה, עוגיות ומקרר משקאות מחכים לכם בחדר.',
    'A designed meeting room for up to 10 people, with a 75-inch TV for presentations and video calls, fast internet and air conditioning. Coffee, cookies and a drinks fridge are waiting in the room.',
    10,
    array['מקרר משקאות', 'קפה', 'עוגיות'], array['Drinks fridge', 'Coffee', 'Cookies'],
    array['טלוויזיה 75 אינץ׳', 'אינטרנט מהיר', 'מיזוג אוויר'], array['75-inch TV', 'Fast internet', 'Air conditioning'],
    350, 500, 1200, 'active', true, 1,
    jsonb_build_array(
      jsonb_build_object('src', 'uploads/AOS7.PNG', 'he', 'פגישה בחדר הישיבות: שולחן ישיבות, כיסאות מנהלים ומסך ועידה', 'en', 'A meeting in the room: conference table, executive chairs and video screen'),
      jsonb_build_object('src', 'uploads/AOS8.PNG', 'he', 'מבט אל מסך הוועידה מקצה השולחן', 'en', 'View of the video screen from the end of the table'),
      jsonb_build_object('src', 'uploads/aos3.JPG', 'he', 'פינת ישיבה עם כורסאות', 'en', 'Seating corner with armchairs'),
      jsonb_build_object('src', 'uploads/AOS10.jpg', 'he', 'פינת שתייה: מתקן מים ומקרר משקאות', 'en', 'Refreshment corner: water dispenser and drinks fridge')))
  returning id)
insert into public.room_hours (room_id, dow, open_hour, close_hour)
select r.id, d.dow, 9, case when d.dow = 5 then 15 else 18 end
from r cross join (values (0), (1), (2), (3), (4), (5)) as d(dow);   -- Sun–Thu 09–18, Fri 09–15, Sat closed

insert into public.offices (code, name_he, name_en, amenities_he, amenities_en, images, price, mgmt_fee, sort_order)
select 'AOS-O' || i, 'משרד ' || i, 'Office ' || i,
  (case when i = 5 then array['2 שולחנות ו־2 כסאות', 'ספה', 'עיצוב מלא'] else array['שולחן וכסא', 'עיצוב מלא'] end)
    || array['תאורה מובנית', 'מטבחון משותף', 'מיזוג מרכזי'],
  (case when i = 5 then array['2 desks and 2 chairs', 'Sofa', 'Fully designed'] else array['Desk and chair', 'Fully designed'] end)
    || array['Integrated lighting', 'Shared kitchenette', 'Central A/C'],
  jsonb_build_array(jsonb_build_object('src', 'uploads/931cc9ac-0ab6-4c0b-9206-25caa380dab7.JPG',
    'he', 'משרד פרטי במתחם: שולחן, כיסא ווילון לאורך החלון',
    'en', 'A private office at AOS: desk, chair and full-height curtain')),
  (array[4200, 3600, 3000, 3000, 5000, 4000, 2500])[i],
  (array[1000, 1000, 1000, 1000, 1300, 1000, 800])[i],
  i
from generate_series(1, 7) as i;
