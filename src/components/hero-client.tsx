"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type HeroRoom = { price: string; per: string; cap: string; avail: string; dot: string; tax: string };
export type HeroDate = { href: string; dow: string; day: string; sub: string; aria: string };

export function HeroVideo() {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const go = () =>
      setSrc("https://player.vimeo.com/video/1240299050?background=1&autoplay=1&loop=1&muted=1&autopause=0&controls=0&dnt=1&playsinline=1");
    const timer = setTimeout(() => (document.readyState === "complete" ? go() : window.addEventListener("load", go, { once: true })), 400);
    return () => clearTimeout(timer);
  }, []);
  if (!src) return null;
  return <iframe src={src} title="AOS" tabIndex={-1} allow="autoplay; fullscreen; picture-in-picture" />;
}

export function HeroPanel({
  arrow,
  labels,
  bookHref,
  officesHref,
  contactHref,
  room,
  dates,
  offFrom,
  offFromSub,
}: {
  arrow: string;
  labels: { navAria: string; room: string; office: string; navBook: string; offTitle: string; furnished: string; exploreOff: string; tourShort: string };
  bookHref: string;
  officesHref: string;
  contactHref: string;
  room: HeroRoom | null;
  dates: HeroDate[];
  offFrom: string;
  offFromSub: string;
}) {
  const [tab, setTab] = useState<"room" | "office">("room");
  const tabs = [
    ["room", labels.room],
    ["office", labels.office],
  ] as const;
  return (
    <div className="hero-panel">
      <div role="tablist" aria-label={labels.navAria} className="tabs">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "room" && room && (
        <>
          <div className="hp-top">
            <div>
              <span className="hp-price">
                <b>{room.price}</b>
                <span style={{ fontSize: 16, color: "var(--g1)" }}>{room.per}</span>
              </span>
              <span style={{ display: "block", fontSize: 14, color: "var(--g2)" }}>{room.tax}</span>
            </div>
            <div className="hp-side">
              <span>{room.cap}</span>
              <span className="av">
                <i className="dot" style={{ background: room.dot }} />
                {room.avail}
              </span>
            </div>
          </div>
          {dates.length > 0 && (
            <div className="hp-dates">
              {dates.map((d) => (
                <Link key={d.href} href={d.href} aria-label={d.aria}>
                  <span>{d.dow}</span>
                  <b>{d.day}</b>
                  <span>{d.sub}</span>
                </Link>
              ))}
            </div>
          )}
          <Link href={bookHref} className="btn btn-gold" style={{ height: 58 }}>
            {labels.navBook}
            <span aria-hidden="true">{arrow}</span>
          </Link>
        </>
      )}
      {tab === "office" && (
        <>
          <div className="hp-top">
            <div>
              <span style={{ display: "block", fontSize: 15, color: "var(--g2)", fontWeight: 500 }}>{labels.offTitle}</span>
              <b style={{ display: "block", fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{offFrom}</b>
              <span style={{ display: "block", fontSize: 14, color: "var(--g2)" }}>{offFromSub}</span>
            </div>
            <span style={{ fontSize: 15, color: "var(--g1)" }}>{labels.furnished}</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={officesHref} className="btn btn-dark" style={{ flex: "1 1 200px", height: 58, fontSize: 17, borderRadius: 14 }}>
              {labels.exploreOff}
              <span aria-hidden="true">{arrow}</span>
            </Link>
            <Link href={contactHref} className="btn btn-line" style={{ flex: "0 1 auto", height: 58, fontWeight: 600, borderRadius: 14 }}>
              {labels.tourShort}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
