"use client";

import { useState } from "react";
import { errText, tr, type Dict, type Lang } from "@/i18n";
import { emailOk, phoneOk } from "@/lib/format";
import { getUtm, track } from "@/lib/track";

export function ContactForm({ lang, t, source = "home" }: { lang: Lang; t: Dict; source?: string }) {
  const [type, setType] = useState(0);
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
    // The server needs a name and a phone or an email; checking here reports a gap at once.
    if (!f.name.trim()) return setErr(errText("name", lang));
    if (!phoneOk(f.phone) && !emailOk(f.email)) return setErr(errText("contact", lang));
    setBusy(true);
    setErr("");
    const { createClient } = await import("@/lib/supabase/client");
    const { data, error } = await createClient().rpc("add_inquiry", {
      p_kind: "contact",
      p_office: null,
      p_interest: type === 0 ? "office" : "room",
      p_name: f.name,
      p_phone: f.phone,
      p_email: f.email,
      p_msg: f.msg,
      p_source: source,
      p_utm: getUtm(),
    });
    setBusy(false);
    const code = error ? "gen" : (data as { err?: string } | null)?.err;
    if (code) return setErr(errText(code, lang));
    track("generate_lead", { form: source, interest: type === 0 ? "office" : "room" });
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" style={{ animation: "aosUp 0.3s both" }}>
        <b style={{ display: "block", fontSize: 20 }}>{t.sentTitle}</b>
        <p style={{ margin: "6px 0 0", color: "var(--g1)" }}>{t.sentBody}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="con-form">
      <fieldset className="full" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 15, fontWeight: 500, color: "var(--g1)", marginBottom: 8 }}>{t.conType}</legend>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[t.ct1, t.ct2].map((label, i) => (
            <button key={label} type="button" className="chip-btn" aria-pressed={type === i} onClick={() => setType(i)}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="c-name">{t.fName}</label>
        <input id="c-name" className="input" autoComplete="name" enterKeyHint="next" value={f.name} onChange={set("name")} />
      </div>
      <div className="field">
        <label htmlFor="c-phone">{t.fPhone}</label>
        <input id="c-phone" className="input ltr-in" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" dir="ltr" value={f.phone} onChange={set("phone")} />
      </div>
      <div className="field full">
        <label htmlFor="c-email">{t.fEmail}</label>
        <input id="c-email" className="input ltr-in" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} dir="ltr" value={f.email} onChange={set("email")} />
      </div>
      <div className="field full">
        <label htmlFor="c-msg">{t.fMsgOpt}</label>
        <textarea id="c-msg" className="input" rows={3} placeholder={tr(lang, "למשל: כמה אנשים, ממתי", "E.g. team size, move-in date")} value={f.msg} onChange={set("msg")} />
      </div>
      {err && (
        <div role="alert" className="alert full">
          {err}
        </div>
      )}
      <div className="full">
        <button type="submit" disabled={busy} className="btn btn-dark" style={{ height: 52, padding: "0 26px" }}>
          {busy ? t.busyL : t.send}
        </button>
      </div>
    </form>
  );
}
