"use client";

import { useEffect, useState } from "react";

/** A bar with the main action that follows the visitor once the hero and the form have scrolled out of view. */
export function LpStickyBar({ watch, href, title, sub, bold, cta }: { watch: string[]; href: string; title: string; sub?: string; bold?: boolean; cta: string }) {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const key = watch.join("|");

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const ids = key.split("|");
    const io = new IntersectionObserver(
      (entries) => setVisible((v) => ({ ...v, ...Object.fromEntries(entries.map((e) => [e.target.id, e.isIntersecting])) })),
      { threshold: 0.1 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [key]);

  // Only after every watched block has reported at least once, and none of them is on screen.
  const known = watch.every((id) => id in visible);
  if (!known || watch.some((id) => visible[id])) return null;
  return (
    <div className="lp-bar">
      <span>
        {bold ? <b>{title}</b> : <span className="t">{title}</span>}
        {sub && <small>{sub}</small>}
      </span>
      <a href={href} data-cta="sticky">
        {cta}
      </a>
    </div>
  );
}
