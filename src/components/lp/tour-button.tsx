"use client";

import { track } from "@/lib/track";

/** "Tour this office": picks the office in the tour form and scrolls to it. */
export function TourButton({ officeId, code, label, arrow }: { officeId: string; code: string; label: string; arrow: string }) {
  return (
    <button
      type="button"
      className="lp-dark-btn"
      data-cta="office_tour"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("lp:pick-office", { detail: officeId }));
        document.getElementById("tour")?.scrollIntoView({ behavior: "smooth", block: "start" });
        track("lp_office_select", { lp: "offices", office: code });
      }}
    >
      {label}
      <span aria-hidden="true">{arrow}</span>
    </button>
  );
}
