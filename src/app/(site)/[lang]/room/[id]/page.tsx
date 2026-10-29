import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingWidget } from "@/components/booking-widget";
import { Faq } from "@/components/faq";
import { JsonLd } from "@/components/json-ld";
import { MembershipBanner } from "@/components/membership-banner";
import { RoomGallery } from "@/components/room-gallery";
import { getT, isLang, tr } from "@/i18n";
import { availOf } from "@/lib/availability";
import { mapQuery, siteText } from "@/lib/contact";
import { getSite, getViewer } from "@/lib/data";
import { addDays, fixRanges, imgSrc, money, todayKey } from "@/lib/format";
import { buildFaqs } from "@/lib/faq";
import { breadcrumbSchema, faqSchema, graph, roomSchema } from "@/lib/schema";
import { langUrl, pageMeta } from "@/lib/seo";
import { featIntro, roomFeatures } from "@/lib/room-features";
import { availability } from "@/lib/slots-server";
import { createClient } from "@/lib/supabase/server";
import type { Slot } from "@/lib/types";

const I_U = "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75";
const I_P = "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6";
const I_CLOCK = "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 6v6l4 2";

export async function generateMetadata({ params }: PageProps<"/[lang]/room/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLang(lang)) return {};
  const room = (await getSite()).rooms.find((r) => r.id === id);
  if (!room) return {};
  const he = lang === "he";
  const desc = ((he ? room.descHe : room.descEn) || "").split(". ")[0].replace(/\.$/, "");
  return pageMeta({
    lang,
    path: `/room/${room.id}`,
    title: he ? `חדר ישיבות להשכרה בתל אביב ל־${room.capacity} משתתפים` : `Meeting room for rent in Tel Aviv, up to ${room.capacity} people`,
    description: he
      ? `${desc}. ${money(room.price)} ל־3 שעות, ${money(room.priceHalf)} לחצי יום, ${money(room.priceDay)} ליום מלא. הזמנה אונליין.`
      : `${desc}. ${money(room.price)} for 3 hours, ${money(room.priceHalf)} for a half day, ${money(room.priceDay)} for a full day. Book online.`,
    image: "/uploads/og-room.jpg",
    imageAlt: he ? (room.images[0]?.he ?? room.nameHe) : (room.images[0]?.en ?? room.nameEn),
  });
}

export default async function RoomPage({ params, searchParams }: PageProps<"/[lang]/room/[id]">) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const t = getT(lang);
  const he = lang === "he";
  const [site, viewer] = await Promise.all([getSite(), getViewer()]);
  const { settings, packages } = site;
  const room = site.rooms.find((r) => r.id === id);
  if (!room) notFound();
  const c = siteText(settings.content, lang);

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const today = todayKey();
  const dRaw = one(sp.d);
  const date = dRaw && /^\d{4}-\d{2}-\d{2}$/.test(dRaw) && dRaw >= today && dRaw <= addDays(today, settings.windowDays) ? dRaw : null;
  const pRaw = one(sp.p);
  const pkg = packages.find((p) => p.id === pRaw)?.id ?? null;
  const sRaw = Number(one(sp.s));
  const start = date && pkg && Number.isFinite(sRaw) ? sRaw : null;

  const supabase = await createClient();
  const need = Array.from(new Set(["p3", ...(pkg ? [pkg] : [])]));
  const lists = await Promise.all(need.map((p) => availability(supabase, !!viewer, room.id, today, 62, p)));
  const initialSlots: Record<string, Slot[]> = Object.fromEntries(need.map((p, i) => [p, lists[i]]));
  const av = availOf(initialSlots.p3, t, lang);

  const roomName = he ? room.nameHe : room.nameEn;
  const feats = roomFeatures(room, lang);
  const q = mapQuery(settings.content.addressHe || c.address);
  const gallery = room.images.map((g) => ({ src: imgSrc(g.src), alt: (he ? g.he : g.en) || roomName }));

  const metaFacts = [
    { ic: I_U, v: `${room.capacity} ${t.seats}` },
    { ic: I_CLOCK, v: t.blocks3 },
    { ic: I_P, v: c.address },
  ];
  const rules = [
    { k: tr(lang, "3 שעות, חצי יום או יום מלא", "3 hours, half day or full day"), v: tr(lang, "3 שעות (09–12 / 12–15 / 15–18), חצי יום של 5 שעות (09–14 / 13–18) או יום מלא 09:00–18:00.", "3 hours (09–12 / 12–15 / 15–18), a 5-hour half day (09–14 / 13–18) or a full day 09:00–18:00.") },
    { k: tr(lang, "אישור לאחר תשלום", "Confirmed after payment"), v: tr(lang, `הבלוק נשמר ל־${settings.holdMinutes} דקות בזמן ההזמנה.`, `The block is held for ${settings.holdMinutes} minutes while you book.`) },
    { k: tr(lang, "ביטול", "Cancellation"), v: tr(lang, `עד ${settings.cancelHours} שעות לפני הפגישה, מהחשבון שלכם.`, `Up to ${settings.cancelHours} hours before, from your account.`) },
  ];
  const faqs = buildFaqs(lang, { room, offices: site.offices, settings });
  const pageUrl = langUrl(lang, `/room/${room.id}`);
  const where = [
    { k: t.capL, v: `${room.capacity} ${t.seats}` },
    { k: t.durL, v: t.blocks3 },
    { k: t.addrL, v: c.address },
    { k: t.hoursL, v: `${c.hoursA} · ${c.hoursB}` },
  ];

  return (
    <div className="room-pad">
      <JsonLd
        data={graph(
          roomSchema(lang, site, room, pageUrl),
          breadcrumbSchema([
            { name: t.home, path: "", lang },
            { name: roomName, path: `/room/${room.id}`, lang },
          ]),
          faqSchema(faqs),
        )}
      />
      <section aria-labelledby="room-h" style={{ animation: "aosFade .3s both" }}>
        <div className="rm-top">
          <nav aria-label={t.crumbAria} className="crumb">
            <Link href={`/${lang}`}>{t.home}</Link>
            <span aria-hidden="true" style={{ margin: "0 8px" }}>
              /
            </span>
            <span aria-current="page">{roomName}</span>
          </nav>
          <h1 id="room-h">{roomName}</h1>
          <ul className="rm-meta">
            {metaFacts.map((f) => (
              <li key={f.v}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", flex: "none" }} aria-hidden="true">
                  <path d={f.ic} />
                </svg>
                {f.v}
              </li>
            ))}
            <li className="av">
              <i className="dot" style={{ background: av.dot, margin: "0 5px", animation: "none" }} />
              {av.avail}
            </li>
          </ul>
        </div>
        <div className="wrap" style={{ paddingTop: 20 }}>
          <BookingWidget
            lang={lang}
            t={t}
            room={{ id: room.id, name: roomName, price: room.price, priceHalf: room.priceHalf, priceDay: room.priceDay, hours: room.hours }}
            packages={packages}
            cfg={{
              windowDays: settings.windowDays,
              holdMinutes: settings.holdMinutes,
              requestHours: settings.requestHours,
              cancelHours: settings.cancelHours,
              taxMode: settings.taxMode,
              taxPct: settings.taxPct,
              memberDiscount: settings.memberDiscount,
            }}
            viewer={viewer ? { id: viewer.id, name: viewer.name, email: viewer.email, phone: viewer.phone, isMember: viewer.isMember } : null}
            initial={{ date, start, pkg }}
            initialSlots={initialSlots}
            roomHref={`/${lang}/room/${room.id}`}
          />
        </div>

        <div className="wrap" style={{ paddingTop: "clamp(24px,3vw,36px)" }}>
          <MembershipBanner lang={lang} t={t} room={room} settings={settings} viewer={viewer} solid />
        </div>

        <div className="rm-gal">
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <h2>{t.photosN}</h2>
            {gallery.length ? (
              <RoomGallery items={gallery} rtl={he} openLabel={t.galOpen} labels={{ prev: t.prevImg, next: t.nextImg, close: t.close }} />
            ) : (
              <div role="img" aria-label={t.roomPhotoSoon} className="no-photo">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                <span style={{ fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>{t.roomPhotoSoon}</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{t.aboutRoom}</h2>
            <p style={{ margin: 0, fontSize: 17, color: "var(--g1)", textWrap: "pretty" }}>{he ? room.descHe : room.descEn}</p>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--line-2)" }}>
          <div className="rm-sec-grid">
            <section aria-labelledby="inc-h" style={{ gridColumn: "1/-1" }}>
              <h2 id="inc-h" style={{ margin: "0 0 16px", fontSize: "clamp(24px,2.4vw,32px)", fontWeight: 700 }}>
                {t.incT}
              </h2>
              <p style={{ margin: "-6px 0 18px", fontSize: 17, color: "var(--g1)", maxWidth: 640 }}>{featIntro(room, lang)}</p>
              <ul className="inc">
                {feats.map((f) => (
                  <li key={f.title}>
                    <span className="ic">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
                        <path d={f.ic} />
                      </svg>
                    </span>
                    <span>
                      <b>{f.title}</b>
                      <span className="s">{f.sub}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="rules-h">
              <h2 id="rules-h" style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 700 }}>
                {t.knowT}
              </h2>
              <dl className="kv">
                {rules.map((r) => (
                  <div key={r.k}>
                    <dt>{r.k}</dt>
                    <dd>{fixRanges(r.v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section aria-labelledby="loc2-h">
              <h2 id="loc2-h" style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 700 }}>
                {t.whereT}
              </h2>
              <dl className="kv where">
                {where.map((f) => (
                  <div key={f.k}>
                    <dt>{f.k}</dt>
                    <dd>{f.v}</dd>
                  </div>
                ))}
              </dl>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <a href={`https://waze.com/ul?q=${q}&navigate=yes`} target="_blank" rel="noopener" className="btn btn-dark" style={{ height: 46, fontSize: 15, borderRadius: 10 }}>
                  Waze
                </a>
                <a href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener" className="btn btn-out" style={{ height: 46, fontSize: 15, borderRadius: 10 }}>
                  Google Maps
                </a>
              </div>
            </section>
            <section aria-labelledby="rfaq-h">
              <h2 id="rfaq-h" style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 700 }}>
                {t.faqTitle}
              </h2>
              <Faq items={faqs.map((f) => ({ ...f, a: fixRanges(f.a) }))} flat />
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
