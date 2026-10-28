"use client";

import { useState } from "react";

export function Faq({ items, flat }: { items: { q: string; a: string }[]; flat?: boolean }) {
  const [open, setOpen] = useState(-1);
  return (
    <div className={flat ? "faq-flat" : undefined} style={{ display: "flex", flexDirection: "column", gap: flat ? 0 : 8, borderTop: flat ? "1px solid var(--line)" : undefined }}>
      {items.map((x, i) => (
        <div key={x.q} className="faq-item">
          <h3>
            <button type="button" aria-expanded={open === i} aria-controls={`faq-a-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
              <span>{x.q}</span>
              <span aria-hidden="true" className="sign">
                {open === i ? "−" : "+"}
              </span>
            </button>
          </h3>
          <div id={`faq-a-${i}`} className="ans" hidden={open !== i}>
            {x.a}
          </div>
        </div>
      ))}
    </div>
  );
}
