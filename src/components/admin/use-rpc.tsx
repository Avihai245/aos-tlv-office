"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ERR: Record<string, string> = {
  auth: "אין הרשאה לפעולה הזו",
  nf: "הפריט לא נמצא",
  status: "הפעולה אינה אפשרית בסטטוס הנוכחי",
  conflict: "הבלוק תפוס או חסום",
  taken: "הבלוק תפוס",
  slot: "הבלוק אינו תקין לשעות הפעילות",
  range: "טווח השעות אינו תקין",
  name: "נא להזין שם",
  email: "כתובת אימייל לא תקינה",
  already: "התשלום כבר נרשם",
  amount: "הסכום אינו תואם",
  self: "אי אפשר לשנות את החשבון שלך",
  role: "תפקיד לא תקין",
  room: "החדר לא נמצא",
  late: "ביטול באתר נסגר סמוך למועד",
  service: "חסר מפתח שירות (SUPABASE_SERVICE_ROLE_KEY) בשרת, לכן אי אפשר ליצור חשבון חדש",
  weak: "הסיסמה קצרה מדי",
  phone: "מספר טלפון לא תקין",
  gen: "הפעולה לא הושלמה. נסו שוב.",
};
export const adminErr = (code: string) => ERR[code] ?? ERR.gen;

/** Calls database functions as the signed-in admin, reports the outcome and refreshes the page data. */
export function useRpc() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function finish(code: string | undefined, ok: string, after?: () => void) {
    setBusy(false);
    if (code) {
      setErr(adminErr(code));
      setMsg("");
      return false;
    }
    setErr("");
    setMsg(ok);
    after?.();
    router.refresh();
    return true;
  }

  /** Runs a database function that answers `{ err }` or a result object. */
  async function call(fn: string, args: Record<string, unknown>, ok = "נשמר", after?: (data: Record<string, unknown>) => void) {
    setBusy(true);
    setErr("");
    const { data, error } = await supabase.rpc(fn, args);
    const res = (data ?? {}) as Record<string, unknown>;
    return finish(error ? "gen" : (res.err as string | undefined), ok, () => after?.(res));
  }

  /** Runs a direct table write that Row Level Security allows for admins. */
  async function run(op: () => PromiseLike<{ error: { message: string } | null }>, ok = "נשמר", after?: () => void) {
    setBusy(true);
    setErr("");
    const { error } = await op();
    return finish(error ? "gen" : undefined, ok, after);
  }

  return { supabase, router, busy, err, msg, setErr, setMsg, call, run };
}

export function Notice({ err, msg }: { err: string; msg: string }) {
  if (!err && !msg) return null;
  return (
    <div role={err ? "alert" : "status"} className={err ? "flash err" : "flash ok"}>
      {err || `✓ ${msg}`}
    </div>
  );
}
