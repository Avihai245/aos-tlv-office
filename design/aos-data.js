// AOS data layer. Every read/write of business data goes through this module.
// It persists to the browser (localStorage) and mirrors the API contract a production
// backend must implement (see HANDOFF.md). Swap the bodies for fetch() calls to go live.
let KEY = 'aos_db_v1', SES = 'aos_session_v1', ASES = 'aos_admin_session_v1';
const DUR = 3;
// Test harness only: isolate all storage under a separate prefix.
export function _useStore(prefix) { GUARD = false; KEY = prefix + '_db'; SES = prefix + '_session'; ASES = prefix + '_admin'; }
export function _wipe() { if (KEY === 'aos_db_v1') return; localStorage.removeItem(KEY); localStorage.removeItem(SES); sessionStorage.removeItem(ASES); }
export function _raw(fn) { const db = load(); fn(db); persist(db); }
export const BLOCK_HOURS = DUR;
const pad = n => String(n).padStart(2, '0');
export const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parseD = k => { const a = k.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2], 12); };
export const hm = h => pad(Math.floor(h)) + ':' + pad(Math.round((h % 1) * 60));
export const ACTIVE = ['hold', 'pending_payment', 'confirmed'];
export const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
export const phoneOk = p => String(p || '').replace(/\D/g, '').length >= 9;
export const LIBRARY = [
  { src: 'uploads/assets-1792344398884-f06p.png', he: 'דלת הכניסה למתחם AOS עם הלוגו', en: 'AOS entrance door with logo' },
  { src: 'uploads/corridor-2026.jpg', he: 'מסדרון המשרדים עם מחיצות זכוכית', en: 'Office corridor with glass partitions' },
  { src: 'uploads/assets-1792344398893-10qe.jpg', he: 'המטבחון המשותף', en: 'The shared kitchenette' },
  { src: 'uploads/assets-1792344398847-ho14.jpg', he: 'המטבחון המשותף, מבט נוסף', en: 'The shared kitchenette, another view' }
];
const rid = p => p + '-' + (Date.now().toString(36).slice(-3) + Math.random().toString(36).slice(2, 6)).toUpperCase();
const cl = (s, n = 400) => String(s ?? '').trim().slice(0, n);
const now = () => Date.now();
const log = (b, status, by, note) => { (b.history = b.history || []).push({ at: now(), status, by: by || 'system', note: note || '' }); };
const audit = (db, actor, action, ref) => { db.audit.push({ at: now(), actor, action, ref }); if (db.audit.length > 400) db.audit.splice(0, db.audit.length - 400); };
export const autoStarts = (open, close) => { const a = []; for (let h = open; h + DUR <= close; h += DUR) a.push(h); return a; };

function defaults() {
  const sched = {};
  for (let d = 0; d < 5; d++) sched[d] = { open: 9, close: 18, starts: [9, 12, 15] };
  sched[5] = { open: 9, close: 15, starts: [9, 12] }; sched[6] = null;
  const offAm = { he: ['תאורה מובנית', 'מטבחון משותף', 'מיזוג מרכזי'], en: ['Integrated lighting', 'Shared kitchenette', 'Central A/C'] };
  return {
    v: 1,
    settings: {
      content: {
        addressHe: 'דרך מנחם בגין 150, תל אביב', addressEn: '150 Menachem Begin Road, Tel Aviv',
        hoursAHe: 'א׳–ה׳ 08:00–20:00', hoursAEn: 'Sun–Thu 08:00–20:00', hoursBHe: 'שישי 08:00–15:00', hoursBEn: 'Fri 08:00–15:00',
        phone: '', email: '', whatsapp: '',
        heroAHe: 'משרדים וחדר ישיבות', heroAEn: 'Offices and a boardroom', heroBHe: 'בלב תל אביב.', heroBEn: 'in central Tel Aviv.',
        heroSubHe: 'משרדים פרטיים להשכרה וחדר ישיבות מאובזר להזמנה באתר.',
        heroSubEn: 'Private offices to rent and a fully equipped boardroom you book online.'
      },
      tax: { mode: 'none', pct: 18 },
      holdMinutes: 10, requestHours: 24, windowDays: 60, cancelHours: 24,
      integrations: { googleClientId: '', payment: false, email: false },
      extras: []
    },
    rooms: [{
      id: 'R1', code: 'AOS-01', nameHe: 'חדר הישיבות', nameEn: 'The Boardroom',
      descHe: 'חדר הישיבות של AOS: שולחן ועידה, מסך 4K ומערכת וידאו. מיועד לישיבות הנהלה, מצגות ללקוחות וחתימה על עסקאות גדולות.',
      descEn: 'The AOS boardroom: conference table, 4K display and video system. Made for board sessions, client presentations and signing major deals.',
      capacity: 10,
      amenitiesHe: ['אינטרנט מהיר', 'מיזוג מרכזי', 'שתייה בסיסית'], amenitiesEn: ['High-speed internet', 'Central air conditioning', 'Basic drinks'],
      equipHe: ['ציוד ועידה מלא', 'מסך 4K', 'מערכת וידאו'], equipEn: ['Full conference equipment', '4K display', 'Video system'],
      price: 650, schedule: sched, status: 'active', visible: true, order: 1, images: []
    }],
    offices: [1, 2, 3, 4, 5, 6, 7].map(i => ({
      id: 'O' + i, code: 'AOS-O' + i, nameHe: 'משרד ' + i, nameEn: 'Office ' + i, descHe: '', descEn: '',
      amenitiesHe: offAm.he.slice(), amenitiesEn: offAm.en.slice(), images: [], price: null,
      status: 'unset', visible: true, order: i, notes: '',
      tenant: { name: '', phone: '', email: '', userId: null, since: '' },
      allocations: [] // reserved for future tenant meeting-room entitlements; not used at launch
    })),
    users: [], bookings: [], payments: [], blocks: [], inquiries: [], audit: []
  };
}
function legacy(db) {
  try {
    const old = JSON.parse(localStorage.getItem('aos_leads') || '[]');
    old.filter(l => l && l.id && l.id !== 'L1' && l.id !== 'L2').forEach(l => db.inquiries.push({
      id: rid('INQ'), kind: 'contact', officeId: null, interest: l.type === 1 ? 'room' : 'office',
      name: cl(l.name, 80), phone: cl(l.phone, 30), email: cl(l.email, 120), msg: cl(l.msg, 2000),
      status: l.done ? 'closed' : 'new', notes: '', created: l.created || now(), userId: null
    }));
  } catch (e) {}
}
function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
function persist(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { throw new Error('storage_full'); } }
function sweep(db) {
  const t = now(); let c = false;
  db.bookings.forEach(b => { if ((b.status === 'hold' || b.status === 'pending_payment') && b.expires && b.expires < t) { b.status = 'expired'; if (b.pay === 'awaiting') b.pay = 'none'; log(b, 'expired', 'system'); c = true; } });
  return c;
}
export function load() {
  let db = read();
  if (!db || db.v !== 1) { db = defaults(); legacy(db); persist(db); }
  let mig = false;
  if (db.settings.extras && db.settings.extras.length) { db.settings.extras = []; mig = true; }
  const ct = db.settings.content;
  if (ct.heroSubHe === 'משרדים פרטיים להשכרה וחדר ישיבות מאובזר להזמנה באתר, עם כיבוד וקבלת פנים לאורחים.') { ct.heroSubHe = 'משרדים פרטיים להשכרה וחדר ישיבות מאובזר להזמנה באתר.'; ct.heroSubEn = 'Private offices to rent and a fully equipped boardroom you book online.'; mig = true; }
  if (!db.offData1) {
    const RENT = [4200, 3600, 3000, 3000, 5000, 4000, 2500], FEE = [1000, 1000, 1000, 1000, 1300, 1000, 800];
    db.offices.forEach(o => { const i = (parseInt(String(o.code).replace(/\D/g, '')) || 0) - 1; if (i < 0 || i > 6) return;
      o.price = RENT[i]; o.fee = FEE[i];
      const fh = i === 4 ? ['2 שולחנות ו־2 כסאות', 'ספה', 'עיצוב מלא'] : ['שולחן וכסא', 'עיצוב מלא'], fe = i === 4 ? ['2 desks and 2 chairs', 'Sofa', 'Fully designed'] : ['Desk and chair', 'Fully designed'];
      o.amenitiesHe = fh.concat((o.amenitiesHe || []).filter(x => !fh.includes(x))); o.amenitiesEn = fe.concat((o.amenitiesEn || []).filter(x => !fe.includes(x))); });
    db.offData1 = 1; mig = true;
  }
  if (!db.offData2) { db.offices.forEach(o => { o.amenitiesHe = (o.amenitiesHe || []).filter(x => x !== 'מחיצות זכוכית'); o.amenitiesEn = (o.amenitiesEn || []).filter(x => x !== 'Glass partitions'); }); db.offData2 = 1; mig = true; }
  if (!db.offData3) { db.offices.forEach(o => { if (!o.images || !o.images.length) o.images = [{ src: 'uploads/931cc9ac-0ab6-4c0b-9206-25caa380dab7.JPG', he: 'משרד פרטי במתחם: שולחן, כיסא ווילון לאורך החלון', en: 'A private office at AOS: desk, chair and full-height curtain' }]; }); db.offData3 = 1; mig = true; }
  { const sw = x => { if (x && x.src === 'uploads/assets-1792344969234-p361.jpg') { x.src = 'uploads/corridor-2026.jpg'; mig = true; } }; db.rooms.forEach(r => (r.images || []).forEach(sw)); db.offices.forEach(o => (o.images || []).forEach(sw)); }
  if (!db.roomImg1) { const r = db.rooms.find(x => x.id === 'R1'); if (r && (!r.images || !r.images.length)) r.images = [
      { src: 'uploads/AOS7.PNG', he: 'פגישה בחדר הישיבות: שולחן ישיבות, כיסאות מנהלים ומסך ועידה', en: 'A meeting in the room: conference table, executive chairs and video screen' },
      { src: 'uploads/AOS8.PNG', he: 'מבט אל מסך הוועידה מקצה השולחן', en: 'View of the video screen from the end of the table' },
      { src: 'uploads/aos3.JPG', he: 'פינת ישיבה עם כורסאות', en: 'Seating corner with armchairs' },
      { src: 'uploads/AOS10.jpg', he: 'פינת שתייה: מתקן מים ומקרר משקאות', en: 'Refreshment corner: water dispenser and drinks fridge' }
    ]; db.roomImg1 = 1; mig = true; }
  if (!db.roomData2) { const r = db.rooms.find(x => x.id === 'R1'); if (r) { r.capacity = 10;
      r.equipHe = ['טלוויזיה 75 אינץ׳', 'אינטרנט מהיר', 'מיזוג אוויר']; r.equipEn = ['75-inch TV', 'Fast internet', 'Air conditioning'];
      r.amenitiesHe = ['מקרר משקאות', 'קפה', 'עוגיות']; r.amenitiesEn = ['Drinks fridge', 'Coffee', 'Cookies'];
      r.descHe = 'חדר ישיבות מעוצב לעד 10 משתתפים, עם טלוויזיה 75 אינץ׳ למצגות ולשיחות וידאו, אינטרנט מהיר ומיזוג. קפה, עוגיות ומקרר משקאות מחכים לכם בחדר.';
      r.descEn = 'A designed meeting room for up to 10 people, with a 75-inch TV for presentations and video calls, fast internet and air conditioning. Coffee, cookies and a drinks fridge are waiting in the room.'; }
    db.roomData2 = 1; mig = true; }
  if (!db.roomImg2) { const r = db.rooms.find(x => x.id === 'R1'); if (r) (r.images || []).forEach(g => { if (g.src === 'uploads/meeting-2.png') { g.src = 'uploads/AOS7.PNG'; g.he = 'פגישה בחדר הישיבות: שולחן ישיבות, כיסאות מנהלים ומסך ועידה'; g.en = 'A meeting in the room: conference table, executive chairs and video screen'; } }); db.roomImg2 = 1; mig = true; }
  if (!db.roomImg3) { const r = db.rooms.find(x => x.id === 'R1'); if (r) (r.images || []).forEach(g => { if (g.src === 'uploads/meeting1.PNG') g.src = 'uploads/AOS8.PNG'; }); db.roomImg3 = 1; mig = true; }
  if (!db.roomImg4) { const r = db.rooms.find(x => x.id === 'R1'); if (r) (r.images || []).forEach(g => { if (g.src === 'uploads/AOS4.JPG') g.src = 'uploads/AOS10.jpg'; }); db.roomImg4 = 1; mig = true; }
  if (!db.roomPrice650) { const r = db.rooms.find(x => x.id === 'R1'); if (r) r.price = 650; db.roomPrice650 = 1; mig = true; }
  // Seed the AOS office admin on the live store only (tests use their own prefix).
  // Runs once per store; removing this admin later is permanent.
  if (KEY === 'aos_db_v1' && !db.seedOffice1) {
    db.seedOffice1 = 1;
    mig = true;
  }
  if (db.pkgV2 === 1) { db.rooms.forEach(r => { const x = r.schedule && r.schedule[5]; if (x) x.close = 15; }); db.pkgV2 = 2; mig = true; }
  if (!db.pkgV2) { db.rooms.forEach(r => { r.price = 350; r.pkgPrices = { half: 500, day: 1200 }; const sc = {}; for (let d = 0; d < 7; d++) { const x = r.schedule && r.schedule[d]; sc[d] = x ? { open: 9, close: Math.min(18, +x.close || 18), starts: [9, 12, 15] } : null; } r.schedule = sc; }); db.pkgV2 = 2; mig = true; }
  if (sweep(db) || mig) persist(db);
  return db;
}
// Every write goes through tx(). Two guards against double booking:
// 1) optimistic concurrency: if another tab wrote between our read and our write, re-run on the fresh copy;
// 2) a final invariant check: a write that leaves two active bookings (or a booking and a block) overlapping is refused.
// Production: the same rule must be enforced by the server/database (unique slot constraint inside a transaction).
const rawNow = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
export function overlaps(db) {
  const act = db.bookings.filter(b => ACTIVE.includes(b.status)), out = [];
  for (let i = 0; i < act.length; i++) { const a = act[i];
    for (let j = i + 1; j < act.length; j++) { const b = act[j]; if (a.roomId === b.roomId && a.date === b.date && ov(a.start, a.end, b.start, b.end)) out.push([a.id, b.id]); }
    for (const k of db.blocks || []) if (k.roomId === a.roomId && k.date === a.date && ov(a.start, a.end, k.start, k.end) && (k.created || 0) < (a.created || 0)) out.push([a.id, k.id]); }
  return out;
}
function tx(fn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const db = load(), before = rawNow(), pre = overlaps(db).length;
    const r = fn(db) || {};
    if (r.err && !r.keep) return r;
    if (overlaps(db).length > pre) return { err: 'taken' };
    if (rawNow() !== before) continue;
    db.rev = (db.rev || 0) + 1; persist(db); return r;
  }
  return { err: 'busy' };
}
export function subscribe(cb) {
  const h = e => { if (!e.key || e.key === KEY) cb(); };
  window.addEventListener('storage', h);
  const iv = setInterval(cb, 15000);
  return () => { window.removeEventListener('storage', h); clearInterval(iv); };
}
const isAdm = (db, uid) => db.users.some(u => u.id === uid && u.role === 'admin');

// Availability
function ov(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }
export function slotState(db, roomId, date, start, end, ignoreId) {
  const b = db.bookings.find(x => x.id !== ignoreId && x.roomId === roomId && x.date === date && ACTIVE.includes(x.status) && ov(start, end, x.start, x.end));
  if (b) return { state: b.status === 'confirmed' ? 'booked' : 'held', booking: b };
  const bl = db.blocks.find(x => x.roomId === roomId && x.date === date && ov(start, end, x.start, x.end));
  if (bl) return { state: 'blocked', block: bl };
  return { state: 'free' };
}
// Meeting-room packages: fixed time windows. 3h price = room.price; half/day prices in room.pkgPrices.
export const PACKAGES = [
  { id: 'p3', h: 3, he: '3 שעות', en: '3 hours', starts: [9, 12, 15] },
  { id: 'half', h: 5, he: 'חצי יום', en: 'Half day', starts: [9, 13] },
  { id: 'day', h: 9, he: 'יום מלא', en: 'Full day', starts: [9] }
];
export const pkgById = id => PACKAGES.find(p => p.id === id) || PACKAGES[0];
export const pkgFor = (start, end) => PACKAGES.find(p => p.h === end - start && p.starts.includes(start)) || null;
export const pkgPrice = (room, id) => { const pp = room.pkgPrices || {}; return id === 'half' ? +(pp.half ?? 500) : id === 'day' ? +(pp.day ?? 1200) : (+room.price || 0); };
export const packages = room => PACKAGES.map(p => ({ ...p, price: pkgPrice(room, p.id) }));
export function daySlots(db, roomId, date, pkgId) {
  const room = db.rooms.find(r => r.id === roomId); if (!room) return [];
  const sc = room.schedule[parseD(date).getDay()]; if (!sc) return [];
  const pk = pkgById(pkgId);
  const n = new Date(), tk = dkey(n), nh = n.getHours() + n.getMinutes() / 60;
  return pk.starts.filter(s => s >= sc.open && s + pk.h <= sc.close).map(s => {
    let st = slotState(db, roomId, date, s, s + pk.h);
    if (st.state === 'free' && (date < tk || (date === tk && s <= nh))) st = { state: 'past' };
    return { start: s, end: s + pk.h, pkg: pk.id, ...st };
  });
}
export function quote(db, room, extraIds, blocks, member, date, start, pkgId) {
  const n = pkgId ? 1 : Math.max(1, parseInt(blocks) || 1);
  const ex = (db.settings.extras || []).filter(e => e.on && (extraIds || []).includes(e.id)).map(e => ({ id: e.id, he: e.he, en: e.en, price: +e.price || 0 }));
  const units = []; for (let i = 0; i < n; i++) units.push(pkgId ? (date != null && start != null ? blockPrice(room, date, start, pkgId) : pkgPrice(room, pkgId)) : date != null && start != null ? blockPrice(room, date, start + i * DUR) : (+room.price || 0));
  const base0 = Math.round(units.reduce((a, x) => a + x, 0) * 100) / 100, disc = member ? Math.round(base0 * MEMBER.discount * 100) / 100 : 0;
  const sub = base0 - disc + ex.reduce((a, e) => a + e.price, 0), t = db.settings.tax;
  let tax = 0, total = sub;
  if (t.mode === 'added') { tax = Math.round(sub * t.pct) / 100; total = sub + tax; }
  else if (t.mode === 'included') tax = Math.round((sub - sub / (1 + t.pct / 100)) * 100) / 100;
  return { base: base0, unit: units[0], units, special: units.some(x => x !== (pkgId ? pkgPrice(room, pkgId) : (+room.price || 0))), blocks: n, pkg: pkgId || null, hours: pkgId ? pkgById(pkgId).h : n * DUR, disc, member: !!member, extras: ex, sub, tax, taxMode: t.mode, taxPct: t.pct, total: Math.round(total * 100) / 100 };
}
// A booking may span several consecutive scheduled blocks on the same day.
export function rangeBlocks(db, roomId, date, start, end) {
  const sl = daySlots(db, roomId, date), out = [];
  for (let h = start; h < end; h += DUR) { const s = sl.find(x => x.start === h); if (!s) return null; out.push(s); }
  return out.length ? out : null;
}
const startTs = b => { const d = parseD(b.date); d.setHours(Math.floor(b.start), Math.round((b.start % 1) * 60), 0, 0); return d.getTime(); };
export const bookingStart = startTs;

// Customer booking flow
function _createHold(uid, { roomId, date, start, end, extras, source, utm }) {
  end = end == null ? start + DUR : end;
  return tx(db => {
    const u = db.users.find(x => x.id === uid); if (!u) return { err: 'auth' };
    const room = db.rooms.find(r => r.id === roomId);
    if (!room || room.status !== 'active' || !room.visible) return { err: 'room' };
    if (!(+room.price > 0)) return { err: 'price' };
    if (date > dkey(new Date(now() + db.settings.windowDays * 864e5))) return { err: 'window' };
    // Same-day bookings are a member benefit. Everyone else books from tomorrow.
    if (date <= dkey(new Date()) && !isMember(db, uid)) return { err: 'sameday' };
    const mine = db.bookings.find(b => b.userId === uid && b.status === 'hold');
    const pk = pkgFor(start, end); if (!pk) return { err: 'slot' };
    const q = quote(db, room, extras, 1, isMember(db, uid), date, start, pk.id);
    if (mine && mine.roomId === roomId && mine.date === date && mine.start === start && mine.end === end) {
      mine.expires = now() + db.settings.holdMinutes * 6e4; mine.quote = q; mine.total = q.total; return { booking: mine };
    }
    if (mine) { mine.status = 'released'; log(mine, 'released', 'customer', 'new selection'); }
    const sl = daySlots(db, roomId, date, pk.id).find(x => x.start === start);
    if (!sl) return { err: 'slot' };
    if (sl.state !== 'free') return { err: sl.state === 'past' ? 'slot' : 'taken' };
    const b = {
      id: rid('AOS'), roomId, date, start, end, userId: uid, name: u.name, email: u.email, phone: u.phone || '', company: u.company || '',
      quote: q, total: q.total, status: 'hold', pay: 'none', source: cl(source || '', 40) || 'web', utm: cl(utm || '', 160), expires: now() + db.settings.holdMinutes * 6e4, created: now(), history: []
    };
    log(b, 'hold', u.email); db.bookings.push(b); audit(db, u.email, 'hold.create', b.id);
    return { booking: b };
  });
}
function _requestBooking(uid, id) {
  return tx(db => {
    const b = db.bookings.find(x => x.id === id && x.userId === uid);
    if (!b) return { err: 'nf' };
    if (b.status === 'pending_payment') return { booking: b };
    if (b.status !== 'hold') return { err: 'expired' };
    b.status = 'pending_payment'; b.pay = 'awaiting'; b.expires = now() + db.settings.requestHours * 36e5;
    log(b, 'pending_payment', b.email); audit(db, b.email, 'booking.request', b.id);
    return { booking: b };
  });
}
function _releaseHold(uid, id) {
  return tx(db => { const b = db.bookings.find(x => x.id === id && x.userId === uid && x.status === 'hold'); if (!b) return { err: 'nf' }; b.status = 'released'; log(b, 'released', b.email); return { booking: b }; });
}
function _cancelBooking(actorId, id, reason) {
  return tx(db => {
    const b = db.bookings.find(x => x.id === id); if (!b) return { err: 'nf' };
    const adm = isAdm(db, actorId);
    if (!adm && b.userId !== actorId) return { err: 'auth' };
    if (!ACTIVE.includes(b.status)) return { err: 'status' };
    if (!adm && b.status === 'confirmed' && startTs(b) - now() < db.settings.cancelHours * 36e5) return { err: 'late' };
    b.status = 'cancelled'; b.expires = null;
    if (b.pay === 'paid') b.pay = 'refund_pending'; else if (b.pay === 'awaiting') b.pay = 'none';
    const who = (db.users.find(u => u.id === actorId) || {}).email || 'unknown';
    log(b, 'cancelled', who, cl(reason, 300)); audit(db, who, 'booking.cancel', b.id);
    return { booking: b };
  });
}
// Payment confirmation. Production: called ONLY by the server after the provider's webhook is verified.
// Idempotent on `ref`; rejects amount mismatches and slots that were lost.
function _recordPayment(actorId, { bookingId, amount, ref, method }) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    if (ref) { const ex = db.payments.find(p => p.ref === ref); if (ex) return { payment: ex, dup: true }; }
    const b = db.bookings.find(x => x.id === bookingId); if (!b) return { err: 'nf' };
    if (b.pay === 'paid') return { err: 'already' };
    if (Math.abs(+amount - b.total) > 0.009) return { err: 'amount' };
    if (!['hold', 'pending_payment', 'expired', 'confirmed'].includes(b.status)) return { err: 'status' };
    if (b.status === 'expired' && slotState(db, b.roomId, b.date, b.start, b.end, b.id).state !== 'free') return { err: 'conflict' };
    const who = db.users.find(u => u.id === actorId).email;
    const p = { id: rid('PAY'), bookingId: b.id, userId: b.userId, amount: b.total, ref: cl(ref, 80) || rid('OFF'), method, status: 'verified', by: who, at: now() };
    db.payments.push(p); b.pay = 'paid'; b.status = 'confirmed'; b.expires = null;
    log(b, 'confirmed', who, 'payment ' + method + ' ' + p.ref); audit(db, who, 'payment.record', b.id);
    return { payment: p, booking: b };
  });
}
function _confirmUnpaid(actorId, id) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const b = db.bookings.find(x => x.id === id); if (!b || !['hold', 'pending_payment'].includes(b.status)) return { err: 'status' };
    const who = db.users.find(u => u.id === actorId).email;
    b.status = 'confirmed'; b.pay = 'unpaid'; b.expires = null; log(b, 'confirmed', who, 'manual, unpaid'); audit(db, who, 'booking.confirm', b.id);
    return { booking: b };
  });
}
function _markRefunded(actorId, id, ref) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const b = db.bookings.find(x => x.id === id); if (!b || b.pay !== 'refund_pending') return { err: 'status' };
    const who = db.users.find(u => u.id === actorId).email;
    db.payments.push({ id: rid('REF'), bookingId: b.id, userId: b.userId, amount: -b.total, ref: cl(ref, 80) || rid('RF'), method: 'refund', status: 'refund', by: who, at: now() });
    b.pay = 'refunded'; log(b, 'refunded', who, cl(ref, 80)); audit(db, who, 'payment.refund', b.id);
    return { booking: b };
  });
}
function _adminBooking(actorId, { roomId, date, start, end, name, email, phone, paid, note }) {
  const pk = pkgFor(start, end == null ? start + DUR : end) || PACKAGES[0];
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const who = db.users.find(u => u.id === actorId).email;
    email = cl(email, 120).toLowerCase(); name = cl(name, 80);
    if (!name) return { err: 'name' };
    if (email && !emailOk(email)) return { err: 'email' };
    const room = db.rooms.find(r => r.id === roomId); if (!room) return { err: 'room' };
    const slot = daySlots(db, roomId, date, pk.id).find(s => s.start === start);
    if (!slot) return { err: 'slot' };
    if (slot.state !== 'free') return { err: 'taken' };
    let u = email ? db.users.find(x => x.email === email) : null;
    if (!u) { u = { id: rid('U'), email, name, phone: cl(phone, 30), company: '', role: 'customer', type: 'meeting', notes: '', created: now(), via: 'admin' }; db.users.push(u); }
    const q = quote(db, room, [], 1, false, date, start, pk.id);
    const b = { id: rid('AOS'), roomId, date, start, end: start + pk.h, userId: u.id, name, email, phone: cl(phone, 30) || u.phone || '', company: u.company || '', quote: q, total: q.total, status: 'confirmed', pay: 'unpaid', source: 'admin', expires: null, created: now(), note: cl(note, 500), history: [] };
    log(b, 'confirmed', who, 'manual booking'); db.bookings.push(b); audit(db, who, 'booking.manual', b.id);
    if (paid) {
      const p = { id: rid('PAY'), bookingId: b.id, userId: u.id, amount: b.total, ref: rid('OFF'), method: 'offline', status: 'verified', by: who, at: now() };
      db.payments.push(p); b.pay = 'paid';
    }
    return { booking: b };
  });
}
function _addBlock(actorId, { roomId, date, start, end, reason }) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    if (!(end > start)) return { err: 'range' };
    const ids = roomId === 'all' ? db.rooms.map(r => r.id) : [roomId];
    for (const r of ids) { const s = slotState(db, r, date, start, end); if (s.state === 'booked' || s.state === 'held') return { err: 'conflict' }; }
    const who = db.users.find(u => u.id === actorId).email;
    ids.forEach(r => db.blocks.push({ id: rid('BLK'), roomId: r, date, start, end, reason: cl(reason, 200), by: who, created: now() }));
    audit(db, who, 'block.add', date); return { ok: true };
  });
}
function _removeBlock(actorId, id) {
  return tx(db => { if (!isAdm(db, actorId)) return { err: 'auth' }; const i = db.blocks.findIndex(b => b.id === id); if (i < 0) return { err: 'nf' }; const who = db.users.find(u => u.id === actorId).email; audit(db, who, 'block.remove', db.blocks[i].date); db.blocks.splice(i, 1); return { ok: true }; });
}

// Auth
async function hash(pw, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const setSes = uid => localStorage.setItem(SES, JSON.stringify({ uid, exp: now() + 30 * 864e5 }));
export function sessionUser(db) {
  try { const s = JSON.parse(localStorage.getItem(SES) || 'null'); if (!s || s.exp < now()) return null; return db.users.find(u => u.id === s.uid) || null; } catch (e) { return null; }
}
export function signOut() { localStorage.removeItem(SES); }
export async function signUp({ name, phone, email, password }) {
  email = cl(email, 120).toLowerCase(); name = cl(name, 80); phone = cl(phone, 30);
  if (!name) return { err: 'name' };
  if (!emailOk(email)) return { err: 'email' };
  if (phone && !phoneOk(phone)) return { err: 'phone' };
  if (String(password || '').length < 8) return { err: 'weak' };
  if (load().users.some(u => u.email === email)) return { err: 'exists' };
  const salt = rid('S'), h = await hash(password, salt);
  return tx(db => {
    if (db.users.some(u => u.email === email)) return { err: 'exists' };
    const u = { id: rid('U'), email, name, phone, company: '', role: 'customer', type: 'meeting', notes: '', created: now(), pass: h, salt, via: 'password' };
    db.users.push(u); setSes(u.id); audit(db, email, 'user.signup', u.id); return { user: u };
  });
}
async function checkPw(email, password, role) {
  email = cl(email, 120).toLowerCase();
  const db0 = load(), u0 = db0.users.find(u => u.email === email && (!role || u.role === role));
  if (!u0 || !u0.pass) return { err: 'bad' };
  if (u0.lockUntil && u0.lockUntil > now()) return { err: 'locked' };
  const h = await hash(String(password || ''), u0.salt);
  return tx(db => {
    const u = db.users.find(x => x.id === u0.id);
    if (h !== u.pass) { u.fails = (u.fails || 0) + 1; if (u.fails >= 5) { u.lockUntil = now() + 5 * 6e4; u.fails = 0; } return { err: 'bad', keep: true }; }
    u.fails = 0; u.lockUntil = 0; u.lastLogin = now(); return { user: u };
  });
}
export async function signIn({ email, password }) { const r = await checkPw(email, password); if (r.user) setSes(r.user.id); return r; }
// Google Identity Services credential. Client-side checks only (aud, exp, email_verified);
// production must verify the JWT signature on the server.
export function googleSignIn(cred, clientId) {
  try {
    const b = cred.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const p = JSON.parse(decodeURIComponent(atob(b).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')));
    if (p.aud !== clientId || !p.email_verified || p.exp * 1000 < now()) return { err: 'google' };
    return tx(db => {
      const email = String(p.email).toLowerCase();
      let u = db.users.find(x => x.googleSub === p.sub) || db.users.find(x => x.email === email && x.role === 'customer');
      if (!u) { u = { id: rid('U'), email, name: cl(p.name, 80), phone: '', company: '', role: 'customer', type: 'meeting', notes: '', created: now(), via: 'google' }; db.users.push(u); audit(db, email, 'user.signup.google', u.id); }
      u.googleSub = p.sub; if (!u.name) u.name = cl(p.name, 80); u.lastLogin = now();
      setSes(u.id); return { user: u };
    });
  } catch (e) { return { err: 'google' }; }
}
function _updateProfile(uid, { name, phone, company }) {
  return tx(db => {
    const u = db.users.find(x => x.id === uid); if (!u) return { err: 'auth' };
    if (name !== undefined) { if (!cl(name)) return { err: 'name' }; u.name = cl(name, 80); }
    if (phone !== undefined) { if (phone && !phoneOk(phone)) return { err: 'phone' }; u.phone = cl(phone, 30); }
    if (company !== undefined) u.company = cl(company, 80);
    return { user: u };
  });
}
export const hasAdmin = db => db.users.some(u => u.role === 'admin');
export async function setupAdmin({ name, email, password }) {
  email = cl(email, 120).toLowerCase();
  if (hasAdmin(load())) return { err: 'exists' };
  if (!cl(name)) return { err: 'name' };
  if (!emailOk(email)) return { err: 'email' };
  if (String(password || '').length < 10) return { err: 'weak' };
  const salt = rid('S'), h = await hash(password, salt);
  return tx(db => {
    if (hasAdmin(db)) return { err: 'exists' };
    if (db.users.some(u => u.email === email)) return { err: 'taken' };
    const u = { id: rid('A'), email, name: cl(name, 80), phone: '', role: 'admin', created: now(), pass: h, salt };
    db.users.push(u); audit(db, email, 'admin.setup', u.id);
    sessionStorage.setItem(ASES, JSON.stringify({ uid: u.id, exp: now() + 8 * 36e5 })); return { user: u };
  });
}
export async function adminSignIn({ email, password }) {
  const r = await checkPw(email, password, 'admin');
  if (r.user) { sessionStorage.setItem(ASES, JSON.stringify({ uid: r.user.id, exp: now() + 8 * 36e5 })); tx(db => { audit(db, r.user.email, 'admin.signin', r.user.id); return {}; }); }
  return r;
}
export function adminUser(db) {
  try { const s = JSON.parse(sessionStorage.getItem(ASES) || 'null'); if (!s || s.exp < now()) return null; return db.users.find(u => u.id === s.uid && u.role === 'admin') || null; } catch (e) { return null; }
}
export function adminSignOut() { sessionStorage.removeItem(ASES); }

// Inquiries
export function addInquiry({ kind, officeId, interest, name, phone, email, msg, userId, source, utm }) {
  name = cl(name, 80); phone = cl(phone, 30); email = cl(email, 120).toLowerCase(); msg = cl(msg, 2000);
  if (!name) return { err: 'name' };
  if (!(phoneOk(phone) || emailOk(email))) return { err: 'contact' };
  if (email && !emailOk(email)) return { err: 'email' };
  return tx(db => {
    if (officeId) { const o = db.offices.find(x => x.id === officeId); if (!o || !o.visible || !['available', 'unset'].includes(o.status)) return { err: 'office' }; }
    const dup = db.inquiries.find(q => q.officeId === (officeId || null) && ((email && q.email === email) || (phone && q.phone === phone)) && now() - q.created < 6e4);
    if (dup) return { inquiry: dup, dup: true };
    const q = { id: rid('INQ'), kind: kind || 'contact', officeId: officeId || null, interest: interest || null, name, phone, email, msg, status: 'new', notes: '', created: now(), userId: userId || null, source: cl(source || '', 40) || null, utm: cl(utm || '', 160) };
    db.inquiries.push(q); audit(db, email || phone, 'inquiry.create', q.id); return { inquiry: q };
  });
}
// Landing-page visit counter (per page, per day, per campaign tag).
export function lpView(lp, utm) {
  lp = cl(lp, 20); if (!lp) return;
  return tx(db => { const v = db.lpViews || (db.lpViews = {}); const e = v[lp] || (v[lp] = { total: 0, days: {}, utm: {} });
    e.total++; const k = dkey(new Date()); e.days[k] = (e.days[k] || 0) + 1; const u = cl(utm || '', 160) || '—'; e.utm[u] = (e.utm[u] || 0) + 1; return {}; });
}
function _updateInquiry(actorId, id, patch) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const q = db.inquiries.find(x => x.id === id); if (!q) return { err: 'nf' };
    if (patch.status && ['new', 'contacted', 'progress', 'closed'].includes(patch.status)) q.status = patch.status;
    if (patch.notes !== undefined) q.notes = cl(patch.notes, 3000);
    q.updated = now(); return { inquiry: q };
  });
}

// Admin content management
function normSchedule(s) {
  const o = {};
  for (let d = 0; d < 7; d++) {
    const x = s && s[d]; if (!x) { o[d] = null; continue; }
    const open = Math.max(0, Math.min(21, +x.open || 0)), close = Math.max(open + DUR, Math.min(24, +x.close || 0));
    const st = [...new Set((x.starts || []).map(Number))].filter(h => h >= open && h + DUR <= close).sort((a, b) => a - b), out = [];
    st.forEach(h => { if (!out.length || h >= out[out.length - 1] + DUR) out.push(h); });
    o[d] = { open, close, starts: out };
  }
  return o;
}
const lines = v => (Array.isArray(v) ? v : String(v || '').split('\n')).map(x => cl(x, 120)).filter(Boolean).slice(0, 30);
function _updateRoom(actorId, id, p) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const r = db.rooms.find(x => x.id === id); if (!r) return { err: 'nf' };
    if (!cl(p.nameHe) || !cl(p.nameEn)) return { err: 'name' };
    Object.assign(r, {
      code: cl(p.code, 20) || r.code, nameHe: cl(p.nameHe, 80), nameEn: cl(p.nameEn, 80), descHe: cl(p.descHe, 2000), descEn: cl(p.descEn, 2000),
      capacity: Math.max(1, Math.min(500, parseInt(p.capacity) || 1)), price: Math.max(0, Math.round((+p.price || 0) * 100) / 100),
      pkgPrices: { half: Math.max(0, +(p.pkgHalf ?? (r.pkgPrices || {}).half ?? 500) || 0), day: Math.max(0, +(p.pkgDay ?? (r.pkgPrices || {}).day ?? 1200) || 0) },
      amenitiesHe: lines(p.amenitiesHe), amenitiesEn: lines(p.amenitiesEn), equipHe: lines(p.equipHe), equipEn: lines(p.equipEn),
      status: p.status === 'inactive' ? 'inactive' : 'active', visible: !!p.visible, order: parseInt(p.order) || 1,
      images: (p.images || []).slice(0, 12), schedule: normSchedule(p.schedule)
    });
    audit(db, db.users.find(u => u.id === actorId).email, 'room.update', r.id); return { room: r };
  });
}
function _addRoom(actorId) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const n = db.rooms.length + 1, base = db.rooms[0];
    const r = { id: rid('R'), code: 'AOS-' + pad(n), nameHe: 'חדר ישיבות ' + n, nameEn: 'Meeting room ' + n, descHe: '', descEn: '', capacity: 1, amenitiesHe: [], amenitiesEn: [], equipHe: [], equipEn: [], price: 0, schedule: JSON.parse(JSON.stringify(base ? base.schedule : {})), status: 'inactive', visible: false, order: n, images: [] };
    db.rooms.push(r); audit(db, db.users.find(u => u.id === actorId).email, 'room.add', r.id); return { room: r };
  });
}
function _deleteRoom(actorId, id) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    if (db.bookings.some(b => b.roomId === id)) return { err: 'has_bookings' };
    db.rooms = db.rooms.filter(r => r.id !== id); db.blocks = db.blocks.filter(b => b.roomId !== id); return { ok: true };
  });
}
export const OFFICE_STATUS = ['available', 'occupied', 'reserved', 'unavailable', 'unset'];
function _updateOffice(actorId, id, p) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const o = db.offices.find(x => x.id === id); if (!o) return { err: 'nf' };
    if (!cl(p.nameHe) || !cl(p.nameEn)) return { err: 'name' };
    if (p.tenantEmail && !emailOk(p.tenantEmail)) return { err: 'email' };
    const pr = String(p.price ?? '').trim();
    Object.assign(o, {
      code: cl(p.code, 20) || o.code, nameHe: cl(p.nameHe, 80), nameEn: cl(p.nameEn, 80), descHe: cl(p.descHe, 2000), descEn: cl(p.descEn, 2000),
      amenitiesHe: lines(p.amenitiesHe), amenitiesEn: lines(p.amenitiesEn), images: (p.images || []).slice(0, 12),
      price: pr === '' ? null : Math.max(0, +pr || 0), fee: String(p.fee ?? '').trim() === '' ? null : Math.max(0, +p.fee || 0), status: OFFICE_STATUS.includes(p.status) ? p.status : 'unset', visible: !!p.visible,
      order: parseInt(p.order) || o.order, notes: cl(p.notes, 3000),
      freeHours: String(p.freeHours ?? '').trim() === '' ? 3 : Math.max(0, Math.min(200, +p.freeHours || 0)), hourRate: String(p.hourRate ?? '').trim() === '' ? null : Math.max(0, +p.hourRate || 0),
      tenant: { ...o.tenant, name: cl(p.tenantName, 80), phone: cl(p.tenantPhone, 30), email: cl(p.tenantEmail, 120).toLowerCase(), since: cl(p.tenantSince, 20) }
    });
    // Tenants are linked only through createTenant (admin). Editing contact details never grants tenant access.
    audit(db, db.users.find(u => u.id === actorId).email, 'office.update', o.id); return { office: o };
  });
}
function _updateUser(actorId, id, { type, notes }) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const u = db.users.find(x => x.id === id && x.role === 'customer'); if (!u) return { err: 'nf' };
    if (type === 'meeting' || type === 'tenant') u.type = type;
    if (notes !== undefined) u.notes = cl(notes, 3000);
    return { user: u };
  });
}
function _updateSettings(actorId, s) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const c = {}; Object.keys(db.settings.content).forEach(k => c[k] = cl(s.content[k], 600));
    if (c.email && !emailOk(c.email)) return { err: 'email' };
    db.settings.content = c;
    db.settings.tax = { mode: ['none', 'included', 'added'].includes(s.tax.mode) ? s.tax.mode : 'none', pct: Math.max(0, Math.min(50, +s.tax.pct || 0)) };
    db.settings.holdMinutes = Math.max(5, Math.min(30, parseInt(s.holdMinutes) || 10));
    db.settings.requestHours = Math.max(1, Math.min(72, parseInt(s.requestHours) || 24));
    db.settings.windowDays = Math.max(7, Math.min(365, parseInt(s.windowDays) || 60));
    db.settings.cancelHours = Math.max(0, Math.min(168, parseInt(s.cancelHours) || 0));
    db.settings.extras = (s.extras || []).map(e => ({ id: e.id, he: cl(e.he, 80), en: cl(e.en, 80), price: Math.max(0, +e.price || 0), on: !!e.on })).filter(e => e.he);
    db.settings.integrations.googleClientId = cl(s.integrations.googleClientId, 200);
    audit(db, db.users.find(u => u.id === actorId).email, 'settings.update', '');
    return { ok: true };
  });
}
function _exportData(actorId) {
  const db = load(); if (!isAdm(db, actorId)) return null;
  const c = JSON.parse(JSON.stringify(db)); c.users.forEach(u => { delete u.pass; delete u.salt; }); return c;
}

// Meeting-room membership: 20% off bookings, subject to availability. Price excludes VAT.
export const MEMBER = { price: 120, discount: 0.2 };
export function isMember(db, uid) { const u = db.users.find(x => x.id === uid); const m = u && u.membership; return !!(m && m.status === 'active' && (!m.until || m.until > now())); }
export const memberTotal = db => { const pct = (db.settings.tax && db.settings.tax.pct) || 18; return { price: MEMBER.price, vatPct: pct, vat: Math.round(MEMBER.price * pct) / 100, total: Math.round(MEMBER.price * (100 + pct)) / 100 }; };
// Email verification by one-time code. Production: the server emails the code and never returns it to the client.
export function requestEmailCode({ email, name, phone }) {
  email = cl(email, 120).toLowerCase(); name = cl(name, 80); phone = cl(phone, 30);
  if (!name) return { err: 'name' }; if (!emailOk(email)) return { err: 'email' }; if (phone && !phoneOk(phone)) return { err: 'phone' };
  return tx(db => {
    db.codes = (db.codes || []).filter(c => c.exp > now() && c.email !== email);
    const code = String(100000 + Math.floor(Math.random() * 900000));
    db.codes.push({ email, name, phone, code, exp: now() + 10 * 6e4, tries: 0 });
    return { ok: true, demoCode: db.settings.integrations.email ? null : code };
  });
}
export function verifyEmailCode(email, code) {
  email = cl(email, 120).toLowerCase();
  return tx(db => {
    const c = (db.codes || []).find(x => x.email === email && x.exp > now());
    if (!c) return { err: 'codeExp' };
    if (c.tries >= 5) return { err: 'locked' };
    if (String(code || '').replace(/\D/g, '') !== c.code) { c.tries++; return { err: 'code', keep: true }; }
    db.codes = db.codes.filter(x => x !== c);
    let u = db.users.find(x => x.email === email && x.role === 'customer');
    if (db.users.some(x => x.email === email && x.role === 'admin')) return { err: 'exists' };
    if (!u) { u = { id: rid('U'), email, name: c.name, phone: c.phone, company: '', role: 'customer', type: 'meeting', notes: '', created: now(), via: 'email-code' }; db.users.push(u); audit(db, email, 'user.signup.code', u.id); }
    else if (!u.phone && c.phone) u.phone = c.phone;
    u.emailVerified = now(); u.lastLogin = now(); setSes(u.id); return { user: u };
  });
}
function _requestMembership(uid) {
  return tx(db => {
    const u = db.users.find(x => x.id === uid && x.role === 'customer'); if (!u) return { err: 'auth' };
    if (u.membership && ['active', 'pending_payment'].includes(u.membership.status)) return { membership: u.membership, dup: true };
    const p = memberTotal(db);
    u.membership = { status: 'pending_payment', price: p.price, vatPct: p.vatPct, total: p.total, requested: now() };
    db.inquiries.push({ id: rid('INQ'), kind: 'membership', officeId: null, interest: 'membership', name: u.name, phone: u.phone, email: u.email, msg: 'בקשת מנוי חדר ישיבות · ' + p.total + ' ₪ לחודש כולל מע״מ', status: 'new', notes: '', created: now(), userId: u.id });
    audit(db, u.email, 'membership.request', u.id); return { membership: u.membership };
  });
}
// Member self-service. Active: stops renewal, benefits stay until the paid period ends. Pending request: cancelled at once.
function _cancelMembership(uid) {
  return tx(db => {
    const u = db.users.find(x => x.id === uid && x.role === 'customer'); if (!u) return { err: 'auth' };
    const m = u.membership; if (!m) return { err: 'nf' };
    if (m.status === 'pending_payment') { m.status = 'cancelled'; m.cancelledAt = now(); audit(db, u.email, 'membership.cancel_request', u.id); return { membership: m, immediate: true }; }
    if (!isMember(db, uid)) return { err: 'status' };
    if (m.cancelAt) return { membership: m, dup: true };
    m.cancelAt = m.until || now(); m.cancelledAt = now(); audit(db, u.email, 'membership.cancel', u.id); return { membership: m };
  });
}
function _resumeMembership(uid) {
  return tx(db => {
    const u = db.users.find(x => x.id === uid && x.role === 'customer'); if (!u || !u.membership) return { err: 'auth' };
    if (!isMember(db, uid) || !u.membership.cancelAt) return { err: 'status' };
    delete u.membership.cancelAt; delete u.membership.cancelledAt; audit(db, u.email, 'membership.resume', u.id); return { membership: u.membership };
  });
}
function _setMembership(actorId, uid, status) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const u = db.users.find(x => x.id === uid); if (!u || !u.membership) return { err: 'nf' };
    if (!['active', 'cancelled', 'pending_payment'].includes(status)) return { err: 'status' };
    u.membership.status = status; if (status === 'active') { u.membership.since = now(); u.membership.until = now() + 31 * 864e5; delete u.membership.cancelAt; delete u.membership.cancelledAt; }
    audit(db, db.users.find(x => x.id === actorId).email, 'membership.' + status, u.id); return { membership: u.membership };
  });
}

// Admin team management (admins are created only from inside the dashboard)
async function _addAdmin(actorId, { name, email, password }) {
  email = cl(email, 120).toLowerCase(); name = cl(name, 80);
  const db0 = load(); if (!isAdm(db0, actorId)) return { err: 'auth' };
  if (!name) return { err: 'name' }; if (!emailOk(email)) return { err: 'email' };
  if (String(password || '').length < 8) return { err: 'weak' };
  if (db0.users.some(u => u.email === email)) return { err: 'taken' };
  const salt = rid('S'), h = await hash(password, salt);
  return tx(db => {
    if (db.users.some(u => u.email === email)) return { err: 'taken' };
    const u = { id: rid('A'), email, name, phone: '', role: 'admin', created: now(), pass: h, salt, by: actorId };
    db.users.push(u); audit(db, db.users.find(x => x.id === actorId).email, 'admin.add', u.id); return { user: u };
  });
}
function _removeAdmin(actorId, id) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    if (id === actorId) return { err: 'self' };
    const admins = db.users.filter(u => u.role === 'admin'); if (admins.length <= 1) return { err: 'last' };
    const i = db.users.findIndex(u => u.id === id && u.role === 'admin'); if (i < 0) return { err: 'nf' };
    const em = db.users[i].email; db.users.splice(i, 1); audit(db, db.users.find(x => x.id === actorId).email, 'admin.remove', em); return { ok: true };
  });
}
async function _changePassword(uid, oldPw, newPw) {
  const db0 = load(), u0 = db0.users.find(u => u.id === uid); if (!u0 || !u0.pass) return { err: 'auth' };
  if (String(newPw || '').length < 8) return { err: 'weak' };
  if (await hash(String(oldPw || ''), u0.salt) !== u0.pass) return { err: 'bad' };
  const salt = rid('S'), h = await hash(newPw, salt);
  return tx(db => { const u = db.users.find(x => x.id === uid); u.pass = h; u.salt = salt; delete u.seeded; audit(db, u.email, 'password.change', u.id); return { ok: true }; });
}

// ── Office tenants: own area, service tickets, hourly meeting-room bookings with monthly free hours ──
export const tenantIds = o => { const t = (o && o.tenant) || {}; const a = (t.userIds || []).slice(); if (t.userId && !a.includes(t.userId)) a.unshift(t.userId); return a; };
export const tenantOffice = (db, uid) => { if (!uid) return null; return db.offices.find(o => tenantIds(o).includes(uid)) || null; };
export const officeRate = (db, o) => { const r = db.rooms.find(x => x.id === 'R1') || db.rooms[0]; return o && o.hourRate != null ? o.hourRate : Math.round(((r && r.price) || 0) / DUR); };
export const monthKey = date => String(date).slice(0, 7);
export function tenantUsage(db, officeId, mk) {
  const o = db.offices.find(x => x.id === officeId); const free = o ? (o.freeHours ?? 3) : 0;
  const list = db.bookings.filter(b => b.tenant && b.officeId === officeId && b.status === 'confirmed' && monthKey(b.date) === mk).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const hours = list.reduce((a, b) => a + (b.end - b.start), 0), freeUsed = list.reduce((a, b) => a + (b.freeHours || 0), 0), paidHours = list.reduce((a, b) => a + (b.paidHours || 0), 0), due = list.reduce((a, b) => a + (b.total || 0), 0);
  return { free, freeUsed, left: Math.max(0, free - freeUsed), hours, paidHours, due: Math.round(due * 100) / 100, list };
}
export function tenantHours(db, roomId, date) {
  const room = db.rooms.find(r => r.id === roomId); if (!room) return [];
  const sc = room.schedule[parseD(date).getDay()]; if (!sc) return [];
  const t = new Date(), today = dkey(t), nowH = t.getHours() + t.getMinutes() / 60, out = [];
  for (let h = sc.open; h + 1 <= sc.close; h++) { const past = date < today || (date === today && h < nowH); const st = past ? 'past' : slotState(db, roomId, date, h, h + 1).state; out.push({ start: h, end: h + 1, state: st }); }
  return out;
}
function _tenantBook(uid, { date, start, hours }) {
  return tx(db => {
    const u = db.users.find(x => x.id === uid); if (!u) return { err: 'auth' };
    const o = tenantOffice(db, uid); if (!o) return { err: 'tenant' };
    const room = db.rooms.find(r => r.id === 'R1') || db.rooms[0]; if (!room) return { err: 'room' };
    start = parseInt(start); hours = parseInt(hours); if (!(hours >= 1) || isNaN(start)) return { err: 'slot' };
    const end = start + hours, sl = tenantHours(db, room.id, date); if (!sl.length) return { err: 'slot' };
    for (let h = start; h < end; h++) { const s = sl.find(x => x.start === h); if (!s) return { err: 'slot' }; if (s.state !== 'free') return { err: 'taken' }; }
    if (date > dkey(new Date(now() + db.settings.windowDays * 864e5))) return { err: 'window' };
    const use = tenantUsage(db, o.id, monthKey(date)), freeH = Math.min(hours, use.left), paidH = hours - freeH, rate = officeRate(db, o), base = paidH * rate, tx0 = db.settings.tax;
    let tax = 0, total = base; if (tx0.mode === 'added') { tax = Math.round(base * tx0.pct) / 100; total = base + tax; } else if (tx0.mode === 'included') tax = Math.round((base - base / (1 + tx0.pct / 100)) * 100) / 100;
    const q = { base, unit: rate, blocks: 1, disc: 0, extras: [], sub: base, tax, taxMode: tx0.mode, taxPct: tx0.pct, total: Math.round(total * 100) / 100, tenant: true, hours, freeHours: freeH, paidHours: paidH };
    const b = { id: rid('AOS'), roomId: room.id, date, start, end, userId: u.id, name: u.name || o.tenant.name, email: u.email, phone: u.phone || o.tenant.phone || '', company: o.tenant.name || '', quote: q, total: q.total, status: 'confirmed', pay: paidH ? 'unpaid' : 'none', created: now(), tenant: true, officeId: o.id, freeHours: freeH, paidHours: paidH };
    log(b, 'confirmed', u.email, 'tenant booking · ' + o.code); db.bookings.push(b); audit(db, u.email, 'tenant.book', b.id); return { booking: b };
  });
}
function _openTicket(uid, { kind, subject, msg, images }) {
  subject = cl(subject, 120); msg = cl(msg, 3000);
  return tx(db => {
    const u = db.users.find(x => x.id === uid); if (!u) return { err: 'auth' };
    const o = tenantOffice(db, uid); if (!o) return { err: 'tenant' };
    if (!subject) return { err: 'subject' };
    db.tickets = db.tickets || [];
    const imgs = (images || []).filter(x => typeof x === 'string' && x.startsWith('data:image/') && x.length < 450000).slice(0, 3);
    const t = { id: rid('T'), officeId: o.id, userId: uid, kind: kind === 'request' ? 'request' : 'fault', subject, msg, images: imgs, status: 'open', notes: '', thread: msg ? [{ by: 'tenant', uid, name: u.name || u.email, text: msg, at: now() }] : [], created: now(), updated: now() };
    db.tickets.push(t); audit(db, u.email, 'ticket.open', t.id); return { ticket: t };
  });
}
// Ticket conversation: every message (tenant, staff) and status change, oldest first. Legacy tickets derive it from msg/notes.
export function ticketThread(t) { if (Array.isArray(t.thread)) return t.thread; const a = []; if (t.msg) a.push({ by: 'tenant', uid: t.userId, text: t.msg, at: t.created }); if (t.notes) a.push({ by: 'staff', text: t.notes, at: t.updated || t.created }); return a; }
function tkThread(t) { if (!Array.isArray(t.thread)) t.thread = ticketThread(t).slice(); return t.thread; }
function _postTicketMsg(actorId, id, text) {
  text = cl(text, 3000);
  return tx(db => {
    const u = db.users.find(x => x.id === actorId); if (!u) return { err: 'auth' };
    const t = (db.tickets || []).find(x => x.id === id); if (!t) return { err: 'nf' };
    const adm = isAdm(db, actorId);
    if (!adm) { const o = tenantOffice(db, actorId); if (!o || o.id !== t.officeId) return { err: 'auth' }; }
    if (!text) return { err: 'msg' };
    tkThread(t).push({ by: adm ? 'staff' : 'tenant', uid: actorId, name: u.name || u.email, text, at: now() });
    if (adm) t.notes = text; t.updated = now(); audit(db, u.email, 'ticket.msg', t.id); return { ticket: t };
  });
}
function _updateTicket(actorId, id, { status, notes, internal }) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const t = (db.tickets || []).find(x => x.id === id); if (!t) return { err: 'nf' };
    if (status && ['open', 'progress', 'done'].includes(status) && status !== t.status) { t.status = status; tkThread(t).push({ by: 'system', status, at: now() }); }
    if (notes != null && cl(notes, 3000) !== (t.notes || '')) { t.notes = cl(notes, 3000); if (t.notes) tkThread(t).push({ by: 'staff', uid: actorId, name: (db.users.find(x => x.id === actorId) || {}).name || '', text: t.notes, at: now() }); } if (internal != null) t.internal = cl(internal, 3000); t.updated = now();
    audit(db, db.users.find(x => x.id === actorId).email, 'ticket.' + t.status, t.id); return { ticket: t };
  });
}

// ── Customer billing: saved payment method (provider token only) and auto-charge preference ──
// Production: savePaymentMethod is called by the server after the provider's hosted card form returns a token.
// Raw card numbers never reach this code or the database.
function _savePaymentMethod(uid, { token, brand, last4, exp }) {
  return tx(db => { const u = db.users.find(x => x.id === uid); if (!u) return { err: 'auth' };
    if (!token || !/^\d{4}$/.test(String(last4 || ''))) return { err: 'card' };
    u.card = { token: cl(token, 200), brand: cl(brand, 20), last4: String(last4), exp: cl(exp, 7), added: now() }; audit(db, u.email, 'card.save', u.id); return { card: { brand: u.card.brand, last4: u.card.last4, exp: u.card.exp } }; });
}
function _removePaymentMethod(uid) { return tx(db => { const u = db.users.find(x => x.id === uid); if (!u) return { err: 'auth' }; delete u.card; u.autoPay = false; audit(db, u.email, 'card.remove', u.id); return { ok: true }; }); }
function _setAutoPay(uid, on) { return tx(db => { const u = db.users.find(x => x.id === uid); if (!u) return { err: 'auth' }; u.autoPay = !!on; return { autoPay: u.autoPay }; }); }
export const invoiceNo = p => 'INV-' + String(p.at).slice(-6) + '-' + String(p.id || p.bookingId || '').slice(-4).toUpperCase();

// One switch for "available": shows the office on the site and opens it for enquiries; off hides it from the site.
function _setOfficeAvailable(actorId, id, on) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const o = db.offices.find(x => x.id === id); if (!o) return { err: 'nf' };
    o.status = on ? 'available' : 'unavailable'; o.visible = !!on;
    audit(db, db.users.find(x => x.id === actorId).email, on ? 'office.available' : 'office.unavailable', o.id); return { office: o };
  });
}

// Admin-only tenant accounts. A person can never sign up as a tenant on their own.
async function _createTenant(actorId, officeId, { name, email, phone, password }) {
  email = cl(email, 120).toLowerCase(); name = cl(name, 80); phone = cl(phone, 30);
  const db0 = load(); if (!isAdm(db0, actorId)) return { err: 'auth' };
  const o0 = db0.offices.find(x => x.id === officeId); if (!o0) return { err: 'nf' };
  if (!name) return { err: 'name' }; if (!emailOk(email)) return { err: 'email' };
  const ex = db0.users.find(u => u.email === email);
  if (ex && ex.role !== 'customer') return { err: 'taken' };
  if (!ex && String(password || '').length < 8) return { err: 'weak' };
  const salt = rid('S'), h = ex ? null : await hash(password, salt);
  return tx(db => {
    const o = db.offices.find(x => x.id === officeId);
    let u = db.users.find(x => x.email === email && x.role === 'customer');
    if (!u) { u = { id: rid('U'), email, name, phone, company: name, role: 'customer', type: 'tenant', notes: '', created: now(), pass: h, salt, via: 'admin-tenant' }; db.users.push(u); }
    else { u.type = 'tenant'; if (!u.phone && phone) u.phone = phone; }
    db.offices.forEach(x => { if (x !== o && x.tenant) { x.tenant.userIds = tenantIds(x).filter(id => id !== u.id); if (x.tenant.userId === u.id) x.tenant.userId = x.tenant.userIds[0] || null; } });
    const ids = tenantIds(o); if (!ids.includes(u.id)) ids.push(u.id);
    o.tenant = { ...o.tenant, name: o.tenant.name || name, email: o.tenant.email || email, phone: o.tenant.phone || phone, userIds: ids, userId: ids[0], since: o.tenant.since || dkey(new Date()) };
    if (o.status === 'available' || o.status === 'unset') o.status = 'occupied';
    audit(db, db.users.find(x => x.id === actorId).email, 'tenant.create', o.id + ':' + email); return { user: u, office: o, existing: !!ex };
  });
}
function _unlinkTenant(actorId, officeId, uid) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const o = db.offices.find(x => x.id === officeId); if (!o) return { err: 'nf' };
    const ids = tenantIds(o); if (!ids.includes(uid)) return { err: 'nf' };
    const u = db.users.find(x => x.id === uid); if (u) u.type = 'meeting';
    o.tenant.userIds = ids.filter(id => id !== uid); o.tenant.userId = o.tenant.userIds[0] || null; audit(db, db.users.find(x => x.id === actorId).email, 'tenant.unlink', o.id); return { office: o };
  });
}
// Customer classification shown in the admin: tenant (linked by admin) > member > one-time buyer > registered.
export function customerKind(db, u) {
  if (tenantOffice(db, u.id)) return 'tenant';
  if (u.membership && ['active', 'pending_payment'].includes(u.membership.status) && (u.membership.status !== 'active' || isMember(db, u.id))) return 'member';
  if (db.bookings.some(b => b.userId === u.id && !['hold', 'released'].includes(b.status))) return 'onetime';
  return 'registered';
}

// Special pricing: date-range price overrides and time-of-day percentage discounts.
export function blockPrice(room, date, start, pkgId) {
  const base = +room.price || 0; let p = pkgId ? pkgPrice(room, pkgId) : base; const rules = room.priceRules || [];
  const dr = rules.filter(r => r.type === 'date' && date >= r.from && date <= r.to).sort((a, b) => (b.created || 0) - (a.created || 0))[0];
  // A date rule sets the 3-hour price; longer packages scale by the same ratio.
  if (dr) p = pkgId && pkgId !== 'p3' ? (base > 0 ? p * (+dr.price || 0) / base : p) : (+dr.price || 0);
  const dow = parseD(date).getDay();
  const hr = rules.filter(r => r.type === 'hours' && start >= r.start && start < r.end && (!r.days || !r.days.length || r.days.includes(dow)) && (!r.from || date >= r.from) && (!r.to || date <= r.to)).sort((a, b) => b.pct - a.pct)[0];
  if (hr) p = p * (100 - Math.max(0, Math.min(100, +hr.pct || 0))) / 100;
  return Math.round(p * 100) / 100;
}
function _addPriceRule(actorId, roomId, r) {
  return tx(db => {
    if (!isAdm(db, actorId)) return { err: 'auth' };
    const room = db.rooms.find(x => x.id === roomId); if (!room) return { err: 'nf' };
    let rule;
    if (r.type === 'date') { if (!r.from || !r.to || r.to < r.from) return { err: 'range' }; if (!(+r.price >= 0) || String(r.price).trim() === '') return { err: 'price' }; rule = { id: rid('PR'), type: 'date', from: r.from, to: r.to, price: Math.max(0, +r.price), label: cl(r.label, 80), created: now() }; }
    else if (r.type === 'hours') { const s = parseInt(r.start), e = parseInt(r.end), p = +r.pct; if (isNaN(s) || isNaN(e) || e <= s) return { err: 'range' }; if (!(p > 0 && p <= 100)) return { err: 'pct' }; rule = { id: rid('PR'), type: 'hours', start: s, end: e, pct: p, days: (r.days || []).map(Number).filter(x => x >= 0 && x <= 6), from: r.from || '', to: r.to || '', label: cl(r.label, 80), created: now() }; }
    else return { err: 'type' };
    room.priceRules = (room.priceRules || []).concat([rule]); audit(db, db.users.find(x => x.id === actorId).email, 'price.rule.add', room.id); return { rule };
  });
}
function _removePriceRule(actorId, roomId, id) {
  return tx(db => { if (!isAdm(db, actorId)) return { err: 'auth' }; const room = db.rooms.find(x => x.id === roomId); if (!room) return { err: 'nf' }; room.priceRules = (room.priceRules || []).filter(x => x.id !== id); audit(db, db.users.find(x => x.id === actorId).email, 'price.rule.remove', room.id); return { ok: true }; });
}


// ── Row-level access (client-side mirror of the production RLS policies in db/rls.sql) ──
// Every write that names an actor must be made BY that actor: the id has to match the signed-in
// customer session or the signed-in admin session. Ownership/role checks inside each function then
// scope the row (own bookings, own office's tickets, admin-only tables).
let GUARD = true;
export function _strict(on) { GUARD = !!on; }
function sesOk(id) {
  if (!GUARD) return true;
  const db = read(); if (!db || !id) return false;
  const c = sessionUser(db), a = adminUser(db);
  return !!((c && c.id === id) || (a && a.id === id));
}
function guard(fn) {
  const isAsync = fn.constructor && fn.constructor.name === 'AsyncFunction';
  return function (id, ...rest) { if (!sesOk(id)) return isAsync ? Promise.resolve({ err: 'auth' }) : { err: 'auth' }; return fn(id, ...rest); };
}
export const createHold = guard(_createHold);
export const requestBooking = guard(_requestBooking);
export const releaseHold = guard(_releaseHold);
export const cancelBooking = guard(_cancelBooking);
export const recordPayment = guard(_recordPayment);
export const confirmUnpaid = guard(_confirmUnpaid);
export const markRefunded = guard(_markRefunded);
export const adminBooking = guard(_adminBooking);
export const addBlock = guard(_addBlock);
export const removeBlock = guard(_removeBlock);
export const updateProfile = guard(_updateProfile);
export const updateInquiry = guard(_updateInquiry);
export const updateRoom = guard(_updateRoom);
export const addRoom = guard(_addRoom);
export const deleteRoom = guard(_deleteRoom);
export const updateOffice = guard(_updateOffice);
export const updateUser = guard(_updateUser);
export const updateSettings = guard(_updateSettings);
export const exportData = guard(_exportData);
export const requestMembership = guard(_requestMembership);
export const cancelMembership = guard(_cancelMembership);
export const resumeMembership = guard(_resumeMembership);
export const setMembership = guard(_setMembership);
export const addAdmin = guard(_addAdmin);
export const removeAdmin = guard(_removeAdmin);
export const changePassword = guard(_changePassword);
export const tenantBook = guard(_tenantBook);
export const openTicket = guard(_openTicket);
export const postTicketMsg = guard(_postTicketMsg);
export const updateTicket = guard(_updateTicket);
export const savePaymentMethod = guard(_savePaymentMethod);
export const removePaymentMethod = guard(_removePaymentMethod);
export const setAutoPay = guard(_setAutoPay);
export const setOfficeAvailable = guard(_setOfficeAvailable);
export const createTenant = guard(_createTenant);
export const unlinkTenant = guard(_unlinkTenant);
export const addPriceRule = guard(_addPriceRule);
export const removePriceRule = guard(_removePriceRule);
