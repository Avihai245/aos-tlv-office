"use client";

import Link from "next/link";
import { useState } from "react";
import { errText, tr, type Dict, type Lang } from "@/i18n";
import { emailOk, phoneOk } from "@/lib/format";
import { getUtm, track } from "@/lib/track";

export function OfficeInquiry({ lang, t, officeId }: { lang: Lang; t: Dict; officeId: string }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", msg: "" });
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setErr("");
    setF((s) => ({ ...s, [k]: e.target.value }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    // Checked here first so a missing field is reported at once, without a round trip.
    if (!f.name.trim()) return setErr(errText("name", lang));
    if (!phoneOk(f.phone)) return setErr(errText("phone", lang));
    if (f.email.trim() && !emailOk(f.email)) return setErr(errText("email", lang));
    setBusy(true);
    setErr("");
    const { createClient } = await import("@/lib/supabase/client");
    const { data, error } = await createClient().rpc("add_inquiry", {
      p_kind: "office",
      p_office: officeId,
      p_interest: "office",
      p_name: f.name,
      p_phone: f.phone,
      p_email: f.email,
      p_msg: f.msg,
      p_source: "office",
      p_utm: getUtm(),
    });
    setBusy(false);
    const code = error ? "gen" : (data as { err?: string } | null)?.err;
    if (code) return setErr(errText(code, lang));
    track("generate_lead", { form: "office", office_id: officeId });
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" tabIndex={-1} ref={(el) => el?.focus()} style={{ outline: "none" }}>
        <b style={{ display: "block", fontSize: 20 }}>{t.sentTitle}</b>
        <p style={{ margin: "6px 0 16px", color: "var(--g1)" }}>{t.inqSent}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={`/${lang}/offices`} className="btn btn-out" style={{ height: 48, padding: "0 20px", borderRadius: 12 }}>
            {tr(lang, "לכל המשרדים", "All offices")}
          </Link>
          <Link href={`/${lang}/rooms`} className="btn btn-out" style={{ height: 48, padding: "0 20px", borderRadius: 12 }}>
            {tr(lang, "בינתיים: הזמנת חדר ישיבות", "Meanwhile: book the meeting room")}
          </Link>
        </div>
      </div>
    );
  }
  return (
    <>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{t.inqTitle}</h2>
      <p style={{ margin: "6px 0 18px", fontSize: 16, color: "var(--g1)" }}>{t.inqSub}</p>
      <form onSubmit={submit} noValidate className="auth-form">
        <div className="field">
          <label htmlFor="q-name">{t.fName}</label>
          <input id="q-name" className="input" autoComplete="name" enterKeyHint="next" required value={f.name} onChange={set("name")} />
        </div>
        <div className="field">
          <label htmlFor="q-phone">{t.fPhone}</label>
          <input id="q-phone" className="input ltr-in" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" enterKeyHint="next" required value={f.phone} onChange={set("phone")} />
        </div>
        <div className="field full">
          <label htmlFor="q-email">{tr(lang, `${t.fEmail} (לא חובה)`, `${t.fEmail} (optional)`)}</label>
          <input id="q-email" className="input ltr-in" type="email" dir="ltr" autoComplete="email" autoCapitalize="none" spellCheck={false} value={f.email} onChange={set("email")} />
        </div>
        <div className="field full">
          <label htmlFor="q-msg">{t.fMsgOpt}</label>
          <textarea id="q-msg" className="input" rows={3} value={f.msg} onChange={set("msg")} />
        </div>
        {err && (
          <div role="alert" className="alert full">
            {err}
          </div>
        )}
        <div className="full">
          <button type="submit" disabled={busy} className="btn btn-dark" style={{ height: 52, padding: "0 26px" }}>
            {busy ? t.busyL : t.inquire}
          </button>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--g2)" }}>{tr(lang, "ללא התחייבות · נחזור אליכם בשעות הפעילות", "No obligation · we reply during opening hours")}</p>
        </div>
      </form>
    </>
  );
}
