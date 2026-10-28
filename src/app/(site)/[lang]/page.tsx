import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { Faq } from "@/components/faq";
import { Gallery } from "@/components/gallery";
import { HeroPanel, HeroVideo } from "@/components/hero-client";
import { MembershipBanner } from "@/components/membership-banner";
import { OfficeExplorer } from "@/components/office-explorer";
import { getT, isLang, tr } from "@/i18n";
import { availOf, heroDates, nextSlotLinks } from "@/lib/availability";
import { contactLinks, mapQuery, siteText } from "@/lib/contact";
import { getSite, getViewer } from "@/lib/data";
import { fixRanges, imgSrc, money, todayKey } from "@/lib/format";
import { officeView } from "@/lib/office-view";
import { roomFeatures } from "@/lib/room-features";
import { fetchSlots } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";

const LIB = [
  { src: "/uploads/assets-1792344398884-f06p.png", he: "דלת הכניסה למתחם AOS עם הלוגו", en: "AOS entrance door with logo" },
  { src: "/uploads/assets-1792344398893-10qe.jpg", he: "המטבחון המשותף", en: "The shared kitchenette" },
];
const BLD = [
  { src: "/uploads/we-out.webp", he: "הבניין מבחוץ", en: "The building from outside", row: "1 / span 2", pos: "center 40%" },
  { src: "/uploads/we3.jpeg", he: "הלובי המרכזי", en: "The main lobby", row: "auto", pos: "center" },
  { src: "/uploads/We.jpeg", he: "פינת ישיבה בלובי", en: "A lobby seating area", row: "auto", pos: "center" },
  { src: "/uploads/we4.jpeg", he: "עמדת הקבלה והמעליות", en: "Reception and lifts", row: "auto", pos: "center" },
  { src: "/uploads/WE2.jpeg", he: "פינת המתנה וגלריה", en: "Waiting area and gallery", row: "auto", pos: "center" },
];

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  const he = lang === "he";
  const arrow = he ? "←" : "→";
  const [site, viewer] = await Promise.all([getSite(), getViewer()]);
  const { settings, offices } = site;
  const c = settings.content;
  const s = siteText(c, lang);
  const room = site.rooms[0];
  const supabase = await createClient();
  const slots = room ? await fetchSlots(supabase, room.id, todayKey(), 62, "p3") : [];
  const av = availOf(slots, t, lang);

  const roomHref = room ? `/${lang}/room/${room.id}` : `/${lang}/rooms`;
  const roomName = room ? (he ? room.nameHe : room.nameEn) : "";
  const taxText =
    settings.taxMode === "added"
      ? he
        ? `+ מע״מ ${settings.taxPct}% · סה״כ לתשלום ${money(Math.round((room?.price ?? 0) * (1 + settings.taxPct / 100) * 100) / 100)}`
        : `+ ${settings.taxPct}% VAT · total ${money(Math.round((room?.price ?? 0) * (1 + settings.taxPct / 100) * 100) / 100)}`
      : settings.taxMode === "included"
        ? tr(lang, "המחיר כולל מע״מ", "VAT included")
        : t.taxNone;

  const dates = heroDates(slots, t, lang, (d) => `${roomHref}?d=${d}`);
  const nextSlots = nextSlotLinks(slots, t, lang, (x) => `${roomHref}?d=${x.day}&s=${x.start}&p=p3`);
  const feats = room ? roomFeatures(room, lang) : [];
  const roomImg = room?.images[0];

  const offViews = offices.map((o) => officeView(o, lang, t));
  const availCount = offices.filter((o) => o.status === "available").length;
  const anySet = offices.some((o) => o.status !== "unset");
  const rents = offices.filter((o) => (o.price ?? 0) > 0).map((o) => o.price as number);
  const offFrom = rents.length ? `${tr(lang, "החל מ־", "From ")}${money(Math.min(...rents))} ${t.monthly}` : t.priceReq;
  const offSum = anySet
    ? tr(lang, `${availCount} מתוך ${offices.length} משרדים פנויים כעת. משאירים פנייה ומתאמים סיור.`, `${availCount} of ${offices.length} offices available now. Enquire and arrange a tour.`)
    : tr(lang, "משרדים פרטיים להשכרה במתחם. משאירים פנייה ומתאמים סיור והצעת מחיר.", "Private offices to rent. Enquire and we will arrange a tour and a quote.");

  const amenities = [
    [["מחיצות זכוכית", "Glass partitions"], ["פרטיות עם אור טבעי.", "Privacy with natural light."]],
    [["תאורה מובנית", "Integrated lighting"], ["תאורת לד חמה במסדרון ובמשרדים.", "Warm LED lighting in corridors and offices."]],
    [["מטבחון משותף", "Shared kitchenette"], ["מקרר, מכונת קפה ומים.", "Fridge, coffee machine and water."]],
    [["מיזוג מרכזי", "Central A/C"], ["נוחות בכל עונות השנה.", "Comfort all year round."]],
    [["אינטרנט מהיר", "High-speed internet"], ["בכל המתחם.", "Throughout the space."]],
    [["טלוויזיה 75 אינץ׳", "75-inch TV"], ["בחדר הישיבות, למצגות ולשיחות וידאו.", "In the meeting room, for presentations and video calls."]],
    [["מיקום במרכז העסקים", "Business-district address"], [s.address, s.address]],
  ].map(([a, b]) => ({ title: tr(lang, a[0], a[1]), body: tr(lang, b[0], b[1]) }));

  const hours = `${s.hoursA}, ${s.hoursB}`;
  const faqs = [
    [["איך מזמינים חדר ישיבות?", "How do I book a meeting room?"], ["בוחרים יום וחבילה (3 שעות, חצי יום או יום מלא), מתחברים לחשבון ושולחים בקשת הזמנה. ההזמנה מאושרת לאחר אימות התשלום.", "Choose a day and a package (3 hours, half day or full day), sign in and send a booking request. It is confirmed once payment is verified."]],
    [["כמה זמן נמשכת הזמנה?", "How long is a booking?"], ["אפשר להזמין 3 שעות (09–12, 12–15 או 15–18), חצי יום של 5 שעות או יום מלא, לפי הזמינות ביומן.", "You can book 3 hours (09–12, 12–15 or 15–18), a 5-hour half day or a full day, subject to availability."]],
    [["האם אפשר לבטל?", "Can I cancel?"], [`כן, עד ${settings.cancelHours} שעות לפני הפגישה, מאזור "החשבון שלי".`, `Yes, up to ${settings.cancelHours} hours before the meeting, from "My account".`]],
    [["מה כלול בחדר?", "What is included in a room?"], ["טלוויזיה 75 אינץ׳, אינטרנט מהיר, מיזוג, מקרר משקאות, קפה ועוגיות.", "A 75-inch TV, fast internet, A/C, a drinks fridge, coffee and cookies."]],
    [["איך שוכרים משרד?", "How do I rent an office?"], ["בדף המשרדים מוצג הסטטוס של כל אחד משבעת המשרדים. משאירים פנייה ונחזור לתאם סיור והצעת מחיר.", "The offices page shows the status of each of the seven offices. Send an enquiry and we will arrange a tour and a quote."]],
    [["מה שעות הפעילות?", "What are the opening hours?"], [hours, hours]],
  ].map(([q, a]) => ({ q: tr(lang, q[0], q[1]), a: tr(lang, a[0], a[1]) }));

  const links = contactLinks(c);
  const q = mapQuery(c.addressHe || s.address);
  const lbLabels = { prev: t.prevImg, next: t.nextImg, close: t.close };

  return (
    <>
      <section aria-labelledby="hero-h" className="hero">
        <div aria-hidden="true" className="hero-bg">
          <Image src="/uploads/corridor-2026.jpg" alt="" fill priority sizes="100vw" />
          <HeroVideo />
          <div className="hero-shade" />
        </div>
        {nextSlots[0] && (
          <Link href={nextSlots[0].href} className="hero-next">
            <i className="dot" style={{ background: "#4cc38a" }} />
            {t.nextFreeL} · {nextSlots[0].day} · {nextSlots[0].time}
          </Link>
        )}
        <div className="hero-in">
          <div className="hero-col">
            <p className="hero-kicker">
              <i aria-hidden="true" />
              AOS · {s.address}
            </p>
            <h1 id="hero-h">
              {s.heroA}
              <br />
              <span>{s.heroB.replace(/[.]\s*$/, "")}</span>
            </h1>
            <p className="hero-sub">{s.heroSub}</p>
            <HeroPanel
              arrow={arrow}
              labels={{ navAria: t.navAria, room: t.nRooms, office: tr(lang, "משרד פרטי", "Private office"), navBook: t.navBook, offTitle: t.offTitle2, furnished: t.furnished, exploreOff: t.exploreOff, tourShort: t.tourShort }}
              bookHref={roomHref}
              officesHref={`/${lang}/offices`}
              contactHref={`/${lang}#contact`}
              room={
                room
                  ? {
                      price: room.price > 0 ? money(room.price) : t.priceReq,
                      per: room.price > 0 ? t.per3 : "",
                      cap: tr(lang, `עד ${room.capacity} משתתפים`, `Up to ${room.capacity} people`),
                      avail: av.avail,
                      dot: av.dot,
                      tax: taxText,
                    }
                  : null
              }
              dates={dates}
              offFrom={offFrom}
              offFromSub={tr(lang, "+ דמי ניהול + מע״מ", "+ management fee + VAT")}
            />
            <dl className="hero-stats">
              {[
                { v: String(offices.length), k: tr(lang, "משרדים פרטיים", "private offices") },
                { v: room ? String(room.capacity) : "—", k: tr(lang, "משתתפים בחדר הישיבות", "meeting-room seats") },
                { v: "3", k: tr(lang, "שעות בכל בלוק", "hours per block") },
              ].map((x) => (
                <div key={x.k}>
                  <dt>{x.v}</dt>
                  <dd>{x.k}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section id="room-sec" aria-labelledby="hr-h" className="room-sec">
        <div className="wrap room-grid">
          <div className="room-photo reveal">
            {roomImg ? (
              <Image src={imgSrc(roomImg.src)} alt={(he ? roomImg.he : roomImg.en) || roomName} fill sizes="(min-width: 1024px) 45vw, 100vw" />
            ) : (
              <div className="photo-soon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                <span style={{ fontSize: 16 }}>{t.roomPhotoSoon}</span>
              </div>
            )}
          </div>
          <div className="room-info reveal">
            <p className="eyebrow on-dark" style={{ margin: 0 }}>
              <i aria-hidden="true" />
              {t.nRooms}
            </p>
            {room && (
              <>
                <h2 id="hr-h" className="h2" style={{ margin: "-6px 0 0", color: "#fff" }}>
                  {tr(lang, `חדר ישיבות ל־${room.capacity} משתתפים`, `A meeting room for up to ${room.capacity}`)}
                </h2>
                <p style={{ margin: 0, fontSize: 17, color: "#c9cbcf", maxWidth: 560, textWrap: "pretty" }}>{he ? room.descHe : room.descEn}</p>
                <ul className="feat-grid">
                  {feats.map((x) => (
                    <li key={x.title}>
                      <span className="feat-ic">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
                          <path d={x.ic} />
                        </svg>
                      </span>
                      <b style={{ fontWeight: 600 }}>{x.title}</b>
                    </li>
                  ))}
                </ul>
                {nextSlots.length > 0 && (
                  <div>
                    <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600, color: "#fff" }}>{t.nextSlotsT}</p>
                    <div className="next-slots">
                      {nextSlots.map((x) => (
                        <Link key={x.href} href={x.href} aria-label={x.aria}>
                          <span>{x.day}</span>
                          <span>{x.time}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                <div className="room-cta">
                  <div style={{ paddingTop: 16 }}>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <b style={{ fontSize: 34, fontWeight: 700, direction: "ltr", color: "#fff" }}>{room.price > 0 ? money(room.price) : t.priceReq}</b>
                      <span style={{ fontSize: 16, color: "#c9cbcf" }}>{room.price > 0 ? t.per3 : ""}</span>
                    </span>
                    <span style={{ display: "block", fontSize: 14, color: "#a9acb1" }}>{taxText}</span>
                  </div>
                  <Link href={roomHref} className="btn btn-gold on-dark" style={{ marginTop: 16 }}>
                    {t.navBook}
                    <span aria-hidden="true">{arrow}</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="wrap reveal" style={{ paddingBottom: "clamp(56px,7vw,96px)" }}>
          <MembershipBanner lang={lang} t={t} room={room} settings={settings} viewer={viewer} />
        </div>
      </section>

      <section id="offices" aria-labelledby="off-h">
        <div className="wrap sec-pad">
          <div className="off-head reveal">
            <div style={{ maxWidth: 680 }}>
              <p className="eyebrow">
                <i aria-hidden="true" />
                {t.offK}
              </p>
              <h2 id="off-h" className="h2">
                {t.offTitle2}
              </h2>
              <p style={{ margin: "12px 0 0", fontSize: 17, color: "var(--g1)" }}>{offSum}</p>
            </div>
            <Link href={`/${lang}/offices`} className="btn btn-out" style={{ gap: 10 }}>
              {t.allOffices}
              <span aria-hidden="true">{arrow}</span>
            </Link>
          </div>
          <OfficeExplorer offices={offViews} arrow={arrow} photoSoon={t.officePhotoSoon} />
        </div>
      </section>

      <section id="building" aria-labelledby="bld-h" className="dark-sec">
        <div className="wrap sec-pad">
          <div className="off-head reveal" style={{ gap: "16px 40px" }}>
            <div style={{ maxWidth: 680 }}>
              <p className="eyebrow on-dark">
                <i aria-hidden="true" />
                {t.bldK}
              </p>
              <h2 id="bld-h" className="h2" style={{ color: "#fff" }}>
                {t.bldT}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: 17, color: "#c9cbcf", maxWidth: 480 }}>{t.bldSub}</p>
          </div>
          <Gallery
            variant="building"
            rtl={he}
            labels={lbLabels}
            items={BLD.map((g) => ({ src: g.src, alt: tr(lang, g.he, g.en), pos: g.pos, row: g.row }))}
          />
        </div>
      </section>

      <section id="complex" aria-labelledby="cx-h" className="complex">
        <div className="wrap complex-grid">
          <Gallery variant="complex" rtl={he} labels={lbLabels} items={LIB.map((g) => ({ src: g.src, alt: tr(lang, g.he, g.en) }))} />
          <div className="reveal" style={{ minWidth: 0 }}>
            <p className="eyebrow">
              <i aria-hidden="true" />
              {t.nComplex}
            </p>
            <h2 id="cx-h" className="h2" style={{ marginBottom: 24 }}>
              {t.amTitle}
            </h2>
            <ul className="am-grid">
              {amenities.map((a) => (
                <li key={a.title}>
                  <b>{a.title}</b>
                  <span>{a.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="location" aria-labelledby="loc-h">
        <div className="loc-grid reveal">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600, color: "var(--gold-text)" }}>{t.nLocCon}</p>
              <h2 id="loc-h" className="h2-s">
                {s.address}
              </h2>
              <p style={{ margin: "12px 0 0", color: "var(--g1)" }}>{t.locBody}</p>
            </div>
            <dl className="dl-rows">
              <div>
                <dt>{t.hoursL}</dt>
                <dd>
                  {s.hoursA}
                  <br />
                  {s.hoursB}
                </dd>
              </div>
              {links.map((l) => (
                <div key={l.href}>
                  <dt>{t.contactL}</dt>
                  <dd>
                    <a href={l.href} target={l.target} rel="noopener" className="link-u ltr" style={{ display: "inline-block", fontWeight: 500 }}>
                      {l.label}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={`https://waze.com/ul?q=${q}&navigate=yes`} target="_blank" rel="noopener" className="btn btn-dark" style={{ height: 48, borderRadius: 12 }}>
                Waze
              </a>
              <a href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener" className="btn btn-out" style={{ height: 48, borderRadius: 12 }}>
                Google Maps
              </a>
              <Link href={`/${lang}#contact`} className="link-u" style={{ display: "inline-flex", alignItems: "center", height: 48, padding: "0 16px", fontSize: 16, fontWeight: 600, textUnderlineOffset: 4 }}>
                {t.tourT}
              </Link>
            </div>
          </div>
          <div className="map-box">
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center", color: "var(--g1)" }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{s.address}</span>
              <span style={{ fontSize: 15 }}>{t.mapFallback}</span>
            </div>
            <iframe title={t.mapTitle} loading="lazy" src={`https://maps.google.com/maps?q=${q}&output=embed`} />
          </div>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-h" className="faq">
        <div className="faq-grid reveal">
          <h2 id="faq-h" className="h2-s">
            {t.faqTitle}
          </h2>
          <Faq items={faqs.map((f) => ({ ...f, a: fixRanges(f.a) }))} />
        </div>
      </section>

      <section id="contact" aria-labelledby="con-h">
        <div className="con-grid reveal">
          <div>
            <h2 id="con-h" style={{ margin: 0, fontSize: "clamp(26px,2.6vw,34px)", fontWeight: 700, lineHeight: 1.2 }}>
              {t.tourT}
            </h2>
            <p style={{ margin: "12px 0 0", color: "var(--g1)", maxWidth: 460 }}>{t.tourSub}</p>
          </div>
          <div className="con-card">
            <ContactForm lang={lang} t={t} />
          </div>
        </div>
      </section>
    </>
  );
}
