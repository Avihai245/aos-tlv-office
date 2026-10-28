"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type OfficeView = {
  id: string;
  idx: string;
  name: string;
  amen: string;
  amenList: string[];
  rent: string;
  feeLine: string;
  vatL: string;
  status: string;
  pill: "available" | "reserved" | "other";
  img: string;
  alt: string;
  href: string;
  cta: string;
};

export function OfficeExplorer({ offices, arrow, photoSoon }: { offices: OfficeView[]; arrow: string; photoSoon: string }) {
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const cur = offices[Math.min(sel, offices.length - 1)];
  const choose = (i: number, hover = false) => {
    if (window.matchMedia("(min-width: 1024px)").matches) setSel(i);
    else if (!hover) router.push(offices[i].href);
  };
  if (!cur) return null;
  return (
    <div className="off-cols">
      <ul className="off-list reveal">
        {offices.map((o, i) => (
          <li key={o.id}>
            <button type="button" className="off-row" aria-pressed={i === sel} onClick={() => choose(i)} onMouseEnter={() => i !== sel && choose(i, true)} onFocus={() => i !== sel && choose(i, true)}>
              <b className="num">{o.idx}</b>
              <span className="nm">
                <span>{o.name}</span>
                <span>{o.amen}</span>
              </span>
              <span className="rt">
                <b>{o.rent}</b>
                <span className={`pill ${o.pill}`}>{o.status}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <article aria-live="polite" className="off-card only-desk reveal">
        <div className="ph">
          {cur.img ? (
            <Image src={cur.img} alt={cur.alt} fill sizes="(min-width: 1024px) 45vw, 100vw" />
          ) : (
            <div className="none">
              <b>{cur.idx}</b>
              <span style={{ fontSize: 15 }}>{photoSoon}</span>
            </div>
          )}
          <span className={`pill ${cur.pill}`}>{cur.status}</span>
        </div>
        <div className="body">
          <h3 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{cur.name}</h3>
          <ul className="chips">
            {cur.amenList.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <div className="off-foot">
            <div>
              <b style={{ display: "block", fontSize: 28, fontWeight: 700, lineHeight: 1.15 }}>{cur.rent}</b>
              <span style={{ display: "block", fontSize: 15, color: "var(--g2)" }}>
                {cur.feeLine} {cur.vatL}
              </span>
            </div>
            <Link href={cur.href} className="btn btn-dark" style={{ height: 52, gap: 10, borderRadius: 14 }}>
              {cur.cta}
              <span aria-hidden="true">{arrow}</span>
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
