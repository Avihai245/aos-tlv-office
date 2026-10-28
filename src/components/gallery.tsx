"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

export type GalleryItem = { src: string; alt: string; pos?: string; row?: string };

export function Lightbox({
  items,
  index,
  onChange,
  labels,
  rtl,
}: {
  items: GalleryItem[];
  index: number;
  onChange: (i: number) => void;
  labels: { prev: string; next: string; close: string };
  rtl: boolean;
}) {
  const n = items.length;
  const step = useCallback((d: number) => onChange((index + d + n) % n), [index, n, onChange]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChange(-1);
      if (e.key === "ArrowRight") step(rtl ? -1 : 1);
      if (e.key === "ArrowLeft") step(rtl ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onChange, step, rtl]);
  const it = items[index];
  if (!it) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={it.alt} className="lb" onClick={() => onChange(-1)}>
      <button type="button" className="sq-btn lb-x" onClick={() => onChange(-1)} aria-label={labels.close}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "round" }} aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={it.src} alt={it.alt} />
      <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => step(-1)} aria-label={labels.prev}>
          {rtl ? "→" : "←"}
        </button>
        <span style={{ fontSize: 15, minWidth: 180, textAlign: "center" }}>
          {it.alt} · <span style={{ direction: "ltr", display: "inline-block" }}>{index + 1}/{n}</span>
        </span>
        <button type="button" onClick={() => step(1)} aria-label={labels.next}>
          {rtl ? "←" : "→"}
        </button>
      </div>
    </div>
  );
}

/** A set of photos that open in a lightbox. `variant` picks the layout used on the home page. */
export function Gallery({
  items,
  variant,
  labels,
  rtl,
}: {
  items: GalleryItem[];
  variant: "building" | "complex";
  labels: { prev: string; next: string; close: string };
  rtl: boolean;
}) {
  const [open, setOpen] = useState(-1);
  const light = variant === "complex";
  const tiles = (mobile: boolean) =>
    items.map((g, i) => (
      <button
        key={g.src}
        type="button"
        className={light ? "tile light" : "tile"}
        onClick={() => setOpen(i)}
        aria-label={g.alt}
        style={mobile ? undefined : { gridRow: g.row ?? "auto", height: light ? "100%" : undefined }}
      >
        <Image src={g.src} alt="" fill sizes={mobile ? "82vw" : "(min-width: 1024px) 33vw, 100vw"} style={{ objectPosition: g.pos ?? "center" }} />
        <span className="cap">{g.alt}</span>
      </button>
    ));
  return (
    <>
      {light ? (
        <div className="cx-imgs reveal">{tiles(false)}</div>
      ) : (
        <>
          <div className="only-desk">
            <div className="bld-grid reveal">{tiles(false)}</div>
          </div>
          <div className="only-mob">
            <div role="group" className="bld-strip">
              {tiles(true)}
            </div>
          </div>
        </>
      )}
      {open >= 0 && <Lightbox items={items} index={open} onChange={setOpen} labels={labels} rtl={rtl} />}
    </>
  );
}
