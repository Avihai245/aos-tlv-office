"use client";

import { useState } from "react";
import type { Settings, SiteContent } from "@/lib/types";
import { Notice, useRpc } from "./use-rpc";

const CONTENT: { key: keyof SiteContent; label: string; dir?: "ltr"; type?: string }[] = [
  { key: "addressHe", label: "כתובת (עברית)" },
  { key: "addressEn", label: "Address (English)", dir: "ltr" },
  { key: "hoursAHe", label: "שעות פעילות, שורה א׳ (עברית)" },
  { key: "hoursAEn", label: "Opening hours, line 1 (English)", dir: "ltr" },
  { key: "hoursBHe", label: "שעות פעילות, שורה ב׳ (עברית)" },
  { key: "hoursBEn", label: "Opening hours, line 2 (English)", dir: "ltr" },
  { key: "heroAHe", label: "כותרת ראשית, שורה א׳ (עברית)" },
  { key: "heroAEn", label: "Headline, line 1 (English)", dir: "ltr" },
  { key: "heroBHe", label: "כותרת ראשית, שורה ב׳ (עברית)" },
  { key: "heroBEn", label: "Headline, line 2 (English)", dir: "ltr" },
  { key: "heroSubHe", label: "כותרת משנה (עברית)" },
  { key: "heroSubEn", label: "Subheading (English)", dir: "ltr" },
  { key: "phone", label: "טלפון", dir: "ltr", type: "tel" },
  { key: "email", label: "אימייל", dir: "ltr", type: "email" },
  { key: "whatsapp", label: "WhatsApp (מספר בינלאומי)", dir: "ltr", type: "tel" },
  { key: "lat", label: "קו רוחב (Latitude) למפות וחיפוש, למשל 32.0746", dir: "ltr" },
  { key: "lng", label: "קו אורך (Longitude), למשל 34.7922", dir: "ltr" },
];

type Rules = Pick<Settings, "holdMinutes" | "requestHours" | "cancelHours" | "windowDays" | "memberPrice" | "samedayLeadHours" | "taxPct" | "taxMode"> & { memberPct: number };

const RULES: { key: keyof Omit<Rules, "taxMode">; label: string; min: number; max: number; step?: number }[] = [
  { key: "holdMinutes", label: "דקות שמירת בלוק בזמן הזמנה", min: 5, max: 30 },
  { key: "requestHours", label: "שעות שמירה לבקשת הזמנה", min: 1, max: 72 },
  { key: "cancelHours", label: "שעות לפני הפגישה לסגירת ביטול", min: 0, max: 168 },
  { key: "windowDays", label: "ימים קדימה להזמנה", min: 7, max: 365 },
  { key: "samedayLeadHours", label: "שעות מינימום להזמנה לאותו יום (מנויים)", min: 0, max: 24, step: 0.5 },
  { key: "memberPrice", label: "מחיר מנוי חודשי (₪, לפני מע״מ)", min: 0, max: 100000 },
  { key: "memberPct", label: "הנחת מנוי (%)", min: 0, max: 100 },
  { key: "taxPct", label: "אחוז מע״מ", min: 0, max: 50, step: 0.5 },
];

export function SettingsForm({ content, rules }: { content: SiteContent; rules: Rules }) {
  const { run, supabase, busy, err, msg, setErr } = useRpc();
  const [c, setC] = useState(content);
  const [r, setR] = useState(rules);

  const save = () => {
    for (const f of RULES) {
      const v = Number(r[f.key]);
      if (!Number.isFinite(v) || v < f.min || v > f.max) return setErr(`הערך "${f.label}" חייב להיות בין ${f.min} ל־${f.max}`);
    }
    void run(
      () =>
        supabase
          .from("settings")
          .update({
            content: c,
            hold_minutes: r.holdMinutes,
            request_hours: r.requestHours,
            cancel_hours: r.cancelHours,
            window_days: r.windowDays,
            sameday_lead_hours: r.samedayLeadHours,
            member_price: r.memberPrice,
            member_discount: Math.round(r.memberPct) / 100,
            tax_pct: r.taxPct,
            tax_mode: r.taxMode,
          })
          .eq("id", 1),
      "ההגדרות נשמרו. האתר מציג את התוכן המעודכן.",
    );
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1>תוכן והגדרות</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn b-g" onClick={() => { setC(content); setR(rules); }}>ביטול שינויים</button>
          <button type="button" className="btn b-p" disabled={busy} onClick={save}>שמירת ההגדרות</button>
        </div>
      </div>
      <Notice err={err} msg={msg} />
      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="card stack">
          <h2 style={{ fontSize: 19 }}>תוכן האתר ופרטי קשר</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>טלפון, אימייל ו־WhatsApp מוצגים באתר רק אם מולאו.</p>
          <div className="stack">
            {CONTENT.map((f) => (
              <div key={f.key} className="fld">
                <label htmlFor={`c-${f.key}`}>{f.label}</label>
                <input id={`c-${f.key}`} className="in" type={f.type ?? "text"} dir={f.dir} value={c[f.key]} onChange={(e) => setC({ ...c, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>
        </section>
        <div className="stack" style={{ gap: 20 }}>
          <section className="card stack">
            <h2 style={{ fontSize: 19 }}>כללי הזמנה ומיסים</h2>
            <div className="form-grid">
              {RULES.map((f) => (
                <div key={f.key} className="fld">
                  <label htmlFor={`r-${f.key}`}>{f.label}</label>
                  <input id={`r-${f.key}`} className="in num" type="number" min={f.min} max={f.max} step={f.step ?? 1} value={r[f.key]} onChange={(e) => setR({ ...r, [f.key]: e.target.value === "" ? NaN : Number(e.target.value) })} />
                </div>
              ))}
              <div className="fld">
                <label htmlFor="tax-mode">אופן חישוב מע״מ</label>
                <select id="tax-mode" className="in" value={r.taxMode} onChange={(e) => setR({ ...r, taxMode: e.target.value as Settings["taxMode"] })}>
                  <option value="none">ללא שורת מס</option>
                  <option value="included">המחירים כוללים מע״מ</option>
                  <option value="added">מע״מ מתווסף למחיר</option>
                </select>
              </div>
            </div>
          </section>
          <section className="card stack">
            <h2 style={{ fontSize: 19 }}>חיבורים חיצוניים</h2>
            {[
              ["סליקה", "תשלום מקוון בכרטיס אשראי. עד לחיבור, הזמנה היא בקשה שהצוות מאשר ידנית.", "לא מחובר"],
              ["דיוור", "שליחת אישורים ואימות כתובת אימייל. מוגדר ב־Supabase Auth → SMTP.", "לא מחובר"],
              ["כניסה עם Google", "מוגדר ב־Supabase Auth → Providers → Google.", "לא מחובר"],
            ].map(([n, note, st]) => (
              <div key={n} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                <span>
                  <b>{n}</b>
                  <br />
                  <span className="muted" style={{ fontSize: 13 }}>{note}</span>
                </span>
                <span className="tag t-n">{st}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

const TABLES = ["settings", "rooms", "room_hours", "packages", "price_rules", "offices", "office_admin", "office_tenants", "bookings", "payments", "memberships", "customers_v", "inquiries", "tickets", "ticket_messages"] as const;

/** Downloads a JSON snapshot of the business tables the admin can read. */
export function ExportBackup() {
  const { supabase } = useRpc();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn b-s"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const out: Record<string, unknown> = { exportedAt: new Date().toISOString() };
        for (const t of TABLES) {
          const { data } = await supabase.from(t).select("*");
          out[t] = data ?? [];
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
        a.download = `aos-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setBusy(false);
      }}
    >
      {busy ? "מייצא…" : "ייצוא גיבוי (JSON)"}
    </button>
  );
}
