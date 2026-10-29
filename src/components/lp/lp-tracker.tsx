"use client";

import { useEffect } from "react";
import { getUtm, track } from "@/lib/track";

/**
 * Counts the visit (one daily counter per campaign tag, no personal data) and reports clicks on [data-cta] elements to the data layer.
 * The campaign tags in the address are remembered for the rest of the visit so inquiries and bookings can carry them.
 */
export function LpTracker({ lp }: { lp: "room" | "offices" }) {
  useEffect(() => {
    const utm = getUtm();
    track("lp_view", { lp: lp === "room" ? "meeting_room" : "offices" });
    let live = true;
    void import("@/lib/supabase/client").then(async ({ createClient }) => {
      if (live) await createClient().rpc("lp_view", { p_lp: lp, p_utm: utm });
    });
    const click = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-cta]");
      if (el) track("lp_cta_click", { lp: lp === "room" ? "meeting_room" : "offices", cta: el.getAttribute("data-cta") });
    };
    document.addEventListener("click", click);
    return () => {
      live = false;
      document.removeEventListener("click", click);
    };
  }, [lp]);
  return null;
}
