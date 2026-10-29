"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type HeroRoom = { price: string; per: string; cap: string; avail: string; dot: string; tax: string };
export type HeroDate = { href: string; dow: string; day: string; sub: string; aria: string };

const VIMEO = "https://player.vimeo.com/video/1240299050?background=1&autoplay=1&loop=1&muted=1&autopause=0&controls=0&dnt=1&playsinline=1";

/**
 * Background loop behind the hero. It starts only after the page has painted, so it never competes with the hero photo,
 * and stays out of the way when the visitor asked for reduced motion or data saving.
 *
 * With `src` (a self-hosted muted MP4) it uses a plain <video>, which autoplays on every phone. Without it, the Vimeo player is used.
 * Phones may block autoplay (Low Power Mode, data savers); playback is then retried on the first touch or scroll, and the poster
 * photo stays visible until real frames are playing.
 */
export function HeroVideo({ src }: { src?: string }) {
  const [on, setOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  // Wait for the page to finish loading and go idle before adding the video.
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (motion || conn?.saveData) return;
    let cancelled = false;
    const start = () => {
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (idle) idle(() => !cancelled && setOn(true), { timeout: 2500 });
      else setTimeout(() => !cancelled && setOn(true), 1200);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
    };
  }, []);

  // Retry blocked autoplay on the first gesture, and pause while the hero is off screen.
  useEffect(() => {
    if (!on) return;
    const play = () => {
      if (video.current) void video.current.play().catch(() => undefined);
      frame.current?.contentWindow?.postMessage(JSON.stringify({ method: "play" }), "https://player.vimeo.com");
    };
    const pause = () => {
      video.current?.pause();
      frame.current?.contentWindow?.postMessage(JSON.stringify({ method: "pause" }), "https://player.vimeo.com");
    };
    const events = ["touchstart", "pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, play, { once: true, passive: true }));
    const host = (video.current ?? frame.current)?.parentElement;
    const io = host ? new IntersectionObserver(([en]) => (en.isIntersecting ? play() : pause()), { threshold: 0.05 }) : null;
    if (host) io?.observe(host);
    return () => {
      events.forEach((e) => window.removeEventListener(e, play));
      io?.disconnect();
    };
  }, [on]);

  if (!on) return null;
  if (src) {
    return (
      <video
        ref={video}
        className={playing ? "hero-vid on" : "hero-vid"}
        src={src}
        muted
        loop
        autoPlay
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
        onPlaying={() => setPlaying(true)}
      />
    );
  }
  return <iframe ref={frame} src={VIMEO} title="AOS" tabIndex={-1} allow="autoplay; fullscreen; picture-in-picture" />;
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
                <Link key={d.href} href={d.href}>
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
