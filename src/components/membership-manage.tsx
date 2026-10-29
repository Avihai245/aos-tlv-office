"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errText, tr, type Lang } from "@/i18n";
import { createClient } from "@/lib/supabase/client";

/**
 * Cancel or resume a membership from the membership page. A request that is still waiting for payment is cancelled at once; an active
 * membership is not renewed and keeps its benefits until the end of the paid period, and can be resumed before then.
 */
export function MembershipManage({ lang, mode }: { lang: Lang; mode: "cancel-request" | "cancel" | "resume" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    if (mode !== "resume") {
      const ask = mode === "cancel-request" ? tr(lang, "לבטל את בקשת המנוי?", "Cancel the membership request?") : tr(lang, "לבטל את המנוי? ההטבות נשארות עד סוף התקופה ששולמה.", "Cancel the membership? Benefits stay until the end of the paid period.");
      if (!window.confirm(ask)) return;
    }
    setBusy(true);
    setErr("");
    const { data, error } = await createClient().rpc(mode === "resume" ? "resume_membership" : "cancel_membership");
    setBusy(false);
    const code = error ? "gen" : (data as { err?: string } | null)?.err;
    if (code) return setErr(errText(code, lang));
    router.refresh();
  }

  const label = mode === "resume" ? tr(lang, "חידוש המנוי", "Resume membership") : mode === "cancel-request" ? tr(lang, "ביטול הבקשה", "Cancel request") : tr(lang, "ביטול מנוי", "Cancel membership");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <button type="button" className={mode === "resume" ? "btn btn-dark" : "btn btn-out"} style={{ height: 48, padding: "0 20px", borderRadius: 12 }} disabled={busy} onClick={run}>
        {label}
      </button>
      {err && (
        <p role="alert" className="alert" style={{ margin: 0 }}>
          {err}
        </p>
      )}
    </div>
  );
}
