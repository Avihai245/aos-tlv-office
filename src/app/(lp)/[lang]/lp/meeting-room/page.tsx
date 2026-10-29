import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { LpBooking } from "@/components/lp/lp-booking";
import { LpFooter, LpHeader, otherLangHref } from "@/components/lp/lp-chrome";
import { LpStickyBar } from "@/components/lp/lp-sticky-bar";
import { LpTracker } from "@/components/lp/lp-tracker";
import { getT, isLang } from "@/i18n";
import { mapQuery, siteText } from "@/lib/contact";
import { getSite, getViewer } from "@/lib/data";
import { money, todayKey } from "@/lib/format";
import { ROOM_ICONS, roomCopy } from "@/lib/lp-copy";
import { pageMeta } from "@/lib/seo";
import { availability } from "@/lib/slots-server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/lp/meeting-room">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const he = lang === "he";
  return pageMeta({
    lang,
    path: "/lp/meeting-room",
    title: he ? "חדר ישיבות להשכרה בתל אביב" : "Meeting room for rent in Tel Aviv",
    description: he
      ? "חדר ישיבות מעוצב בדרך מנחם בגין 150, תל אביב. מסך 75 אינץ׳, אינטרנט מהיר, קפה ושתייה קרה. 3 שעות, חצי יום או יום מלא, בשריון ישיר."
      : "A designed meeting room at 150 Menachem Begin Road, Tel Aviv. A 75-inch screen, fast internet, coffee and cold drinks. 3 hours, a half day or a full day, booked online.",
    image: `/uploads/og-room-${lang}.jpg`,
    noindex: true,
  });
}

export default async function MeetingRoomLanding({ params, searchParams }: PageProps<"/[lang]/lp/meeting-room">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const he = lang === "he";
  const t = getT(lang);
  const c = roomCopy(lang);
  const arrow = he ? "←" : "→";
  const [site, viewer] = await Promise.all([getSite(), getViewer()]);
  const { settings, packages } = site;
  const room = site.rooms[0];
  const s = siteText(settings.content, lang);
  const q = mapQuery(settings.content.addressHe || s.address);
  const discount = Math.round(settings.memberDiscount * 100);
  const photo = "/uploads/aos-meeting-zoom.webp";
  const roomAlt = room?.images[0] ? (he ? room.images[0].he : room.images[0].en) : c.bookT;

  preload(photo, { as: "image", fetchPriority: "high" });

  let initialSlots: Awaited<ReturnType<typeof availability>> = [];
  if (room) {
    const supabase = await createClient();
    initialSlots = await availability(supabase, !!viewer, room.id, todayKey(), 14, "p3");
  }

  const sub = c.sub.replace("{cap}", String(room?.capacity ?? 10));
  const facts = [
    { v: room ? money(room.price) : "—", k: c.per3k },
    { v: String(room?.capacity ?? 10), k: c.seatsK },
    { v: c.tvV, k: c.tvK },
  ];
  const priceLine = room
    ? he
      ? `ל־3 שעות · חצי יום ${money(room.priceHalf)} · יום מלא ${money(room.priceDay)}`
      : `3 hours · half day ${money(room.priceHalf)} · full day ${money(room.priceDay)}`
    : "";
  const inc: { ic: string; h: string; p: string }[] = [
    { ic: ROOM_ICONS.tv, h: he ? "מסך 75 אינץ׳" : "75-inch screen", p: he ? "שיחות וידאו ומצגות על מסך שכולם רואים." : "Video calls and presentations on a screen everyone can see." },
    { ic: ROOM_ICONS.users, h: he ? `עד ${room?.capacity ?? 10} משתתפים` : `Up to ${room?.capacity ?? 10} people`, p: he ? "שולחן ועידה גדול וכיסאות מנהלים נוחים." : "A large conference table and comfortable executive chairs." },
    { ic: ROOM_ICONS.wifi, h: he ? "אינטרנט מהיר" : "Fast internet", p: he ? "חיבור יציב לשיחות, לשיתוף מסך ולהעלאת קבצים." : "A stable connection for calls, screen sharing and uploads." },
    { ic: ROOM_ICONS.ac, h: he ? "מיזוג אוויר" : "Air conditioning", p: he ? "טמפרטורה נעימה לאורך כל הפגישה." : "Comfortable all meeting long." },
    { ic: ROOM_ICONS.fridge, h: he ? "מקרר שתייה" : "Drinks fridge", p: he ? "שתייה קרה מחכה לכם ולאורחים." : "Cold drinks ready for you and your guests." },
    { ic: ROOM_ICONS.coffee, h: he ? "קפה ועוגיות" : "Coffee and cookies", p: he ? "קפה טוב וכיבוד קל, בלי לצאת מהחדר." : "Good coffee and light snacks without leaving the room." },
  ];
  const memB = he ? [`${discount}% הנחה על כל שריון`, "הזמנה גם לאותו היום, לפי מקום פנוי", "ביטול בכל עת"] : [`${discount}% off every booking`, "Same-day booking when the room is free", "Cancel any time"];
  const faq = room
    ? [
        {
          q: he ? "מתי ההזמנה מאושרת?" : "When is my booking confirmed?",
          a: he
            ? `אחרי שליחת הבקשה ניצור קשר להשלמת התשלום. ההזמנה מאושרת לאחר אימות התשלום, ועד אז המועד שמור עבורכם ${settings.requestHours} שעות.`
            : `After you send the request we contact you to complete payment. The booking is confirmed once payment is verified, and the time is held for you for ${settings.requestHours} hours.`,
        },
        {
          q: he ? "אפשר לבטל?" : "Can I cancel?",
          a: he ? `כן. ביטול אפשרי עד ${settings.cancelHours} שעות לפני הפגישה, מהאזור האישי באתר.` : `Yes, up to ${settings.cancelHours} hours before the meeting, from your account on the site.`,
        },
        {
          q: he ? "אפשר להזמין לאותו היום?" : "Can I book for today?",
          a: he ? "הזמנה לאותו היום פתוחה למנויי חדר הישיבות. ללא מנוי אפשר להזמין החל ממחר." : "Same-day booking is open to meeting-room members. Without a membership you can book from tomorrow.",
        },
        {
          q: he ? "צריך יותר משלוש שעות?" : "Need more than three hours?",
          a: he
            ? `בחרו חצי יום (5 שעות, ${money(room.priceHalf)}) או יום מלא (09:00–18:00, ${money(room.priceDay)}).`
            : `Choose a half day (5 hours, ${money(room.priceHalf)}) or a full day (09:00–18:00, ${money(room.priceDay)}).`,
        },
      ]
    : [];

  return (
    <>
      <LpTracker lp="room" />
      <LpHeader lang={lang} c={c} ctaHref="#book" langHref={otherLangHref(lang, "meeting-room", sp)} />
      <main id="main">
        <section aria-labelledby="lp-h1" className="lp-hero room">
          <div aria-hidden="true" className="lp-hero-bg">
            <Image className="lp-photo" src={photo} alt="" fill priority sizes="100vw" style={{ objectPosition: "center 35%" }} />
          </div>
          <div aria-hidden="true" className="lp-shade" />
          <div className="lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-kicker">
                <i aria-hidden="true" />
                {c.kicker}
              </p>
              <h1 id="lp-h1">{c.h1}</h1>
              <p className="lp-sub">{sub}</p>
              <dl className="lp-facts" style={{ marginTop: 6 }}>
                {facts.map((f) => (
                  <div key={f.k}>
                    <dt>{f.v}</dt>
                    <dd>{f.k}</dd>
                  </div>
                ))}
              </dl>
              {priceLine && <p className="lp-note" style={{ color: "#c9cbcf" }}>{priceLine}</p>}
            </div>
            {room ? (
              <LpBooking
                lang={lang}
                t={t}
                c={c}
                room={{ id: room.id, price: room.price, priceHalf: room.priceHalf, priceDay: room.priceDay, hours: room.hours }}
                packages={packages}
                cfg={{ cancelHours: settings.cancelHours, requestHours: settings.requestHours, taxMode: settings.taxMode, memberDiscount: settings.memberDiscount }}
                viewer={viewer ? { id: viewer.id, name: viewer.name, email: viewer.email, phone: viewer.phone, isMember: viewer.isMember } : null}
                initialSlots={initialSlots}
                nextPath={`/${lang}/lp/meeting-room`}
              />
            ) : (
              <div id="book" className="lp-book">
                <p className="lp-empty soft">{c.noRoom}</p>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="g-h" className="lp-sec dark">
          <div className="lp-wrap lp-stack">
            <div className="lp-head">
              <h2 id="g-h" style={{ maxWidth: 720 }}>
                {c.galT}
              </h2>
              <p className="lp-lead">{c.galSub}</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <figure className="lp-fig" style={{ flex: "2 1 min(100%,520px)", minHeight: "clamp(240px,40vw,520px)" }}>
                <Image src={photo} alt={roomAlt} fill sizes="(min-width: 1024px) 60vw, 100vw" />
              </figure>
              <div style={{ flex: "1 1 min(100%,280px)", display: "flex", flexWrap: "wrap", gap: 14 }}>
                <figure className="lp-fig" style={{ flex: "1 1 min(100%,220px)", minHeight: "clamp(180px,24vw,250px)" }}>
                  <Image src="/uploads/assets-1792344398893-10qe.jpg" alt={c.alt2} fill sizes="(min-width: 1024px) 30vw, 100vw" style={{ objectPosition: "center 40%" }} />
                </figure>
                <figure className="lp-fig" style={{ flex: "1 1 min(100%,220px)", minHeight: "clamp(180px,24vw,250px)" }}>
                  <Image src="/uploads/assets-1792344398884-f06p.png" alt={c.alt3} fill sizes="(min-width: 1024px) 30vw, 100vw" />
                </figure>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="inc-h" className="lp-sec light">
          <div className="lp-wrap lp-stack" style={{ gap: 32 }}>
            <div style={{ maxWidth: 720 }}>
              <p className="lp-eyebrow">
                <i aria-hidden="true" />
                {c.incK}
              </p>
              <h2 id="inc-h">{c.incT}</h2>
            </div>
            <ul className="lp-incs">
              {inc.map((x) => (
                <li key={x.h}>
                  <span className="lp-ic" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
                      <path d={x.ic} />
                    </svg>
                  </span>
                  <b>{x.h}</b>
                  <span className="t">{x.p}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="mem-h" className="lp-sec dark" style={{ paddingBlock: "clamp(48px,6vw,88px)" }}>
          <div className="lp-wrap">
            <div className="lp-mem">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="k">{c.memK}</p>
                <h2 id="mem-h">{c.memT}</h2>
                <p className="t">{c.memP}</p>
              </div>
              <div className="lp-mem-side">
                <div className="lp-mem-price">
                  <b>{money(settings.memberPrice)}</b>
                  <span>{c.memPer}</span>
                </div>
                <ul>
                  {memB.map((x) => (
                    <li key={x}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C3A46A" aria-hidden="true" style={{ strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", flex: "none" }}>
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      {x}
                    </li>
                  ))}
                </ul>
                <Link href={`/${lang}/membership`} className="lp-btn" style={{ height: 52, fontSize: 16 }} data-cta="membership">
                  {c.memCta}
                  <span aria-hidden="true">{arrow}</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="faq-h" className="lp-sec white">
          <div className="lp-wrap lp-two" style={{ gap: "clamp(28px,5vw,72px)" }}>
            <div className="lp-col lp-faq">
              <h2 id="faq-h" style={{ fontSize: "clamp(28px,3.2vw,44px)" }}>
                {c.faqT}
              </h2>
              <div className="lp-faq-list">
                {faq.map((x) => (
                  <details key={x.q}>
                    <summary>
                      {x.q}
                      <span aria-hidden="true">+</span>
                    </summary>
                    <p>{x.a}</p>
                  </details>
                ))}
              </div>
            </div>
            <div className="lp-col lp-loc">
              <h2>{c.locT}</h2>
              <p className="addr">{s.address}</p>
              <p className="hrs">{[s.hoursA, s.hoursB].filter(Boolean).join(" · ")}</p>
              <div className="lp-links">
                <a className="lp-link light" href={`https://waze.com/ul?q=${q}&navigate=yes`} target="_blank" rel="noopener">
                  Waze
                </a>
                <a className="lp-link line" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener">
                  Google Maps
                </a>
              </div>
              <a href="#book" className="lp-cta-big" data-cta="bottom">
                {c.ctaBottom}
                <span aria-hidden="true">{arrow}</span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <LpFooter lang={lang} c={c} />
      {room && <LpStickyBar watch={["book"]} href="#book" title={money(room.price)} sub={c.per3k} bold cta={c.ctaTop} />}
    </>
  );
}
