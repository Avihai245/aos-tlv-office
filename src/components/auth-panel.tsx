"use client";

import { useState } from "react";
import { errText, type Dict, type Lang } from "@/i18n";
import { x } from "@/i18n/extra";
import { emailOk, phoneOk } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Mode = "in" | "up" | "forgot";

/** Maps a Supabase Auth error to one of the prototype's user-facing codes. */
function authCode(err: { code?: string; message?: string; status?: number }): string {
  const c = err.code ?? "";
  const m = (err.message ?? "").toLowerCase();
  if (c === "invalid_credentials" || m.includes("invalid login")) return "bad";
  if (c === "user_already_exists" || m.includes("already registered")) return "exists";
  if (c === "weak_password" || m.includes("password")) return "weak";
  if (c === "email_not_confirmed") return "notConfirmed";
  if (c.includes("rate_limit") || err.status === 429) return "locked";
  if (c === "email_address_invalid") return "email";
  return "gen";
}

export function AuthPanel({
  lang,
  t,
  idp,
  next,
  onSuccess,
  start = "in",
  afterEmail,
}: {
  lang: Lang;
  t: Dict;
  /** id prefix so two panels never share input ids */
  idp: string;
  /** where an email link should send the user back to */
  next: string;
  onSuccess: () => void;
  /** the tab shown first: booking flows open on sign-up, since most visitors there have no account yet */
  start?: Mode;
  /** added to the "check your email" note, e.g. that the link brings the visitor back to the chosen slot */
  afterEmail?: string;
}) {
  const [mode, setMode] = useState<Mode>(start);
  const [f, setF] = useState({ name: "", phone: "", email: "", pw: "" });
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    setErr("");
  };
  const text = (code: string) => (code === "notConfirmed" ? x("notConfirmed", lang) : errText(code, lang));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const email = f.email.trim().toLowerCase();
    if (!emailOk(email)) return setErr(text("email"));
    if (mode === "up") {
      if (!f.name.trim()) return setErr(text("name"));
      if (!phoneOk(f.phone)) return setErr(text("phone"));
    }
    if (mode !== "forgot" && f.pw.length < 8 && mode === "up") return setErr(text("weak"));
    if (mode === "in" && !f.pw) return setErr(text("bad"));

    setBusy(true);
    setErr("");
    setNote("");
    const supabase = createClient();
    const back = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    try {
      if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/${lang}/account/password`)}` });
        setNote(x("resetSent", lang));
      } else if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: f.pw });
        if (error) setErr(text(authCode(error)));
        else onSuccess();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: f.pw,
          options: { data: { name: f.name.trim(), phone: f.phone.trim() }, emailRedirectTo: back },
        });
        if (error) setErr(text(authCode(error)));
        else if (data.user && data.user.identities && data.user.identities.length === 0) setErr(text("exists"));
        else if (data.session) onSuccess();
        else setNote(afterEmail ? `${x("checkEmail", lang)} ${afterEmail}` : x("checkEmail", lang));
      }
    } catch {
      setErr(text("gen"));
    } finally {
      setBusy(false);
    }
  }

  const tabs: [Mode, string][] = [
    ["in", t.inTab],
    ["up", t.upTab],
  ];
  const up = mode === "up";
  return (
    <div className="auth-box">
      {mode !== "forgot" && (
        <div role="group" aria-label={t.authTitle} className="seg">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => { setMode(k); setErr(""); setNote(""); }}>
              {label}
            </button>
          ))}
        </div>
      )}
      {mode === "forgot" && <b style={{ fontSize: 18 }}>{x("resetTitle", lang)}</b>}
      {note ? (
        <div role="status" className="ok-note">
          {note}
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="auth-form">
          {up && (
            <>
              <div className="field">
                <label htmlFor={`${idp}-name`}>{t.fName}</label>
                <input id={`${idp}-name`} className="input" autoComplete="name" value={f.name} onChange={set("name")} />
              </div>
              <div className="field">
                <label htmlFor={`${idp}-phone`}>{t.fPhone}</label>
                <input id={`${idp}-phone`} className="input ltr-in" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" value={f.phone} onChange={set("phone")} />
              </div>
            </>
          )}
          <div className="field full">
            <label htmlFor={`${idp}-email`}>{t.fEmail}</label>
            <input id={`${idp}-email`} className="input ltr-in" type="email" dir="ltr" autoComplete="email" value={f.email} onChange={set("email")} />
          </div>
          {mode !== "forgot" && (
            <div className="field full">
              <label htmlFor={`${idp}-pw`}>{t.pw}</label>
              <input id={`${idp}-pw`} className="input ltr-in" type="password" dir="ltr" autoComplete={up ? "new-password" : "current-password"} value={f.pw} onChange={set("pw")} />
              {up && <span style={{ display: "block", fontSize: 14, color: "var(--g2)", marginTop: 6 }}>{t.pwHint}</span>}
            </div>
          )}
          {err && (
            <div role="alert" className="alert full">
              {err}
            </div>
          )}
          <button type="submit" disabled={busy} className="btn btn-dark full" style={{ height: 54, fontSize: 16 }}>
            {busy ? t.busyL : mode === "forgot" ? x("resetSend", lang) : up ? t.doUp : t.doIn}
          </button>
        </form>
      )}
      <div style={{ display: "flex", justifyContent: "center" }}>
        {mode === "forgot" ? (
          <button type="button" className="link-btn" onClick={() => { setMode("in"); setNote(""); setErr(""); }}>
            {x("backToSignIn", lang)}
          </button>
        ) : (
          mode === "in" && (
            <button type="button" className="link-btn" style={{ fontSize: 15 }} onClick={() => { setMode("forgot"); setNote(""); setErr(""); }}>
              {x("forgot", lang)}
            </button>
          )
        )}
      </div>
    </div>
  );
}
