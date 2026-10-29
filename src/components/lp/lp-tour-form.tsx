"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errText, type Lang } from "@/i18n";
import { emailOk, phoneOk } from "@/lib/format";
import type { OfficesCopy } from "@/lib/lp-copy";
import { getUtm, track } from "@/lib/track";

type Opt = { id: string; label: string; he: string; code: string };
const WHEN = ["morning", "noon", "after"] as const;
const WHEN_HE: Record<(typeof WHEN)[number], string> = { morning: "בוקר", noon: "צהריים", after: "אחר הצהריים" };
const EMPTY = { name: "", phone: "", email: "", office: "", msg: "", when: "" as "" | (typeof WHEN)[number] };

/** Tour request for the offices page. It becomes an inquiry (interest "tour", source "lp-office") in the back office. */
export function LpTourForm({ lang, c, offices, initialOffice }: { lang: Lang; c: OfficesCopy; offices: Opt[]; initialOffice: string }) {
  const [f, setF] = useState({ ...EMPTY, office: offices.some((o) => o.id === initialOffice) ? initialOffice : "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: "name" | "phone" | "email" | "msg" | "office") => (e: { target: { value: string } }) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    setErr("");
  };

  // The "tour this office" buttons in the cards pick the office here and scroll to the form.
  useEffect(() => {
    const pick = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setF((s) => ({ ...s, office: offices.some((o) => o.id === id) ? id : "" }));
      setSent(false);
      setErr("");
      setTimeout(() => (document.getElementById("t-n") as HTMLInputElement | null)?.focus({ preventScroll: true }), 500);
    };
    window.addEventListener("lp:pick-office", pick);
    return () => window.removeEventListener("lp:pick-office", pick);
  }, [offices]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!f.name.trim()) return setErr(errText("name", lang));
    if (!phoneOk(f.phone)) return setErr(errText("phone", lang));
    if (f.email.trim() && !emailOk(f.email)) return setErr(errText("email", lang));
    const o = offices.find((x) => x.id === f.office);
    // The back office reads these messages, so they stay in Hebrew whatever language the visitor used.
    const msg = ["בקשת סיור במשרדים" + (o ? ` · ${o.he} (${o.code})` : ""), f.when ? `זמן מועדף: ${WHEN_HE[f.when]}` : "", f.msg.trim()].filter(Boolean).join("\n");
    setBusy(true);
    const { createClient } = await import("@/lib/supabase/client");
    const { data, error } = await createClient().rpc("add_inquiry", {
      p_kind: o ? "office" : "contact",
      p_office: o ? o.id : null,
      p_interest: "tour",
      p_name: f.name,
      p_phone: f.phone,
      p_email: f.email,
      p_msg: msg,
      p_source: "lp-office",
      p_utm: getUtm(),
    });
    setBusy(false);
    const code = error ? "gen" : (data as { err?: string } | null)?.err;
    if (code) return setErr(errText(code, lang));
    track("generate_lead", { lp: "offices", office: o ? o.code : "any" });
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="lp-done">
        <span className="ok" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h3>{c.sentT}</h3>
        <p>{c.sentP}</p>
        <button type="button" className="lp-linkbtn" onClick={() => setSent(false)}>
          {c.again}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="lp-form">
      <h3>{c.formT}</h3>
      <div className="lp-fld">
        <label htmlFor="t-n">{c.fName}</label>
        <input id="t-n" className="lp-in" autoComplete="name" value={f.name} onChange={set("name")} />
      </div>
      <div className="lp-fld2">
        <div className="lp-fld">
          <label htmlFor="t-p">{c.fPhone}</label>
          <input id="t-p" className="lp-in ltr" type="tel" dir="ltr" autoComplete="tel" value={f.phone} onChange={set("phone")} />
        </div>
        <div className="lp-fld">
          <label htmlFor="t-e">{c.fEmail}</label>
          <input id="t-e" className="lp-in ltr" type="email" dir="ltr" autoComplete="email" value={f.email} onChange={set("email")} />
        </div>
      </div>
      <div className="lp-fld">
        <label htmlFor="t-o">{c.fOffice}</label>
        <select id="t-o" className="lp-in" value={f.office} onChange={set("office")}>
          <option value="">{c.anyOffice}</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="lp-chipset">
        <legend>{c.fWhen}</legend>
        {WHEN.map((w) => (
          <button key={w} type="button" className="lp-chip" aria-pressed={f.when === w} onClick={() => setF((s) => ({ ...s, when: s.when === w ? "" : w }))}>
            {c[w]}
          </button>
        ))}
      </fieldset>
      <div className="lp-fld">
        <label htmlFor="t-m">{c.fMsg}</label>
        <textarea id="t-m" className="lp-in" rows={3} value={f.msg} onChange={set("msg")} />
      </div>
      {err && (
        <p role="alert" className="lp-err">
          {err}
        </p>
      )}
      <button type="submit" className="lp-submit" disabled={busy}>
        {c.submit}
      </button>
      <p className="lp-note">
        {c.privNote} <Link href={`/${lang}/privacy`}>{c.privacy}</Link>
      </p>
    </form>
  );
}
