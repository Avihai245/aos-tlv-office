"use client";

import { useState } from "react";
import { errText, type Dict, type Lang } from "@/i18n";
import { createClient } from "@/lib/supabase/client";

export function OfficeInquiry({ lang, t, officeId }: { lang: Lang; t: Dict; officeId: string }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", msg: "" });
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const { data, error } = await createClient().rpc("add_inquiry", {
      p_kind: "office",
      p_office: officeId,
      p_interest: "office",
      p_name: f.name,
      p_phone: f.phone,
      p_email: f.email,
      p_msg: f.msg,
      p_source: "office",
      p_utm: new URLSearchParams(window.location.search).get("utm_source") ?? "",
    });
    setBusy(false);
    const code = error ? "gen" : (data as { err?: string } | null)?.err;
    if (code) return setErr(errText(code, lang));
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status">
        <b style={{ display: "block", fontSize: 20 }}>{t.sentTitle}</b>
        <p style={{ margin: "6px 0 0", color: "var(--g1)" }}>{t.inqSent}</p>
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
          <input id="q-name" className="input" autoComplete="name" value={f.name} onChange={set("name")} />
        </div>
        <div className="field">
          <label htmlFor="q-phone">{t.fPhone}</label>
          <input id="q-phone" className="input ltr-in" type="tel" dir="ltr" autoComplete="tel" value={f.phone} onChange={set("phone")} />
        </div>
        <div className="field full">
          <label htmlFor="q-email">{t.fEmail}</label>
          <input id="q-email" className="input ltr-in" type="email" dir="ltr" autoComplete="email" value={f.email} onChange={set("email")} />
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
            {t.inquire}
          </button>
        </div>
      </form>
    </>
  );
}
