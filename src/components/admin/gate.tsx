"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Sign-in screen for the back office. Accounts are created in the Supabase dashboard, never here. */
export function AdminGate({ email }: { email: string | null }) {
  const router = useRouter();
  const [f, setF] = useState({ email: "", pw: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await createClient().auth.signInWithPassword({ email: f.email.trim().toLowerCase(), password: f.pw });
    setBusy(false);
    if (error) return setErr(error.code === "invalid_credentials" ? "אימייל או סיסמה שגויים" : "הכניסה לא הושלמה. נסו שוב.");
    router.refresh();
  }

  return (
    <div className="gate">
      <div className="box">
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <span style={{ fontFamily: "var(--font-frank), serif", fontSize: 32, letterSpacing: "0.32em", direction: "ltr", lineHeight: 1 }}>AOS</span>
          <span className="adm-chip" style={{ padding: "4px 10px" }}>ADMIN</span>
        </div>
        {email ? (
          <>
            <h1 style={{ marginTop: 8, lineHeight: 1.15 }}>אין הרשאת ניהול</h1>
            <p className="muted" style={{ margin: 0 }}>
              החשבון <span className="ltr">{email}</span> מחובר, אבל אינו חשבון ניהול.
            </p>
            <button
              type="button"
              className="btn b-p"
              style={{ height: 52 }}
              onClick={async () => {
                await createClient().auth.signOut();
                router.refresh();
              }}
            >
              יציאה והתחברות עם חשבון אחר
            </button>
          </>
        ) : (
          <>
            <h1 style={{ marginTop: 8, lineHeight: 1.15 }}>כניסה לניהול</h1>
            <p className="muted" style={{ margin: 0 }}>הכניסה למורשים בלבד.</p>
            <form onSubmit={submit} noValidate className="stack" style={{ gap: 12 }}>
              <div className="fld">
                <label htmlFor="ad-email">אימייל</label>
                <input id="ad-email" className="in" type="email" dir="ltr" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              </div>
              <div className="fld">
                <label htmlFor="ad-pw">סיסמה</label>
                <input id="ad-pw" className="in" type="password" dir="ltr" autoComplete="current-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} />
              </div>
              {err && (
                <div role="alert" className="flash err" style={{ margin: 0 }}>
                  {err}
                </div>
              )}
              <button type="submit" className="btn b-p" disabled={busy} style={{ height: 52, fontSize: 16 }}>
                {busy ? "רגע…" : "כניסה"}
              </button>
            </form>
          </>
        )}
        <Link href="/he" style={{ fontSize: 14 }}>
          ← חזרה לאתר
        </Link>
      </div>
    </div>
  );
}
