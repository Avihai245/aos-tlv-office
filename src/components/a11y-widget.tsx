"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Dict, Lang } from "@/i18n";

type A11y = { z: number; contrast?: boolean; gray?: boolean; links?: boolean; font?: boolean; motion?: boolean; focus?: boolean };
const KEYS = ["contrast", "gray", "links", "font", "motion", "focus"] as const;
const IC: Record<(typeof KEYS)[number], string> = {
  contrast: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 2v20",
  gray: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 3c-3 4-3 14 0 18",
  links: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  font: "M4 7V4h16v3M9 20h6M12 4v16",
  motion: "M10 4v16M14 4v16M5 12h14",
  focus: "M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
};
const LABEL = { contrast: "aContrast", gray: "aGray", links: "aLinks", font: "aFont", motion: "aMotion", focus: "aFocus" } as const;
const SCALE = [1, 1.12, 1.25, 1.4];
const STORE = "aos_a11y";

function read(): A11y {
  if (typeof window === "undefined") return { z: 0 };
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || "null");
    if (v && typeof v === "object") return v;
  } catch {
    /* storage unavailable: defaults apply */
  }
  return { z: 0 };
}

function apply(a: A11y) {
  const h = document.documentElement;
  if (a.z > 0) h.setAttribute("data-a11y-zoom", String(a.z));
  else h.removeAttribute("data-a11y-zoom");
  KEYS.forEach((k) => (a[k] ? h.setAttribute("data-a11y-" + k, "") : h.removeAttribute("data-a11y-" + k)));
}

export function A11yWidget({ lang, t }: { lang: Lang; t: Dict }) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<A11y>(read);
  const fab = useRef<HTMLButtonElement>(null);

  // Re-apply the saved settings to <html> after hydration.
  useEffect(() => apply(a), []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (p: Partial<A11y>) => {
    const next = { ...a, ...p };
    setA(next);
    apply(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const close = () => {
    setOpen(false);
    fab.current?.focus();
  };

  return (
    <>
      <button ref={fab} type="button" className="a11y-fab" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="a11y-panel" aria-label={t.a11yOpen} title={t.a11yOpen}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
          <circle cx="12" cy="4.2" r="1.7" fill="currentColor" />
          <path d="M5 8.2l7 1.3 7-1.3M12 9.5v4.5M12 14l-3.2 6M12 14l3.2 6" />
        </svg>
      </button>
      {open && (
        <div id="a11y-panel" role="dialog" aria-modal="false" aria-labelledby="a11y-h" className="a11y-panel" onKeyDown={(e) => e.key === "Escape" && close()}>
          <div className="a11y-head">
            <h2 id="a11y-h">{t.a11yTitle}</h2>
            <button type="button" className="sq-btn" onClick={close} aria-label={t.close}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "round" }} aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="a11y-body">
            <div className="a11y-size">
              <b>{t.a11yText}</b>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button" onClick={() => update({ z: Math.max(0, a.z - 1) })} aria-label={t.a11yMinus} style={{ fontSize: 16 }}>
                  A−
                </button>
                <span aria-live="polite" style={{ minWidth: 48, textAlign: "center", fontSize: 15, fontWeight: 600, direction: "ltr" }}>
                  {Math.round(SCALE[a.z || 0] * 100)}%
                </span>
                <button type="button" onClick={() => update({ z: Math.min(3, a.z + 1) })} aria-label={t.a11yPlus} style={{ fontSize: 18 }}>
                  A+
                </button>
              </div>
            </div>
            <div className="a11y-grid">
              {KEYS.map((k) => (
                <button key={k} type="button" aria-pressed={!!a[k]} onClick={() => update({ [k]: !a[k] })}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
                    <path d={IC[k]} />
                  </svg>
                  {t[LABEL[k]]}
                </button>
              ))}
            </div>
            <div className="a11y-foot">
              <button type="button" onClick={() => update({ z: 0, contrast: false, gray: false, links: false, font: false, motion: false, focus: false })}>
                {t.a11yReset}
              </button>
              <Link href={`/${lang}/accessibility`} onClick={() => setOpen(false)}>
                {t.a11yStmt}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
