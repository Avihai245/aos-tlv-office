import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoginCard } from "@/components/login-card";
import { MembershipJoin } from "@/components/membership-join";
import { MembershipManage } from "@/components/membership-manage";
import { getT, isLang, tr } from "@/i18n";
import { getSite, getViewer } from "@/lib/data";
import { fmtDate, money } from "@/lib/format";
import { pageMeta } from "@/lib/seo";
import { roomPath } from "@/lib/urls";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/membership">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const { settings, rooms } = await getSite();
  const pct = Math.round(settings.memberDiscount * 100);
  const he = lang === "he";
  return pageMeta({
    lang,
    path: "/membership",
    title: he ? `מנוי חדר ישיבות: ${pct}% הנחה על כל פגישה` : `Meeting-room membership: ${pct}% off every meeting`,
    description: he
      ? `מנוי חודשי ב־${money(settings.memberPrice)} + מע״מ: ${pct}% הנחה על כל הזמנה של חדר הישיבות ב־AOS תל אביב, כולל הזמנה לאותו יום${rooms[0] ? ` (מ־${money(Math.round(rooms[0].price * (1 - settings.memberDiscount)))} ל־3 שעות)` : ""}.`
      : `A ${money(settings.memberPrice)} + VAT monthly membership gives ${pct}% off every AOS meeting-room booking in Tel Aviv, including same-day booking.`,
  });
}

const CHECK = "M20 6 9 17l-5-5";

export default async function Membership({ params }: PageProps<"/[lang]/membership">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  const he = lang === "he";
  const arrow = he ? "←" : "→";
  const [site, viewer] = await Promise.all([getSite(), getViewer()]);
  const { settings } = site;
  const room = site.rooms[0];
  const bookHref = room ? roomPath(lang, room) : `/${lang}/rooms`;

  let status: "none" | "pending" | "active" = "none";
  let ending = false; // cancelled by the member: not renewed, active until the end of the paid period
  if (viewer) {
    const supabase = await createClient();
    const { data } = await supabase.from("memberships").select("status,cancel_at").eq("user_id", viewer.id).maybeSingle();
    if (viewer.isMember) {
      status = "active";
      ending = !!data?.cancel_at;
    } else if (data?.status === "pending_payment") status = "pending";
  }
  const step = !viewer ? 1 : status === "active" ? 5 : status === "pending" ? 4 : 3;

  const pct = Math.round(settings.memberDiscount * 100);
  const price = settings.memberPrice;
  const vatPct = settings.taxPct;
  const vat = Math.round(price * vatPct) / 100;
  const total = Math.round(price * (100 + vatPct)) / 100;
  const rp = room?.price ?? 0;
  const save = Math.round(rp * settings.memberDiscount * 100) / 100;
  const benefits = tr(
    lang,
    [`${pct}% הנחה על כל הזמנה של חדר הישיבות`, "תיאום מהרגע להרגע, כולל הזמנה לאותו היום, לפי מקום פנוי", "ההנחה מופעלת אוטומטית בכל הזמנה"],
    [`${pct}% off every meeting-room booking`, "Book at the last minute, including same day, subject to availability", "The discount applies automatically to every booking"],
  );
  const until = viewer?.memberUntil ? fmtDate(viewer.memberUntil, lang, { day: "numeric", month: "long", year: "numeric" }) : "";
  const onSub = tr(lang, `ההנחה של ${pct}% מופעלת אוטומטית בהזמנות שלכם.${until ? ` בתוקף עד ${until}.` : ""}`, `Your ${pct}% discount applies automatically.${until ? ` Valid until ${until}.` : ""}`);
  const steps = [t.mReg, t.mVer, t.mPay];

  return (
    <section aria-labelledby="mem-h" style={{ animation: "aosFade .3s both" }}>
      <div className="wrap" style={{ paddingTop: "clamp(16px,2vw,24px)", paddingBottom: "clamp(56px,7vw,96px)" }}>
        <nav aria-label={t.crumbAria} className="crumb" style={{ marginBottom: 16 }}>
          <Link href={`/${lang}`}>{t.home}</Link>
          <span aria-hidden="true" style={{ margin: "0 8px" }}>/</span>
          <span aria-current="page">{t.memBadge}</span>
        </nav>
        <div className="mem-grid">
          <div className="mem-hero">
            <p className="eyebrow on-dark" style={{ margin: 0 }}>
              <i aria-hidden="true" />
              {t.memBadge}
            </p>
            <h1 id="mem-h">{tr(lang, `${pct}% הנחה על כל פגישה`, `${pct}% off every meeting`)}</h1>
            <p style={{ margin: 0, fontSize: 18, color: "#c9cbcf", maxWidth: 520 }}>{t.memLead}</p>
            <div className="mem-price">
              <b>{money(price)}</b>
              <span style={{ fontSize: 18, color: "#d7d8da" }}>{t.memPer}</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {benefits.map((x) => (
                <li key={x} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 17, color: "#fff" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", flex: "none", marginTop: 3, color: "var(--gold)" }} aria-hidden="true">
                    <path d={CHECK} />
                  </svg>
                  {x}
                </li>
              ))}
            </ul>
            {rp > 0 && (
              <div className="mem-ex">
                <div>
                  <span>{t.memEx1}</span>
                  <b style={{ textDecoration: "line-through", color: "#a9acb1" }}>{money(rp)}</b>
                </div>
                <div>
                  <span>{t.memEx2}</span>
                  <b style={{ color: "#fff" }}>{money(rp - save)}</b>
                </div>
                <div>
                  <span>{t.memEx3}</span>
                  <b style={{ color: "var(--gold)" }}>{money(save)}</b>
                </div>
              </div>
            )}
            <p style={{ margin: 0, fontSize: 14, color: "#a9acb1" }}>{t.memFine}</p>
          </div>

          <div className="mem-flow">
            <ol aria-label={t.stepsAria} className="mem-steps">
              {steps.map((label, i) => {
                const n = i + 1;
                const done = n < step;
                const cur = n === Math.min(step, 3) && step <= 3;
                return (
                  <li key={label} className={cur ? "cur" : done ? "done" : ""}>
                    <span className="n">{done ? "✓" : n}</span>
                    <span className="l">{label}</span>
                    {n < 3 && <i aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
            <div style={{ padding: "clamp(20px,3vw,36px)", display: "flex", flexDirection: "column", gap: 18 }}>
              {step === 1 && (
                <>
                  <div>
                    <h2 className="bk-h3">{t.mRegT}</h2>
                    <p className="bk-sub">{t.mRegSub}</p>
                  </div>
                  <div>
                    <button type="button" disabled aria-describedby="g-note" className="g-btn">
                      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
                        <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
                        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
                      </svg>
                      {t.gBtn}
                    </button>
                    <p id="g-note" style={{ margin: "6px 0 0", fontSize: 14, color: "var(--g2)", textAlign: "center" }}>
                      {t.gSoon}
                    </p>
                  </div>
                  <div className="or">
                    <i />
                    {t.orEmail}
                    <i />
                  </div>
                  <LoginCard lang={lang} t={t} next={`/${lang}/membership`} bare />
                </>
              )}
              {step === 3 && viewer && (
                <>
                  <div>
                    <h2 className="bk-h3">{t.mPayT}</h2>
                    <p className="bk-sub">{`${t.bookingAs} ${viewer.name || viewer.email}`}</p>
                  </div>
                  <dl className="mem-sum">
                    <div>
                      <dt>{t.memPlanL}</dt>
                      <dd>{money(price)}</dd>
                    </div>
                    <div>
                      <dt>{tr(lang, `מע״מ ${vatPct}%`, `VAT ${vatPct}%`)}</dt>
                      <dd>{money(vat)}</dd>
                    </div>
                    <div className="tot">
                      <dt>{t.memTotalL}</dt>
                      <dd>{money(total)}</dd>
                    </div>
                  </dl>
                  <div className="pay-box">
                    <b style={{ fontSize: 16 }}>{t.payMethods}</b>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--g1)" }}>
                      <span style={{ fontWeight: 600, color: "var(--ink)" }}>{t.payOff}</span> {t.memPayBody}
                    </p>
                  </div>
                  <MembershipJoin lang={lang} t={t} total={money(total)} />
                </>
              )}
              {step === 4 && (
                <>
                  <span className="status-ic" style={{ background: "#fbf0da", color: "#74500f" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
                      <path d="M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 6v6l4 2" />
                    </svg>
                  </span>
                  <h2 role="status" className="bk-h3" style={{ margin: 0 }}>{t.memPendT}</h2>
                  <p style={{ margin: 0, fontSize: 16, color: "var(--g1)" }}>{t.memPendB}</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link href={bookHref} className="btn btn-gold" style={{ height: 52, padding: "0 22px", fontSize: 16, borderRadius: 12 }}>
                      {t.navBook}
                    </Link>
                    <Link href={`/${lang}/account`} className="btn btn-out" style={{ height: 52, padding: "0 22px", fontSize: 16, borderRadius: 12 }}>
                      {t.myAcc}
                    </Link>
                  </div>
                  <MembershipManage lang={lang} mode="cancel-request" />
                </>
              )}
              {step === 5 && (
                <>
                  <span className="status-ic" style={{ background: "#e6f2ea", color: "#1b6340" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
                      <path d={CHECK} />
                    </svg>
                  </span>
                  <h2 role="status" className="bk-h3" style={{ margin: 0 }}>{t.memOnT}</h2>
                  <p style={{ margin: 0, fontSize: 16, color: "var(--g1)" }}>{onSub}</p>
                  {ending && (
                    <p role="status" className="ok-note" style={{ margin: 0, background: "#fbf0da", color: "#74500f" }}>
                      {tr(lang, `המנוי לא יחודש. ההטבות נשארות${until ? ` עד ${until}` : " עד סוף התקופה ששולמה"}.`, `The membership will not renew. Benefits stay${until ? ` until ${until}` : " until the end of the paid period"}.`)}
                    </p>
                  )}
                  <div>
                    <Link href={bookHref} className="btn btn-gold" style={{ height: 54, padding: "0 24px", fontSize: 16, borderRadius: 12, gap: 10 }}>
                      {t.navBook}
                      <span aria-hidden="true">{arrow}</span>
                    </Link>
                  </div>
                  <MembershipManage lang={lang} mode={ending ? "resume" : "cancel"} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
