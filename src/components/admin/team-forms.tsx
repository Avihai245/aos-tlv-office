"use client";

import { useState } from "react";
import { createAccount, findAccount } from "@/app/admin/actions";
import { Notice, adminErr, useRpc } from "./use-rpc";

export function AddAdmin() {
  const { call, busy, err, msg, setErr, setMsg } = useRpc();
  const [f, setF] = useState({ email: "", name: "", pw: "", pw2: "" });
  const [wait, setWait] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setWait(true);
    const found = await findAccount(f.email);
    let id = found.id;
    if (found.err && found.err !== "nf") {
      setWait(false);
      return setErr(adminErr(found.err));
    }
    if (found.role === "admin") {
      setWait(false);
      return setErr("המשתמש כבר מנהל");
    }
    if (!id) {
      if (f.pw !== f.pw2) {
        setWait(false);
        return setErr("הסיסמאות אינן זהות");
      }
      const res = await createAccount({ email: f.email, name: f.name, phone: "", password: f.pw, minPassword: 10 });
      if (res.err || !res.userId) {
        setWait(false);
        return setErr(res.err === "weak" ? "הסיסמה הזמנית חייבת להיות באורך 10 תווים לפחות" : adminErr(res.err ?? "gen"));
      }
      id = res.userId;
    }
    setWait(false);
    const ok = await call("admin_set_role", { p_user: id, p_role: "admin" }, "המנהל נוסף");
    if (ok) setF({ email: "", name: "", pw: "", pw2: "" });
  }

  return (
    <form onSubmit={submit} noValidate className="card stack">
      <h2 style={{ fontSize: 19 }}>הוספת מנהל</h2>
      <Notice err={err} msg={msg} />
      <div className="fld"><label htmlFor="tm-email">אימייל</label><input id="tm-email" className="in" type="email" dir="ltr" autoComplete="off" value={f.email} onChange={set("email")} /></div>
      <div className="fld"><label htmlFor="tm-name">שם מלא (לחשבון חדש)</label><input id="tm-name" className="in" autoComplete="off" value={f.name} onChange={set("name")} /></div>
      <div className="fld"><label htmlFor="tm-pw">סיסמה זמנית (10 תווים לפחות, לחשבון חדש)</label><input id="tm-pw" className="in" type="password" dir="ltr" autoComplete="new-password" value={f.pw} onChange={set("pw")} /></div>
      <div className="fld"><label htmlFor="tm-pw2">אימות סיסמה</label><input id="tm-pw2" className="in" type="password" dir="ltr" autoComplete="new-password" value={f.pw2} onChange={set("pw2")} /></div>
      <button type="submit" className="btn b-p" disabled={busy || wait}>הוספת מנהל</button>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>אם האימייל כבר רשום באתר, החשבון הקיים מקבל הרשאת ניהול בלי סיסמה חדשה. מסרו סיסמה זמנית למנהל חדש בערוץ מאובטח.</p>
    </form>
  );
}

export function RemoveAdmin({ id }: { id: string }) {
  const { call, busy } = useRpc();
  return (
    <button type="button" className="btn b-g b-sm" disabled={busy} onClick={() => window.confirm("להסיר את הרשאת הניהול?") && void call("admin_set_role", { p_user: id, p_role: "customer" }, "ההרשאה הוסרה")}>
      הסרה
    </button>
  );
}

export function ChangePassword({ email }: { email: string }) {
  const { supabase, busy, err, msg, setErr, setMsg } = useRpc();
  const [f, setF] = useState({ old: "", nw: "", nw2: "" });
  const [wait, setWait] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (f.nw.length < 10) return setErr("הסיסמה החדשה חייבת להיות באורך 10 תווים לפחות");
    if (f.nw !== f.nw2) return setErr("הסיסמאות אינן זהות");
    setWait(true);
    const check = await supabase.auth.signInWithPassword({ email, password: f.old });
    if (check.error) {
      setWait(false);
      return setErr("הסיסמה הנוכחית שגויה");
    }
    const { error } = await supabase.auth.updateUser({ password: f.nw });
    setWait(false);
    if (error) return setErr("העדכון נכשל. נסו שוב.");
    setMsg("הסיסמה עודכנה");
    setF({ old: "", nw: "", nw2: "" });
  }

  return (
    <form onSubmit={submit} noValidate className="card stack">
      <h2 style={{ fontSize: 19 }}>שינוי הסיסמה שלי</h2>
      <Notice err={err} msg={msg} />
      <div className="fld"><label htmlFor="pw-old">סיסמה נוכחית</label><input id="pw-old" className="in" type="password" dir="ltr" autoComplete="current-password" value={f.old} onChange={set("old")} /></div>
      <div className="fld"><label htmlFor="pw-new">סיסמה חדשה (10 תווים לפחות)</label><input id="pw-new" className="in" type="password" dir="ltr" autoComplete="new-password" value={f.nw} onChange={set("nw")} /></div>
      <div className="fld"><label htmlFor="pw-new2">אימות סיסמה חדשה</label><input id="pw-new2" className="in" type="password" dir="ltr" autoComplete="new-password" value={f.nw2} onChange={set("nw2")} /></div>
      <button type="submit" className="btn b-s" disabled={busy || wait}>עדכון סיסמה</button>
    </form>
  );
}
