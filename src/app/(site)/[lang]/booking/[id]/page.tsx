import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCalendar } from "@/components/booking-actions";
import { getT, isLang, payText, statusText, tr } from "@/i18n";
import { siteText } from "@/lib/contact";
import { getSite, getViewer } from "@/lib/data";
import { fmtDateTime, fmtShort, localParts, money, range } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { robots: { index: false } };

const CHECK = "M20 6 9 17l-5-5";
const CLOCK = "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 6v6l4 2";
const X = "M18 6 6 18M6 6l12 12";

export default async function BookingPage({ params }: PageProps<"/[lang]/booking/[id]">) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  const [site, viewer] = await Promise.all([getSite(), getViewer()]);
  const s = siteText(site.settings.content, lang);

  const supabase = await createClient();
  const { data: b } = viewer && /^[0-9a-f-]{36}$/i.test(id)
    ? await supabase.from("bookings").select("*").eq("id", id).eq("user_id", viewer.id).maybeSingle()
    : { data: null };

  if (!b) {
    return (
      <section className="status-page">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>{t.bkNF}</h1>
          <Link href={`/${lang}/account`} className="btn btn-dark" style={{ height: 52, padding: "0 24px", borderRadius: 12 }}>
            {viewer ? tr(lang, "האזור שלי", "My area") : t.signInL}
          </Link>
        </div>
      </section>
    );
  }

  // The room may no longer be public (hidden after the booking was made), so read its name through the booking only.
  const room = site.rooms.find((r) => r.id === b.room_id);
  const roomName = room ? (lang === "he" ? room.nameHe : room.nameEn) : "AOS";
  const from = localParts(b.starts_at);
  const to = localParts(b.ends_at);
  const exp = b.expires_at ? fmtDateTime(b.expires_at, lang) : "";

  const body: Record<string, string> = {
    pending_payment: tr(lang, `הבלוק שמור עבורכם עד ${exp}. ההזמנה תאושר לאחר השלמת התשלום, וצוות AOS ייצור איתכם קשר.`, `The block is held for you until ${exp}. The booking is confirmed once payment is completed; the AOS team will contact you.`),
    confirmed: tr(lang, `נתראה ב${s.address}.`, `See you at ${s.address}.`),
    cancelled: b.pay === "refund_pending" ? tr(lang, "ההזמנה בוטלה וההחזר בטיפול.", "The booking was cancelled and the refund is being processed.") : tr(lang, "ההזמנה בוטלה.", "The booking was cancelled."),
    expired: tr(lang, "הבלוק שוחרר. אפשר לבחור מועד חדש.", "The block was released. You can choose a new time."),
    hold: "",
    released: "",
  };
  const title: Record<string, string> = { pending_payment: t.reqTitle, confirmed: t.confTitle, cancelled: t.cancTitle, expired: t.expTitle, hold: t.holdTitle, released: t.cancTitle };
  const ic = b.status === "confirmed" ? [CHECK, "#eef5f0", "#2f6a45"] : b.status === "pending_payment" || b.status === "hold" ? [CLOCK, "#fbf3e4", "#7d5f27"] : [X, "#f1eee8", "#5a554d"];
  const lines: [string, string, boolean][] = [
    [t.bn, b.ref, true],
    [t.roomL, roomName, false],
    [t.date, fmtShort(from.date, lang), false],
    [t.timeL, range(from.hour, to.hour), true],
    [t.total, money(b.total), true],
    [t.statusL, statusText(b.status, lang), false],
    [t.payL, payText(b.pay, lang), false],
  ];

  return (
    <section aria-labelledby="bk-page-h" className="status-page">
      <div className="status-card">
        <div className="status-top">
          <span className="status-ic" style={{ background: ic[1], color: ic[2] }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
              <path d={ic[0]} />
            </svg>
          </span>
          <h1 id="bk-page-h">{title[b.status]}</h1>
          <p>{body[b.status]}</p>
        </div>
        <dl>
          {lines.map(([k, v, ltr]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd style={ltr ? { direction: "ltr" } : undefined}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="status-actions">
          {b.status === "confirmed" && (
            <AddToCalendar id={b.id} date={from.date} start={from.hour} end={to.hour} title={roomName} location={s.address} label={t.addCal} />
          )}
          <Link href={`/${lang}/account`} className="btn btn-out" style={{ height: 52, padding: "0 22px", fontSize: 16, borderRadius: 12 }}>
            {t.myBookings}
          </Link>
          {room && (
            <Link href={`/${lang}/room/${room.id}`} className="link-u" style={{ display: "inline-flex", alignItems: "center", height: 52, padding: "0 12px", fontSize: 16, fontWeight: 600, textUnderlineOffset: 4 }}>
              {t.bookAgain}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
