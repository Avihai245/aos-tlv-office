import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { HeroVideo } from "@/components/hero-client";
import { LpFooter, LpHeader, otherLangHref } from "@/components/lp/lp-chrome";
import { LpStickyBar } from "@/components/lp/lp-sticky-bar";
import { LpTourForm } from "@/components/lp/lp-tour-form";
import { LpTracker } from "@/components/lp/lp-tracker";
import { TourButton } from "@/components/lp/tour-button";
import { isLang } from "@/i18n";
import { contactLinks, mapQuery, siteText } from "@/lib/contact";
import { getSite } from "@/lib/data";
import { imgSrc, money } from "@/lib/format";
import { officesCopy } from "@/lib/lp-copy";
import { officeOpen } from "@/lib/office-view";
import { pageMeta } from "@/lib/seo";

const HERO_AVIF = "/uploads/hero-640.avif 640w, /uploads/hero-1080.avif 1080w, /uploads/hero-1800.avif 1800w";
const HERO_WEBP = "/uploads/hero-640.webp 640w, /uploads/hero-1080.webp 1080w, /uploads/hero-1800.webp 1800w";
const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO || "/uploads/hero.mp4";

export async function generateMetadata({ params }: PageProps<"/[lang]/lp/offices">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const he = lang === "he";
  return pageMeta({
    lang,
    path: "/lp/offices",
    title: he ? "משרד פרטי להשכרה בתל אביב" : "Private office for rent in Tel Aviv",
    description: he
      ? "משרדים פרטיים מרוהטים להשכרה בדרך מנחם בגין 150, תל אביב. מטבחון משותף, חדר ישיבות במתחם ותיאום סיור מהיר."
      : "Furnished private offices for rent at 150 Menachem Begin Road, Tel Aviv. Shared kitchenette, a meeting room on site and a quick tour booking.",
    image: `/uploads/og-home-${lang}.jpg`,
    noindex: true,
  });
}

export default async function OfficesLanding({ params, searchParams }: PageProps<"/[lang]/lp/offices">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const he = lang === "he";
  const c = officesCopy(lang);
  const arrow = he ? "←" : "→";
  const { offices, rooms, settings } = await getSite();
  const room = rooms[0];
  const s = siteText(settings.content, lang);
  const open = offices.filter(officeOpen);
  const priced = open.filter((o) => (o.price ?? 0) > 0).map((o) => o.price as number);
  const from = priced.length ? Math.min(...priced) : 0;
  const initial = typeof sp.office === "string" ? sp.office : "";
  const wa = contactLinks(settings.content).find((l) => l.label === "WhatsApp");
  const q = mapQuery(settings.content.addressHe || s.address);
  const discount = Math.round(settings.memberDiscount * 100);
  const name = (o: (typeof offices)[number]) => (he ? o.nameHe : o.nameEn) || o.code;

  preload("/uploads/hero-1080.avif", { as: "image", type: "image/avif", imageSrcSet: HERO_AVIF, imageSizes: "100vw", fetchPriority: "high" });

  const facts = [
    { v: String(open.length), k: c.freeK },
    ...(from ? [{ v: money(from), k: c.fromK }] : []),
    { v: room ? `${c.upTo} ${room.capacity}` : "—", k: c.roomK },
  ];
  const memLine = he
    ? `מנוי חדר ישיבות ב־${money(settings.memberPrice)} + מע״מ לחודש: ${discount}% הנחה על כל שריון והזמנה גם לאותו היום.`
    : `A meeting-room membership for ${money(settings.memberPrice)} + VAT a month: ${discount}% off every booking and same-day booking.`;

  return (
    <>
      <LpTracker lp="offices" />
      <LpHeader lang={lang} c={c} ctaHref="#tour" langHref={otherLangHref(lang, "offices", sp)} />
      <main id="main">
        <section id="lp-hero" aria-labelledby="lp-h1" className="lp-hero tall">
          <div aria-hidden="true" className="lp-hero-bg">
            <picture>
              <source type="image/avif" srcSet={HERO_AVIF} sizes="100vw" />
              <img className="lp-photo" src="/uploads/hero-1080.webp" srcSet={HERO_WEBP} sizes="100vw" alt="" fetchPriority="high" decoding="async" width={1800} height={2400} />
            </picture>
            <HeroVideo src={HERO_VIDEO === "vimeo" ? undefined : HERO_VIDEO} />
          </div>
          <div aria-hidden="true" className="lp-shade" />
          <div className="lp-hero-in">
            <p className="lp-kicker">
              <i aria-hidden="true" />
              {c.kicker}
            </p>
            <h1 id="lp-h1">{c.h1}</h1>
            <p className="lp-sub">{c.sub}</p>
            <div className="lp-cta-row">
              <a href="#tour" className="lp-btn" data-cta="hero">
                {c.ctaHero}
                <span aria-hidden="true">{arrow}</span>
              </a>
              <dl className="lp-facts">
                {facts.map((f) => (
                  <div key={f.k}>
                    <dt>{f.v}</dt>
                    <dd>{f.k}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section id="offices" aria-labelledby="of-h" className="lp-sec light">
          <div className="lp-wrap lp-stack">
            <div className="lp-head">
              <div style={{ maxWidth: 720 }}>
                <p className="lp-eyebrow">
                  <i aria-hidden="true" />
                  {c.ofK}
                </p>
                <h2 id="of-h">{open.length ? (he ? `${open.length} משרדים פנויים לכניסה` : `${open.length} offices open`) : he ? "המשרדים במתחם" : "Our offices"}</h2>
              </div>
              <p className="lp-lead">{c.ofSub}</p>
            </div>
            {open.length === 0 && (
              <div className="lp-none">
                <b>{c.noneT}</b>
                <p>{c.noneP}</p>
                <a href="#tour" className="lp-dark-btn" style={{ padding: "0 20px", marginTop: 0 }} data-cta="none_free">
                  {c.noneCta}
                </a>
              </div>
            )}
            <ul className="lp-offices">
              {open.map((o, i) => {
                const img = o.images[0];
                const amen = (he ? o.amenitiesHe : o.amenitiesEn).slice(0, 4);
                const hasPrice = (o.price ?? 0) > 0;
                return (
                  <li key={o.id} className="lp-off">
                    <div className="lp-off-ph">
                      {img ? (
                        <Image src={imgSrc(img.src)} alt={(he ? img.he : img.en) || name(o)} fill priority={i < 2} sizes="(min-width: 1024px) 25vw, 100vw" style={{ objectFit: "cover" }} />
                      ) : (
                        <span className="soon">{c.photoSoon}</span>
                      )}
                      <span className="lp-tag code">{o.code}</span>
                      <span className="lp-tag ok">{c.freeTag}</span>
                    </div>
                    <div className="lp-off-body">
                      <div className="lp-off-top">
                        <b>{name(o)}</b>
                        <span>{hasPrice ? `${money(o.price)} ${c.perMonth}` : c.priceReq}</span>
                      </div>
                      {(he ? o.descHe : o.descEn) && <p>{he ? o.descHe : o.descEn}</p>}
                      <span className="lp-off-sub">{hasPrice ? c.rentSub : c.quoteAfter}</span>
                      <ul className="lp-chips">
                        {amen.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                      <TourButton officeId={o.id} code={o.code} label={c.tourThis} arrow={arrow} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cx-h" className="lp-sec dark">
          <div className="lp-wrap lp-stack">
            <h2 id="cx-h" style={{ maxWidth: 760 }}>
              {c.cxT}
            </h2>
            <div className="lp-figs">
              {[
                { src: "/uploads/aos-meeting-zoom.webp", alt: c.altRoom, t: c.cx1T, p: c.cx1P, pos: "center" },
                { src: "/uploads/assets-1792344398893-10qe.jpg", alt: c.altKit, t: c.cx2T, p: c.cx2P, pos: "center 40%" },
                { src: "/uploads/assets-1792344398884-f06p.png", alt: c.altDoor, t: c.cx3T, p: c.cx3P, pos: "center" },
              ].map((f) => (
                <figure key={f.src} className="lp-fig">
                  <Image src={f.src} alt={f.alt} fill sizes="(min-width: 1024px) 33vw, 100vw" style={{ objectPosition: f.pos }} />
                  <figcaption>
                    <b>{f.t}</b>
                    <span>{f.p}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="lp-strip">
              <span>
                <b>{c.memK}</b> {memLine}
              </span>
              <Link href={`/${lang}/lp/meeting-room`} className="lp-ghost" data-cta="to_room_lp">
                {c.memCta}
                <span aria-hidden="true">{arrow}</span>
              </Link>
            </div>
          </div>
        </section>

        <section id="tour" aria-labelledby="tour-h" className="lp-sec ink">
          <div className="lp-wrap lp-two">
            <div className="lp-col">
              <p className="lp-kicker">
                <i aria-hidden="true" />
                {c.tourK}
              </p>
              <h2 id="tour-h">{c.tourT}</h2>
              <p>{c.tourP}</p>
              <dl className="lp-dl">
                <div>
                  <dt>{c.addrL}</dt>
                  <dd>{s.address}</dd>
                </div>
                <div>
                  <dt>{c.hoursL}</dt>
                  <dd>{[s.hoursA, s.hoursB].filter(Boolean).join(" · ")}</dd>
                </div>
              </dl>
              <div className="lp-links">
                <a className="lp-link" href={`https://waze.com/ul?q=${q}&navigate=yes`} target="_blank" rel="noopener">
                  Waze
                </a>
                <a className="lp-link" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener">
                  Google Maps
                </a>
                {wa && (
                  <a className="lp-link wa" href={wa.href} target="_blank" rel="noopener" data-cta="whatsapp">
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
            <div className="lp-card">
              <LpTourForm
                key={initial}
                lang={lang}
                c={c}
                initialOffice={initial}
                offices={open.map((o) => ({ id: o.id, he: o.nameHe || o.code, code: o.code, label: `${name(o)} · ${o.code}${(o.price ?? 0) > 0 ? ` · ${money(o.price)}` : ""}` }))}
              />
            </div>
          </div>
        </section>
      </main>
      <LpFooter lang={lang} c={c} />
      <LpStickyBar watch={["lp-hero", "tour"]} href="#tour" title={open.length ? (he ? `${open.length} משרדים פנויים` : `${open.length} offices open`) : c.ctaTop} cta={c.ctaTop} />
    </>
  );
}
