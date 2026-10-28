"use client";

import Image from "next/image";
import { useState } from "react";

export function OfficeGallery({ items }: { items: { src: string; alt: string }[] }) {
  const [i, setI] = useState(0);
  const cur = items[Math.min(i, items.length - 1)];
  return (
    <>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 16, overflow: "hidden", background: "#f1f1f0" }}>
        <Image src={cur.src} alt={cur.alt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" style={{ objectFit: "cover" }} />
      </div>
      {items.length > 1 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {items.map((g, n) => (
            <button key={g.src} type="button" onClick={() => setI(n)} aria-label={g.alt} aria-pressed={n === i} style={{ position: "relative", flex: "none", width: 104, height: 70, padding: 0, overflow: "hidden", border: `2px solid ${n === i ? "var(--ink)" : "transparent"}`, borderRadius: 10, background: "none", cursor: "pointer" }}>
              <Image src={g.src} alt="" fill sizes="104px" style={{ objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
