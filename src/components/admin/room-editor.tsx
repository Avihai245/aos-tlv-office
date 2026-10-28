"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import type { Img } from "@/lib/types";
import { ImageList } from "./image-list";
import { Notice, useRpc } from "./use-rpc";

export type RoomData = {
  id: string;
  code: string;
  nameHe: string;
  nameEn: string;
  descHe: string;
  descEn: string;
  capacity: number;
  price: number;
  priceHalf: number;
  priceDay: number;
  equipHe: string[];
  equipEn: string[];
  amenitiesHe: string[];
  amenitiesEn: string[];
  images: Img[];
  active: boolean;
  visible: boolean;
};
export type RuleData = {
  id: string;
  type: "date" | "hours";
  from_date: string | null;
  to_date: string | null;
  price: number | null;
  start_hour: number | null;
  end_hour: number | null;
  pct: number | null;
  days: number[];
};
export type HoursData = Record<number, { open: number; close: number }>;

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HOUR_OPTS = Array.from({ length: 19 }, (_, i) => i + 6);
const lines = (a: string[]) => a.join("\n");
const unlines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="fld">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function RoomEditor({
  room,
  hours,
  rules,
  member,
  tax,
  library,
}: {
  room: RoomData;
  hours: HoursData;
  rules: RuleData[];
  member: number;
  tax: { mode: string; pct: number };
  library: Img[];
}) {
  const { run, supabase, busy, err, msg, setErr } = useRpc();
  const [r, setR] = useState(room);
  const [sched, setSched] = useState<HoursData>(hours);
  const set = <K extends keyof RoomData>(k: K, v: RoomData[K]) => setR((s) => ({ ...s, [k]: v }));
  const num = (k: "capacity" | "price" | "priceHalf" | "priceDay") => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Math.max(0, Number(e.target.value) || 0));

  const [dr, setDr] = useState({ from: "", to: "", price: "" });
  const [hr, setHr] = useState({ start: "9", end: "12", pct: "", from: "", to: "", days: [] as number[] });

  const saveRoom = () =>
    void run(
      () =>
        supabase
          .from("rooms")
          .update({
            name_he: r.nameHe.trim(),
            name_en: r.nameEn.trim(),
            desc_he: r.descHe,
            desc_en: r.descEn,
            capacity: Math.max(1, r.capacity),
            price: r.price,
            price_half: r.priceHalf,
            price_day: r.priceDay,
            equip_he: r.equipHe,
            equip_en: r.equipEn,
            amenities_he: r.amenitiesHe,
            amenities_en: r.amenitiesEn,
            images: r.images,
            status: r.active ? "active" : "inactive",
            visible: r.visible,
          })
          .eq("id", r.id),
      "החדר נשמר. האתר מציג את השינויים.",
    );

  async function saveHours() {
    const open = Object.entries(sched).map(([d, h]) => ({ room_id: r.id, dow: Number(d), open_hour: h.open, close_hour: h.close }));
    const closed = [0, 1, 2, 3, 4, 5, 6].filter((d) => !sched[d]);
    if (open.some((h) => h.close_hour <= h.open_hour)) return setErr("שעת הסגירה חייבת להיות אחרי שעת הפתיחה");
    await run(async () => {
      const up = open.length ? await supabase.from("room_hours").upsert(open, { onConflict: "room_id,dow" }) : { error: null };
      if (up.error) return up;
      return closed.length ? await supabase.from("room_hours").delete().eq("room_id", r.id).in("dow", closed) : { error: null };
    }, "שעות הפעילות נשמרו");
  }

  const addDateRule = () => {
    if (!dr.from || !dr.to || dr.to < dr.from) return setErr("בחרו טווח תאריכים תקין");
    if (dr.price === "" || Number(dr.price) < 0) return setErr("הזינו מחיר");
    void run(() => supabase.from("price_rules").insert({ room_id: r.id, type: "date", label: "", from_date: dr.from, to_date: dr.to, price: Number(dr.price) }), "הכלל נוסף", () => setDr({ from: "", to: "", price: "" }));
  };
  const addHourRule = () => {
    const pct = Number(hr.pct);
    if (!(Number(hr.end) > Number(hr.start))) return setErr("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
    if (!(pct > 0 && pct <= 100)) return setErr("אחוז ההנחה חייב להיות בין 1 ל־100");
    void run(
      () => supabase.from("price_rules").insert({ room_id: r.id, type: "hours", label: "", start_hour: Number(hr.start), end_hour: Number(hr.end), pct, days: hr.days, from_date: hr.from || null, to_date: hr.to || null }),
      "ההנחה נוספה",
      () => setHr({ start: "9", end: "12", pct: "", from: "", to: "", days: [] }),
    );
  };
  const removeRule = (id: string) => void run(() => supabase.from("price_rules").delete().eq("id", id), "הכלל נמחק");

  const vat = tax.mode === "added" ? Math.round(r.price * tax.pct) / 100 : 0;
  const ruleTitle = (x: RuleData) =>
    x.type === "date"
      ? `${x.from_date} – ${x.to_date} · ${money(x.price)} לבלוק`
      : `${hh(x.start_hour ?? 0)}–${hh(x.end_hour ?? 0)} · ${x.pct}% הנחה${x.days.length ? ` · ${x.days.map((d) => DAYS[d]).join(", ")}` : ""}${x.from_date ? ` · ${x.from_date}–${x.to_date ?? ""}` : ""}`;

  return (
    <div>
      <Notice err={err} msg={msg} />

      <details className="det" open>
        <summary>
          <div>
            <b>פרטים כלליים</b>
            <span>שם, קיבולת ותצוגה באתר</span>
          </div>
        </summary>
        <div className="inner">
          <div className="form-grid">
            <Field id="rd-nh" label="שם (עברית)"><input id="rd-nh" className="in" value={r.nameHe} onChange={(e) => set("nameHe", e.target.value)} /></Field>
            <Field id="rd-ne" label="Name (English)"><input id="rd-ne" className="in" dir="ltr" value={r.nameEn} onChange={(e) => set("nameEn", e.target.value)} /></Field>
            <Field id="rd-cap" label="מספר משתתפים"><input id="rd-cap" className="in num" type="number" min={1} value={r.capacity} onChange={num("capacity")} /></Field>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <label className="chk"><input type="checkbox" checked={r.active} onChange={(e) => set("active", e.target.checked)} />פעיל להזמנות</label>
            <label className="chk"><input type="checkbox" checked={r.visible} onChange={(e) => set("visible", e.target.checked)} />מוצג באתר</label>
          </div>
        </div>
      </details>

      <details className="det">
        <summary>
          <div>
            <b>תיאור, ציוד ושירותים</b>
            <span>טקסטים שמוצגים בדף החדר</span>
          </div>
        </summary>
        <div className="inner">
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
            <Field id="rd-dh" label="תיאור (עברית)"><textarea id="rd-dh" className="in" rows={4} value={r.descHe} onChange={(e) => set("descHe", e.target.value)} /></Field>
            <Field id="rd-de" label="Description (English)"><textarea id="rd-de" className="in" dir="ltr" rows={4} value={r.descEn} onChange={(e) => set("descEn", e.target.value)} /></Field>
            <Field id="rd-eh" label="ציוד (שורה לכל פריט)" hint="מוצג כסמלים בדף החדר"><textarea id="rd-eh" className="in" rows={4} value={lines(r.equipHe)} onChange={(e) => set("equipHe", unlines(e.target.value))} /></Field>
            <Field id="rd-ee" label="Equipment (one per line)"><textarea id="rd-ee" className="in" dir="ltr" rows={4} value={lines(r.equipEn)} onChange={(e) => set("equipEn", unlines(e.target.value))} /></Field>
            <Field id="rd-ah" label="שירותים (שורה לכל פריט)"><textarea id="rd-ah" className="in" rows={4} value={lines(r.amenitiesHe)} onChange={(e) => set("amenitiesHe", unlines(e.target.value))} /></Field>
            <Field id="rd-ae" label="Amenities (one per line)"><textarea id="rd-ae" className="in" dir="ltr" rows={4} value={lines(r.amenitiesEn)} onChange={(e) => set("amenitiesEn", unlines(e.target.value))} /></Field>
          </div>
        </div>
      </details>

      <details className="det">
        <summary>
          <div>
            <b>שעות פעילות</b>
            <span>ימים ושעות פתיחה. החבילות (3 שעות, חצי יום, יום מלא) נקבעות לפי השעות האלה.</span>
          </div>
        </summary>
        <div className="inner">
          {DAYS.map((name, d) => {
            const h = sched[d];
            return (
              <div key={d} className="sched">
                <div className="rowh">
                  <label className="chk" style={{ minWidth: 110 }}>
                    <input type="checkbox" checked={!!h} onChange={(e) => setSched((s) => { const n = { ...s }; if (e.target.checked) n[d] = { open: 9, close: 18 }; else delete n[d]; return n; })} />
                    <b>{name}</b>
                  </label>
                  {h && (
                    <>
                      <select className="in" style={{ width: 110 }} aria-label={`פתיחה ביום ${name}`} value={h.open} onChange={(e) => setSched((s) => ({ ...s, [d]: { ...h, open: Number(e.target.value) } }))}>
                        {HOUR_OPTS.map((o) => <option key={o} value={o}>{hh(o)}</option>)}
                      </select>
                      <span>–</span>
                      <select className="in" style={{ width: 110 }} aria-label={`סגירה ביום ${name}`} value={h.close} onChange={(e) => setSched((s) => ({ ...s, [d]: { ...h, close: Number(e.target.value) } }))}>
                        {HOUR_OPTS.map((o) => <option key={o} value={o}>{hh(o)}</option>)}
                      </select>
                    </>
                  )}
                  {!h && <span className="muted">סגור</span>}
                </div>
              </div>
            );
          })}
          <div>
            <button type="button" className="btn b-p" disabled={busy} onClick={() => void saveHours()}>שמירת שעות הפעילות</button>
          </div>
        </div>
      </details>

      <details className="det" open>
        <summary>
          <div>
            <b>תמחור</b>
            <span>מחיר בסיס לכל חבילה, מחירים לתאריכים והנחות לפי שעות</span>
          </div>
          <span className="tag t-n">{rules.length}</span>
        </summary>
        <div className="inner">
          <div className="form-grid">
            <Field id="pr-p3" label="3 שעות (₪)"><input id="pr-p3" className="in num" type="number" min={0} step={10} value={r.price} onChange={num("price")} /></Field>
            <Field id="pr-half" label="חצי יום · 5 שעות (₪)"><input id="pr-half" className="in num" type="number" min={0} step={10} value={r.priceHalf} onChange={num("priceHalf")} /></Field>
            <Field id="pr-day" label="יום מלא · 09:00–18:00 (₪)"><input id="pr-day" className="in num" type="number" min={0} step={10} value={r.priceDay} onChange={num("priceDay")} /></Field>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            למנויים ({Math.round(member * 100)}% הנחה): 3 שעות {money(Math.round(r.price * (1 - member) * 100) / 100)}
            {tax.mode === "added" ? ` · כולל מע״מ ${money(r.price + vat)}` : ""}. המחירים נשמרים עם ״שמירת החדר״.
          </p>

          <div className="sect">
            <h3>כללי מחיר פעילים</h3>
            {rules.length === 0 && <p className="muted" style={{ margin: 0 }}>אין כללים. כל החבילות במחיר הבסיס.</p>}
            <ul className="list">
              {rules.map((x) => (
                <li key={x.id}>
                  <span>
                    <span className={`tag ${x.type === "date" ? "t-warn" : "t-ok"}`}>{x.type === "date" ? "תאריכים" : "שעות"}</span> <b>{ruleTitle(x)}</b>
                  </span>
                  <button type="button" className="btn b-g b-sm" disabled={busy} onClick={() => removeRule(x.id)}>מחיקה</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="sect">
            <h3>מחיר שונה לתאריכים</h3>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>בטווח התאריכים, מחיר הבלוק יוחלף במחיר שתקבעו (למשל חגים או עונה).</p>
            <div className="form-grid">
              <Field id="pr-from" label="מתאריך"><input id="pr-from" className="in" type="date" dir="ltr" value={dr.from} onChange={(e) => setDr({ ...dr, from: e.target.value })} /></Field>
              <Field id="pr-to" label="עד תאריך"><input id="pr-to" className="in" type="date" dir="ltr" value={dr.to} onChange={(e) => setDr({ ...dr, to: e.target.value })} /></Field>
              <Field id="pr-price" label="מחיר לבלוק (₪)"><input id="pr-price" className="in num" type="number" min={0} value={dr.price} onChange={(e) => setDr({ ...dr, price: e.target.value })} /></Field>
            </div>
            <div><button type="button" className="btn b-p" disabled={busy} onClick={addDateRule}>הוספה</button></div>
          </div>

          <div className="sect">
            <h3>הנחה לפי שעות</h3>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>בלוק שמתחיל בין השעות שתבחרו יקבל אחוז הנחה. אפשר להגביל לימים מסוימים ולטווח תאריכים.</p>
            <div className="form-grid">
              <Field id="ph-s" label="משעה">
                <select id="ph-s" className="in" value={hr.start} onChange={(e) => setHr({ ...hr, start: e.target.value })}>{HOUR_OPTS.map((o) => <option key={o} value={o}>{hh(o)}</option>)}</select>
              </Field>
              <Field id="ph-e" label="עד שעה">
                <select id="ph-e" className="in" value={hr.end} onChange={(e) => setHr({ ...hr, end: e.target.value })}>{HOUR_OPTS.map((o) => <option key={o} value={o}>{hh(o)}</option>)}</select>
              </Field>
              <Field id="ph-pct" label="אחוז הנחה"><input id="ph-pct" className="in num" type="number" min={1} max={100} value={hr.pct} onChange={(e) => setHr({ ...hr, pct: e.target.value })} /></Field>
              <Field id="ph-from" label="מתאריך (רשות)"><input id="ph-from" className="in" type="date" dir="ltr" value={hr.from} onChange={(e) => setHr({ ...hr, from: e.target.value })} /></Field>
              <Field id="ph-to" label="עד תאריך (רשות)"><input id="ph-to" className="in" type="date" dir="ltr" value={hr.to} onChange={(e) => setHr({ ...hr, to: e.target.value })} /></Field>
            </div>
            <div role="group" aria-label="ימים" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {DAYS.map((d, i) => (
                <button key={d} type="button" className={hr.days.includes(i) ? "btn b-p b-sm" : "btn b-s b-sm"} aria-pressed={hr.days.includes(i)} onClick={() => setHr({ ...hr, days: hr.days.includes(i) ? hr.days.filter((x) => x !== i) : [...hr.days, i] })}>
                  {d}
                </button>
              ))}
              <span className="muted" style={{ fontSize: 13 }}>בלי בחירה = כל הימים</span>
            </div>
            <div><button type="button" className="btn b-p" disabled={busy} onClick={addHourRule}>הוספת הנחה</button></div>
          </div>
        </div>
      </details>

      <details className="det">
        <summary>
          <div>
            <b>תמונות</b>
            <span>תמונות החדר בגלריה באתר. התמונה הראשונה היא הראשית.</span>
          </div>
          <span className="tag t-n">{r.images.length}</span>
        </summary>
        <div className="inner">
          <ImageList images={r.images} onChange={(v) => set("images", v)} folder={`rooms/${r.id}`} library={library} />
        </div>
      </details>

      <div className="sticky-save">
        <button type="button" className="btn b-p" disabled={busy} onClick={saveRoom}>שמירת החדר</button>
        <button type="button" className="btn b-g" onClick={() => setR(room)}>ביטול שינויים</button>
        <span className="muted" style={{ fontSize: 13 }}>שעות פעילות וכללי מחיר נשמרים בנפרד, בכפתורים שבתוך כל חלק.</span>
      </div>
    </div>
  );
}
