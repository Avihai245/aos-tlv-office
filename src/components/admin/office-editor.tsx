"use client";

import { useState } from "react";
import { createAccount, findAccount } from "@/app/admin/actions";
import type { Img } from "@/lib/types";
import { ImageList } from "./image-list";
import { Notice, adminErr, useRpc } from "./use-rpc";

export type OfficeData = {
  id: string;
  code: string;
  nameHe: string;
  nameEn: string;
  descHe: string;
  descEn: string;
  amenitiesHe: string[];
  amenitiesEn: string[];
  images: Img[];
  price: number;
  mgmtFee: number;
  freeHours: number;
  hourRate: number;
  status: string;
  visible: boolean;
  tenant: { name: string; email: string; phone: string; since: string; notes: string };
};
export type TenantUser = { id: string; name: string; email: string };

const STATUSES: [string, string][] = [
  ["unset", "זמינות בבירור"],
  ["available", "פנוי"],
  ["reserved", "שמור"],
  ["occupied", "מאוכלס"],
  ["unavailable", "לא זמין"],
];
const lines = (a: string[]) => a.join("\n");
const unlines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function OfficeEditor({ office, users, library }: { office: OfficeData; users: TenantUser[]; library: Img[] }) {
  const { run, call, supabase, busy, err, msg, setErr, setMsg } = useRpc();
  const [o, setO] = useState(office);
  const set = <K extends keyof OfficeData>(k: K, v: OfficeData[K]) => setO((s) => ({ ...s, [k]: v }));
  const num = (k: "price" | "mgmtFee" | "freeHours" | "hourRate") => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Math.max(0, Number(e.target.value) || 0));
  const setT = (k: keyof OfficeData["tenant"]) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set("tenant", { ...o.tenant, [k]: e.target.value });

  const [tf, setTf] = useState({ email: "", name: "", phone: "", pw: "" });
  const [tBusy, setTBusy] = useState(false);

  async function save() {
    const ok = await run(
      () =>
        supabase
          .from("offices")
          .update({
            name_he: o.nameHe.trim(),
            name_en: o.nameEn.trim(),
            desc_he: o.descHe,
            desc_en: o.descEn,
            amenities_he: o.amenitiesHe,
            amenities_en: o.amenitiesEn,
            images: o.images,
            price: o.price || null,
            mgmt_fee: o.mgmtFee || null,
            free_hours: o.freeHours,
            hour_rate: o.hourRate || null,
            status: o.status,
            visible: o.visible,
          })
          .eq("id", o.id),
      "המשרד נשמר",
    );
    if (!ok) return;
    const t = o.tenant;
    await supabase.from("office_admin").upsert(
      { office_id: o.id, tenant_name: t.name, tenant_email: t.email, tenant_phone: t.phone, tenant_since: t.since || null, notes: t.notes },
      { onConflict: "office_id" },
    );
  }

  /** Links an existing account by email, or creates one with a temporary password when the email is new. */
  async function addTenant() {
    setTBusy(true);
    setErr("");
    setMsg("");
    const found = await findAccount(tf.email);
    let userId = found.id;
    if (found.err && found.err !== "nf") {
      setTBusy(false);
      return setErr(adminErr(found.err));
    }
    if (found.role === "admin") {
      setTBusy(false);
      return setErr("חשבון ניהול לא יכול להיות דייר");
    }
    if (!userId) {
      const res = await createAccount({ email: tf.email, name: tf.name, phone: tf.phone, password: tf.pw, minPassword: 8 });
      if (res.err || !res.userId) {
        setTBusy(false);
        return setErr(res.err === "weak" ? "הסיסמה הזמנית חייבת להיות באורך 8 תווים לפחות" : res.err === "phone" ? "מספר טלפון לא תקין" : adminErr(res.err ?? "gen"));
      }
      userId = res.userId;
    }
    setTBusy(false);
    const ok = await call("admin_link_tenant", { p_office: o.id, p_user: userId }, "הדייר שויך למשרד");
    if (ok) setTf({ email: "", name: "", phone: "", pw: "" });
  }

  return (
    <div>
      <Notice err={err} msg={msg} />
      <details className="det" open>
        <summary>
          <div><b>פרטים כלליים</b><span>שם, סטטוס ותצוגה באתר</span></div>
        </summary>
        <div className="inner">
          <div className="form-grid">
            <div className="fld"><label htmlFor="od-nh">שם (עברית)</label><input id="od-nh" className="in" value={o.nameHe} onChange={(e) => set("nameHe", e.target.value)} /></div>
            <div className="fld"><label htmlFor="od-ne">Name (English)</label><input id="od-ne" className="in" dir="ltr" value={o.nameEn} onChange={(e) => set("nameEn", e.target.value)} /></div>
            <div className="fld">
              <label htmlFor="od-st">סטטוס</label>
              <select id="od-st" className="in" value={o.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <label className="chk"><input type="checkbox" checked={o.visible} onChange={(e) => set("visible", e.target.checked)} />מוצג באתר</label>
        </div>
      </details>

      <details className="det">
        <summary>
          <div><b>מחירים ושעות בחדר הישיבות</b><span>שכירות, דמי ניהול, שעות חינם ומחיר לשעה</span></div>
        </summary>
        <div className="inner">
          <div className="form-grid">
            <div className="fld"><label htmlFor="od-pr">שכירות חודשית (₪)</label><input id="od-pr" className="in num" type="number" min={0} value={o.price} onChange={num("price")} /></div>
            <div className="fld"><label htmlFor="od-mf">דמי ניהול (₪)</label><input id="od-mf" className="in num" type="number" min={0} value={o.mgmtFee} onChange={num("mgmtFee")} /></div>
            <div className="fld"><label htmlFor="od-fh">שעות חינם בחודש בחדר הישיבות</label><input id="od-fh" className="in num" type="number" min={0} max={200} value={o.freeHours} onChange={num("freeHours")} /></div>
            <div className="fld">
              <label htmlFor="od-hr">מחיר לשעה אחרי השעות החינם (₪)</label>
              <input id="od-hr" className="in num" type="number" min={0} value={o.hourRate} onChange={num("hourRate")} />
              <small>ריק או 0 = שליש ממחיר החדר ל־3 שעות</small>
            </div>
          </div>
        </div>
      </details>

      <details className="det">
        <summary>
          <div><b>תיאור ומאפיינים</b><span>טקסט ומאפיינים שמוצגים באתר</span></div>
        </summary>
        <div className="inner">
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
            <div className="fld"><label htmlFor="od-dh">תיאור (עברית)</label><textarea id="od-dh" className="in" rows={3} value={o.descHe} onChange={(e) => set("descHe", e.target.value)} /></div>
            <div className="fld"><label htmlFor="od-de">Description (English)</label><textarea id="od-de" className="in" dir="ltr" rows={3} value={o.descEn} onChange={(e) => set("descEn", e.target.value)} /></div>
            <div className="fld"><label htmlFor="od-ah">מאפיינים (שורה לכל פריט)</label><textarea id="od-ah" className="in" rows={4} value={lines(o.amenitiesHe)} onChange={(e) => set("amenitiesHe", unlines(e.target.value))} /></div>
            <div className="fld"><label htmlFor="od-ae">Amenities (one per line)</label><textarea id="od-ae" className="in" dir="ltr" rows={4} value={lines(o.amenitiesEn)} onChange={(e) => set("amenitiesEn", unlines(e.target.value))} /></div>
          </div>
        </div>
      </details>

      <details className="det">
        <summary>
          <div><b>שוכר ודיירים</b><span>פרטי השוכר והוספת דיירים לאזור השוכרים</span></div>
          <span className="tag t-n">{users.length}</span>
        </summary>
        <div className="inner">
          <div className="stack">
            <b>פרטי השוכר בהסכם</b>
            <div className="form-grid">
              <div className="fld"><label htmlFor="ot-n">שם השוכר / חברה</label><input id="ot-n" className="in" value={o.tenant.name} onChange={setT("name")} /></div>
              <div className="fld"><label htmlFor="ot-e">אימייל</label><input id="ot-e" className="in" type="email" dir="ltr" value={o.tenant.email} onChange={setT("email")} /></div>
              <div className="fld"><label htmlFor="ot-p">טלפון</label><input id="ot-p" className="in" type="tel" dir="ltr" value={o.tenant.phone} onChange={setT("phone")} /></div>
              <div className="fld"><label htmlFor="ot-s">שוכר מתאריך</label><input id="ot-s" className="in" type="date" dir="ltr" value={o.tenant.since} onChange={setT("since")} /></div>
            </div>
            <div className="fld"><label htmlFor="ot-no">הערות פנימיות</label><textarea id="ot-no" className="in" rows={2} value={o.tenant.notes} onChange={setT("notes")} /></div>
          </div>

          <div className="sect">
            <div className="row"><b>דיירים עם גישה לאזור השוכרים</b><span className="tag t-n">{users.length}</span></div>
            {users.length === 0 && <p className="muted" style={{ margin: 0 }}>עדיין אין דיירים משויכים למשרד הזה.</p>}
            <ul className="list">
              {users.map((m) => (
                <li key={m.id}>
                  <span><b>{m.name}</b> <span className="muted ltr">{m.email}</span></span>
                  <button type="button" className="btn b-g b-sm" disabled={busy} onClick={() => window.confirm("להסיר את הדייר מהמשרד?") && void call("admin_unlink_tenant", { p_office: o.id, p_user: m.id }, "הדייר הוסר מהמשרד")}>
                    הסרה מהמשרד
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="sect">
            <b>הוספת דייר למשרד</b>
            <div className="form-grid">
              <div className="fld"><label htmlFor="tn-email">אימייל</label><input id="tn-email" className="in" type="email" dir="ltr" autoComplete="off" value={tf.email} onChange={(e) => setTf({ ...tf, email: e.target.value })} /></div>
              <div className="fld"><label htmlFor="tn-name">שם (לחשבון חדש)</label><input id="tn-name" className="in" autoComplete="off" value={tf.name} onChange={(e) => setTf({ ...tf, name: e.target.value })} /></div>
              <div className="fld"><label htmlFor="tn-phone">טלפון (לחשבון חדש)</label><input id="tn-phone" className="in" type="tel" dir="ltr" autoComplete="off" value={tf.phone} onChange={(e) => setTf({ ...tf, phone: e.target.value })} /></div>
              <div className="fld"><label htmlFor="tn-pw">סיסמה זמנית (8+, לחשבון חדש)</label><input id="tn-pw" className="in" type="password" dir="ltr" autoComplete="new-password" value={tf.pw} onChange={(e) => setTf({ ...tf, pw: e.target.value })} /></div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" className="btn b-p" disabled={busy || tBusy} onClick={() => void addTenant()}>הוספה ושיוך</button>
              <span className="muted" style={{ fontSize: 13, flex: 1, minWidth: 240 }}>אם האימייל כבר רשום באתר, החשבון הקיים משויך בלי סיסמה חדשה. כל דיירי המשרד חולקים את שעות החינם החודשיות.</span>
            </div>
          </div>
        </div>
      </details>

      <details className="det">
        <summary>
          <div><b>תמונות</b><span>תמונות המשרד באתר</span></div>
          <span className="tag t-n">{o.images.length}</span>
        </summary>
        <div className="inner">
          <ImageList images={o.images} onChange={(v) => set("images", v)} folder={`offices/${o.id}`} library={library} />
        </div>
      </details>

      <div className="sticky-save">
        <button type="button" className="btn b-p" disabled={busy} onClick={() => void save()}>שמירת המשרד</button>
        <button type="button" className="btn b-g" onClick={() => setO(office)}>ביטול שינויים</button>
      </div>
    </div>
  );
}

export function AvailabilitySwitch({ id, on, label }: { id: string; on: boolean; label: string }) {
  const { call, busy } = useRpc();
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-label="זמינות המשרד" className="switch" disabled={busy} onClick={() => void call("admin_set_office_available", { p_office: id, p_on: !on }, on ? "המשרד הוסתר" : "המשרד זמין")}>
        <i />
      </button>
    </span>
  );
}
