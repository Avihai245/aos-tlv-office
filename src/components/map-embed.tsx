"use client";

import { useState } from "react";

/** Shows the address first and loads Google Maps only when the visitor asks for it, which keeps ~0.5 MB of third-party code off the page. */
export function MapEmbed({ src, title, address, fallback, openLabel }: { src: string; title: string; address: string; fallback: string; openLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center", color: "var(--g1)" }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{address}</span>
        <span style={{ fontSize: 15 }}>{fallback}</span>
        {!open && (
          <button type="button" className="btn btn-dark" style={{ height: 48, borderRadius: 12, fontSize: 15 }} onClick={() => setOpen(true)}>
            {openLabel}
          </button>
        )}
      </div>
      {open && <iframe title={title} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
    </>
  );
}
