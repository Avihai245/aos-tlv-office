"use client";

import { useState } from "react";
import { hm, money } from "@/lib/format";
import { Notice, useRpc } from "./use-rpc";

export type PkgOption = { id: string; name: string; hours: number; starts: number[] };

/** Manual booking and time blocks for a free slot chosen in the calendar. */
export function SlotPanel({
  roomId,
  date,
  start,
  end,
  dayOpen,
  dayClose,
  price,
  packages,
  closeHref,
}: {
  roomId: string;
  date: string;
  start: number;
  end: number;
  dayOpen: number;
  dayClose: number;
  price: number;
  packages: PkgOption[];
  closeHref: string;
}) {
  const { call, busy, err, msg, router } = useRpc();
  const options = packages.filter((p) => p.starts.includes(start));
  const [pkg, setPkg] = useState(options.find((p) => p.hours === end - start)?.id ?? options[0]?.id ?? "p3");
  const chosen = options.find((p) => p.id === pkg);
  const [f, setF] = useState({ name: "", email: "", phone: "", note: "", paid: false, reason: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: k === "paid" ? e.target.checked : e.target.value }));
  const close = () => router.push(closeHref, { scroll: false });

  return (
    <>
      <Notice err={err} msg={msg} />
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void call(
            "admin_create_booking",
            { p_room: roomId, p_date: date, p_start: start, p_end: start + (chosen?.hours ?? 3), p_name: f.name, p_email: f.email, p_phone: f.phone, p_paid: f.paid, p_note: f.note },
            "ההזמנה נוצרה",
            close,
          );
        }}
      >
        <h3 style={{ fontSize: 16 }}>הזמנה ידנית</h3>
        {options.length > 1 && (
          <div className="fld">
            <label htmlFor="mf-pkg">חבילה</label>
            <select id="mf-pkg" className="in" value={pkg} onChange={(e) => setPkg(e.target.value)}>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {hm(start)}–{hm(start + p.hours)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="fld">
          <label htmlFor="mf-name">שם הלקוח</label>
          <input id="mf-name" className="in" value={f.name} onChange={set("name")} />
        </div>
        <div className="fld">
          <label htmlFor="mf-email">אימייל</label>
          <input id="mf-email" className="in" type="email" dir="ltr" value={f.email} onChange={set("email")} />
        </div>
        <div className="fld">
          <label htmlFor="mf-phone">טלפון</label>
          <input id="mf-phone" className="in" type="tel" dir="ltr" value={f.phone} onChange={set("phone")} />
        </div>
        <div className="fld">
          <label htmlFor="mf-note">הערה</label>
          <input id="mf-note" className="in" value={f.note} onChange={set("note")} />
        </div>
        <label className="chk">
          <input type="checkbox" checked={f.paid} onChange={set("paid")} />
          התשלום התקבל מחוץ לאתר (מזומן / העברה)
        </label>
        <button type="submit" className="btn b-p" disabled={busy}>
          יצירת הזמנה{price > 0 ? <> · <span className="ltr">{money(price)}</span></> : null}
        </button>
      </form>

      <div className="sect">
        <h3>חסימת זמן</h3>
        <div className="fld">
          <label htmlFor="mf-reason">סיבה (פנימי)</label>
          <input id="mf-reason" className="in" value={f.reason} onChange={set("reason")} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn b-s" disabled={busy} onClick={() => void call("admin_add_block", { p_room: roomId, p_date: date, p_start: start, p_end: end, p_reason: f.reason }, "הבלוק נחסם", close)}>
            חסימת הבלוק
          </button>
          <button type="button" className="btn b-s" disabled={busy} onClick={() => void call("admin_add_block", { p_room: roomId, p_date: date, p_start: dayOpen, p_end: dayClose, p_reason: f.reason }, "היום נחסם", close)}>
            חסימת כל היום בחדר
          </button>
        </div>
      </div>
    </>
  );
}

export function BlockPanel({ id, closeHref }: { id: string; closeHref: string }) {
  const { run, supabase, busy, err, msg, router } = useRpc();
  return (
    <>
      <Notice err={err} msg={msg} />
      <div>
        <button
          type="button"
          className="btn b-p"
          disabled={busy}
          onClick={() => void run(() => supabase.from("blocks").delete().eq("id", id), "החסימה שוחררה", () => router.push(closeHref, { scroll: false }))}
        >
          שחרור החסימה
        </button>
      </div>
    </>
  );
}
