import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelBooking, SignOutButton } from "@/components/booking-actions";
import { LoginCard } from "@/components/login-card";
import { errText, getT, isLang, payText, statusText, tr } from "@/i18n";
import { getSite, getViewer } from "@/lib/data";
import { fmtDow, fmtMon, fmtShort, localParts, money, range } from "@/lib/format";
import { bookingPath, roomPath } from "@/lib/urls";
import { getMyBookings } from "@/lib/bookings";

export const metadata: Metadata = { robots: { index: false } };

const tone = (s: string) =>
  s === "confirmed" ? ["#eef5f0", "#2f6a45"] : s === "pending_payment" ? ["#fbf3e4", "#7d5f27"] : ["#f1eee8", "#5a554d"];

export default async function Account({ params, searchParams }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const t = getT(lang);
  const [site, viewer] = await Promise.all([getSite(), getViewer()]);

  if (!viewer) {
    return (
      <section aria-labelledby="acc-h" style={{ animation: "aosFade .3s both" }}>
        <div className="login-grid">
          <div>
            <h1 id="acc-h">{t.authTitle}</h1>
            <p style={{ margin: "14px 0 0", fontSize: 17, color: "var(--g1)", maxWidth: 440 }}>{t.accWhy}</p>
            {sp.auth === "failed" && (
              <div role="alert" className="alert" style={{ marginTop: 16, maxWidth: 440 }}>
                {errText("gen", lang)}
              </div>
            )}
          </div>
          <LoginCard lang={lang} t={t} next={`/${lang}/account`} />
        </div>
      </section>
    );
  }

  const tab = sp.tab === "past" ? "past" : "up";
  const { now, up, past } = await getMyBookings(viewer.id);
  const cancelHours = site.settings.cancelHours;
  const roomName = (id: string) => {
    const r = site.rooms.find((x) => x.id === id);
    return r ? (lang === "he" ? r.nameHe : r.nameEn) : "AOS";
  };
  const bookHref = site.rooms.length === 1 ? roomPath(lang, site.rooms[0]) : `/${lang}/rooms`;
  const roomHref = (id: string) => {
    const r = site.rooms.find((x) => x.id === id);
    return r ? roomPath(lang, r) : bookHref;
  };
  const first = viewer.name ? viewer.name.split(" ")[0] : "";
  const tabs = [
    { key: "up", label: t.tUp, badge: up.length },
    { key: "past", label: t.tPast, badge: 0 },
  ];

  return (
    <section aria-labelledby="acc-h" style={{ animation: "aosFade .3s both" }}>
      <div className="wrap" style={{ padding: "14px clamp(16px,4vw,40px) 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 id="acc-h" style={{ margin: 0, fontSize: "clamp(22px,2.2vw,28px)", fontWeight: 700 }}>
              {tr(lang, "האזור שלי", "My area")}
              {first ? ` · ${first}` : ""}
            </h1>
            <p style={{ margin: "4px 0 0", color: "var(--g2)", direction: "ltr", textAlign: "start", fontSize: 15 }}>{viewer.email}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {viewer.role === "admin" && (
              <Link href="/admin" className="btn btn-dark" style={{ height: 48, padding: "0 20px", fontSize: 15, borderRadius: 12 }}>
                {tr(lang, "ניהול", "Admin")}
              </Link>
            )}
            <Link href={bookHref} className="btn btn-gold" style={{ height: 48, padding: "0 20px", fontSize: 15, borderRadius: 12 }}>
              {t.newBooking}
            </Link>
            <SignOutButton lang={lang} label={t.signOutL} className="btn btn-line" />
          </div>
        </div>

        <div role="tablist" aria-label={t.accK} style={{ display: "flex", gap: 4, margin: "14px 0", overflowX: "auto", borderBottom: "1px solid var(--line)" }}>
          {tabs.map((b) => (
            <Link
              key={b.key}
              href={`/${lang}/account?tab=${b.key}`}
              role="tab"
              aria-selected={tab === b.key}
              style={{ minHeight: 48, padding: "0 14px", borderBottom: `2px solid ${tab === b.key ? "var(--ink)" : "transparent"}`, marginBottom: -1, fontSize: 16, fontWeight: tab === b.key ? 600 : 500, color: tab === b.key ? "var(--ink)" : "#6f6a62", whiteSpace: "nowrap", display: "flex", gap: 8, alignItems: "center" }}
            >
              {b.label}
              {b.badge > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", background: "#eadbb8", borderRadius: 999, padding: "1px 8px" }}>{b.badge}</span>}
            </Link>
          ))}
        </div>

        {tab === "up" && (
          <>
            {up.length === 0 && (
              <div style={{ background: "var(--bg-2)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{t.noUp}</p>
                <Link href={bookHref} className="btn btn-gold" style={{ height: 48, padding: "0 20px", fontSize: 16, borderRadius: 12 }}>
                  {t.navBook}
                </Link>
              </div>
            )}
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {up.map((b) => {
                const from = localParts(b.starts_at);
                const to = localParts(b.ends_at);
                const [bg, fg] = tone(b.status);
                const late = b.status === "confirmed" && new Date(b.starts_at).getTime() - now < cancelHours * 3600_000;
                return (
                  <li key={b.id} className="acc-card">
                    <div className="acc-date">
                      <span>{fmtDow(from.date, lang)}</span>
                      <b>{from.date.slice(8)}</b>
                      <span>{fmtMon(from.date, lang)}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <b style={{ fontSize: 18, fontWeight: 600 }}>{roomName(b.room_id)}</b>
                        <span style={{ fontSize: 13, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: bg, color: fg }}>{statusText(b.status, lang)}</span>
                      </div>
                      <div style={{ fontSize: 15, color: "var(--g1)", marginTop: 4 }}>
                        <span style={{ direction: "ltr", display: "inline-block" }}>{range(from.hour, to.hour)}</span> · {payText(b.pay, lang)} · <span style={{ direction: "ltr", display: "inline-block" }}>{money(b.total)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--g2)", marginTop: 2, direction: "ltr", textAlign: "start" }}>{b.ref}</div>
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                      <Link href={bookingPath(lang, b.ref)} className="link-u" style={{ fontSize: 15, fontWeight: 600 }}>
                        {t.details}
                      </Link>
                      {!late && <CancelBooking id={b.id} lang={lang} t={t} cancelHours={cancelHours} />}
                      {late && <span style={{ fontSize: 14, color: "var(--g2)", maxWidth: 220 }}>{errText("late", lang, cancelHours)}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {tab === "past" && (
          <>
            {past.length === 0 && <p style={{ color: "var(--g1)", background: "var(--bg-2)", borderRadius: 12, padding: 20, margin: 0 }}>{t.noPast}</p>}
            <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--line)" }}>
              {past.map((b) => {
                const from = localParts(b.starts_at);
                const to = localParts(b.ends_at);
                return (
                  <li key={b.id} className="acc-past">
                    <span>
                      <b style={{ fontWeight: 600 }}>{roomName(b.room_id)}</b>
                      <br />
                      <span style={{ fontSize: 13, color: "var(--g2)", direction: "ltr", display: "inline-block" }}>{b.ref}</span>
                    </span>
                    <span>
                      {fmtShort(from.date, lang)} · <span style={{ direction: "ltr", display: "inline-block" }}>{range(from.hour, to.hour)}</span>
                    </span>
                    <span style={{ color: "var(--g1)" }}>
                      {statusText(b.status, lang)} · <span style={{ direction: "ltr", display: "inline-block" }}>{money(b.total)}</span>
                    </span>
                    <span style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Link href={roomHref(b.room_id)} className="link-u" style={{ fontWeight: 600 }}>
                        {t.bookAgain}
                      </Link>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
