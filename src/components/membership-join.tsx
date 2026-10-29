"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errText, tr, type Dict, type Lang } from "@/i18n";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import { SignOutButton } from "./booking-actions";

export function MembershipJoin({ lang, t, total }: { lang: Lang; t: Dict; total: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function join() {
    setBusy(true);
    setErr("");
    const { data, error } = await createClient().rpc("request_membership");
    setBusy(false);
    const code = error ? "gen" : (data as { err?: string } | null)?.err;
    if (code) return setErr(errText(code, lang));
    track("membership_request", { currency: "ILS" });
    router.refresh();
  }

  return (
    <>
      {err && (
        <div role="alert" className="alert">
          {err}
        </div>
      )}
      <button type="button" onClick={join} disabled={busy} className="btn btn-gold" style={{ height: 58, fontSize: 17, borderRadius: 14, gap: 0 }}>
        {busy ? (
          t.busyL
        ) : (
          <>
            {t.memJoinL} · <span style={{ direction: "ltr", display: "inline-block", marginInlineStart: 6 }}>{total}</span>
          </>
        )}
      </button>
      {/* True while payment is offline: the request charges nothing. Remove once online payment goes live. */}
      <p style={{ margin: 0, fontSize: 14, color: "var(--g2)" }}>{tr(lang, "לא מתבצע חיוב כעת.", "You won't be charged now.")}</p>
      <SignOutButton lang={lang} label={t.notYou} className="link-btn" />
    </>
  );
}
