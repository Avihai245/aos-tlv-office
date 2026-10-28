"use client";

import Link from "next/link";
import { useState } from "react";
import { errText, type Dict, type Lang } from "@/i18n";
import { x } from "@/i18n/extra";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm({ lang, t }: { lang: Lang; t: Dict }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr(errText("weak", lang));
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(errText(error.code === "weak_password" ? "weak" : "gen", lang));
    setDone(true);
  }

  if (done) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
        <div role="status" className="ok-note">
          {x("resetDone", lang)}
        </div>
        <Link href={`/${lang}/account`} className="btn btn-dark" style={{ height: 52, padding: "0 24px", borderRadius: 12 }}>
          {tr(lang)}
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
      <div className="field">
        <label htmlFor="np">{x("newPw", lang)}</label>
        <input id="np" type="password" className="input ltr-in" dir="ltr" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} />
        <span style={{ display: "block", fontSize: 14, color: "var(--g2)", marginTop: 6 }}>{t.pwHint}</span>
      </div>
      {err && (
        <div role="alert" className="alert">
          {err}
        </div>
      )}
      <button type="submit" disabled={busy} className="btn btn-dark" style={{ height: 54, fontSize: 16 }}>
        {busy ? t.busyL : x("resetSave", lang)}
      </button>
    </form>
  );
}

const tr = (lang: Lang) => (lang === "he" ? "לאזור שלי" : "My area");
