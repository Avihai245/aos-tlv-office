"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errText, tr, type Dict, type Lang } from "@/i18n";
import { x } from "@/i18n/extra";
import { addDays, dowOf, fmtLong, fmtMonth, fmtShort, hm, keyOf, money, pad, parseKey, phoneOk, range, todayKey } from "@/lib/format";
import { fetchQuote, fetchSlots } from "@/lib/slots";
import { getUtm, track } from "@/lib/track";
import { bookingPath } from "@/lib/urls";
import { createClient } from "@/lib/supabase/client";
import type { Pkg, Quote, Slot } from "@/lib/types";
import { AuthPanel } from "./auth-panel";

export type WidgetRoom = {
  id: string;
  name: string;
  price: number;
  priceHalf: number;
  priceDay: number;
  hours: Record<number, { open: number; close: number }>;
};
export type WidgetCfg = {
  windowDays: number;
  holdMinutes: number;
  requestHours: number;
  cancelHours: number;
  taxMode: "none" | "included" | "added";
  taxPct: number;
  memberDiscount: number;
};
export type WidgetViewer = { id: string; name: string; email: string; phone: string; isMember: boolean } | null;

type Phase = null | "auth" | "phone" | "pay" | "dead";
const NONE: Slot[] = [];
/** Wall clock, read only from event handlers and timers (never during render). */
const clock = () => Date.now();
const CHECK = "M20 6 9 17l-5-5";
const WEEK = ["2024-01-07", "2024-01-08", "2024-01-09", "2024-01-10", "2024-01-11", "2024-01-12", "2024-01-13"];

function Ico({ d, size = 18, w = 2, style }: { d: string; size?: number; w?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round", flex: "none", ...style }} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function BookingWidget({
  lang,
  t,
  room,
  packages,
  cfg,
  viewer,
  initial,
  initialSlots,
  roomHref,
}: {
  lang: Lang;
  t: Dict;
  room: WidgetRoom;
  packages: Pkg[];
  cfg: WidgetCfg;
  viewer: WidgetViewer;
  initial: { date: string | null; start: number | null; pkg: string | null };
  initialSlots: Record<string, Slot[]>;
  roomHref: string;
}) {
  const he = lang === "he";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const arrow = he ? "←" : "→";
  const prevArrow = he ? "→" : "←";
  const today = todayKey();
  const maxK = addDays(today, cfg.windowDays);

  const [slotsBy, setSlotsBy] = useState<Record<string, Slot[]>>(initialSlots);
  const [pkg, setPkg] = useState<string | null>(initial.pkg);
  const [date, setDate] = useState<string | null>(initial.date);
  const [start, setStart] = useState<number | null>(initial.start);
  const [step, setStep] = useState(initial.date ? (initial.pkg && initial.start !== null ? 3 : 2) : 1);
  const [mOff, setMOff] = useState(0);
  const [bkErr, setBkErr] = useState("");
  const [needHint, setNeedHint] = useState(false);
  const [phase, setPhase] = useState<Phase>(null);
  const [hold, setHold] = useState<{ id: string; expires: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [coErr, setCoErr] = useState("");
  const [phone, setPhone] = useState(viewer?.phone ?? "");
  const [phoneErr, setPhoneErr] = useState("");
  const [quoteState, setQuoteState] = useState<{ key: string; q: Quote | null }>({ key: "", q: null });
  const [now, setNow] = useState(0);
  const [localUid, setLocalUid] = useState<string | null>(null);

  const pk = packages.find((p) => p.id === pkg) ?? null;
  const calSlots = slotsBy[pkg ?? "p3"] ?? slotsBy.p3 ?? NONE;
  const isMember = !!viewer?.isMember;

  const freeOn = useCallback((day: string, list: Slot[]) => list.filter((s) => s.day === day && s.state === "free").length, []);
  const firstAvail = useMemo(() => calSlots.find((s) => s.state === "free")?.day ?? null, [calSlots]);
  const selDate = date ?? firstAvail;
  const ds = useMemo(() => (selDate ? calSlots.filter((s) => s.day === selDate) : []), [calSlots, selDate]);
  const chosen = pk && start !== null ? ds.find((s) => s.start === start && s.state === "free") ?? null : null;
  const has = !!(selDate && chosen && pk);
  const end = has && pk && start !== null ? start + pk.hours : null;
  const reach = has ? 3 : selDate ? 2 : 1;
  // A link may arrive with a stale or invalid selection; show the time step until the choice is valid.
  const shownStep = step === 3 && pkg && slotsBy[pkg] && !has ? 2 : step;

  // Availability for a package is fetched the first time it is chosen (the server supplies the one from the URL).
  async function load(p: string) {
    const list = await fetchSlots(supabase, room.id, today, 62, p);
    setSlotsBy((s) => ({ ...s, [p]: list }));
  }

  // Exact quote (member discount and tax) from the database for the summary.
  const quoteKey = has && selDate && start !== null && end !== null ? `${selDate}|${start}|${end}|${isMember}` : "";
  useEffect(() => {
    if (!quoteKey || !selDate || start === null || end === null) return;
    let live = true;
    void fetchQuote(supabase, room.id, selDate, start, end).then((q) => live && setQuoteState({ key: quoteKey, q }));
    return () => {
      live = false;
    };
  }, [quoteKey, selDate, start, end, supabase, room.id]);
  const quote = quoteState.key === quoteKey ? quoteState.q : null;

  // Hold countdown: the clock only ticks while a hold is open.
  useEffect(() => {
    if (!hold || phase !== "pay") return;
    const id = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(id);
  }, [hold, phase]);
  const left = hold ? Math.max(0, hold.expires - now) : 0;
  const shownPhase: Phase = phase === "pay" && hold && now >= hold.expires ? "dead" : phase;

  const goStep = (n: number) => {
    setBkErr("");
    setStep(n);
    if (n < 4) {
      setPhase(null);
    }
  };

  const pickDay = (k: string) => {
    setDate(k);
    setStart(null);
    setBkErr("");
    setStep(2);
  };
  const pickPkg = (id: string) => {
    setPkg(id);
    setStart(null);
    setBkErr("");
    if (!slotsBy[id]) void load(id);
  };
  const pickSlot = (s: Slot) => setStart(chosen && s.start === start ? null : s.start);


  async function createHold() {
    if (!selDate || start === null || end === null) return;
    setBusy(true);
    setCoErr("");
    const { data, error } = await supabase.rpc("create_hold", { p_room: room.id, p_date: selDate, p_start: start, p_end: end, p_source: "web", p_utm: getUtm() });
    setBusy(false);
    const res = (data ?? {}) as { err?: string; booking?: { id: string; expires_at: string } };
    if (error || res.err || !res.booking) {
      const code = error ? "gen" : res.err ?? "gen";
      setBkErr(code);
      setPhase(null);
      setStep(2);
      if (code === "taken") {
        setStart(null);
        if (pkg) void load(pkg);
      }
      return;
    }
    setNow(clock());
    setHold({ id: res.booking.id, expires: new Date(res.booking.expires_at).getTime() });
    setPhase("pay");
  }

  function startCheckout() {
    track("begin_checkout", { page: "room", value: chosen?.total ?? 0, currency: "ILS" });
    setStep(4);
    setBkErr("");
    if (!viewer) setPhase("auth");
    else if (!phone) setPhase("phone");
    else void createHold();
  }

  // After signing in: learn who signed in, refresh the page's server data, then continue the checkout.
  async function afterAuth() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setLocalUid(u.user.id);
    const { data: p } = await supabase.from("profiles").select("phone").eq("id", u.user.id).maybeSingle();
    setPhone(p?.phone ?? "");
    router.refresh();
    if (!p?.phone) setPhase("phone");
    else await createHold();
  }

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    const uid = viewer?.id ?? localUid;
    if (!uid) return;
    if (!phoneOk(phone)) return setPhoneErr(errText("phone", lang));
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ phone: phone.trim() }).eq("id", uid);
    setBusy(false);
    if (error) return setPhoneErr(errText("gen", lang));
    setPhoneErr("");
    void createHold();
  }

  async function cancelHold(toStep = 3) {
    if (hold) await supabase.rpc("release_hold", { p_booking: hold.id });
    setHold(null);
    setPhase(null);
    setStep(toStep);
    if (pkg) void load(pkg);
  }

  async function sendRequest() {
    if (!hold) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("request_booking", { p_booking: hold.id });
    setBusy(false);
    const res = (data ?? {}) as { err?: string; booking?: { id: string; ref: string } };
    if (error || res.err || !res.booking) {
      const code = error ? "gen" : res.err ?? "gen";
      setCoErr(errText(code, lang, cfg.cancelHours));
      if (code === "expired" || code === "nf") setPhase("dead");
      return;
    }
    track("booking_request_submit", { page: "room", value: quote?.total ?? chosen?.total ?? 0, currency: "ILS" });
    router.push(bookingPath(lang, res.booking.ref));
  }

  // ── derived view data ──
  const memberPriceOf = (p: Pkg) => {
    const base = p.id === "half" ? room.priceHalf : p.id === "day" ? room.priceDay : room.price;
    return money(Math.round(base * (1 - cfg.memberDiscount) * 100) / 100);
  };
  const priceOf = (p: Pkg) => {
    const base = p.id === "half" ? room.priceHalf : p.id === "day" ? room.priceDay : room.price;
    return money(isMember ? Math.round(base * (1 - cfg.memberDiscount) * 100) / 100 : base);
  };
  const hrsOf = (p: Pkg) => p.starts.map((s) => `${pad(s)}–${pad(s + p.hours)}`).join(" · ");
  const pkName = (p: Pkg) => (he ? p.nameHe : p.nameEn);
  const partOf = (s: number) => x(s < 11 ? "morning" : s < 14 ? "midday" : s < 17 ? "afternoon" : "evening", lang);
  const durTxt = pk ? (pkName(pk).includes(String(pk.hours)) ? pkName(pk) : `${pkName(pk)} · ${pk.hours} ${x("hours", lang)}`) : "—";
  const nFree = selDate ? freeOn(selDate, calSlots) : 0;
  const timeTxt = has && start !== null && end !== null ? range(start, end) : null;

  const labels = [t.stDate, t.stTime, t.stSum, t.stRes];

  // Calendar
  const [ty, tm] = today.split("-").map(Number);
  const mAbs = tm - 1 + mOff;
  const cy = ty + Math.floor(mAbs / 12);
  const cm = ((mAbs % 12) + 12) % 12;
  const monthKey = `${cy}-${pad(cm + 1)}-01`;
  const lead = dowOf(monthKey);
  const dim = new Date(Date.UTC(cy, cm + 1, 0)).getUTCDate();
  const maxD = parseKey(maxK);
  const mMax = (maxD.getUTCFullYear() - ty) * 12 + maxD.getUTCMonth() - (tm - 1);
  const cells = Math.ceil((lead + dim) / 7) * 7;

  const clampMoff = (n: number) => Math.max(0, Math.min(mMax, n));

  const isTaxAdded = quote?.taxMode === "added";
  const taxShort = quote?.taxMode === "added" ? tr2("הסכום כולל מע״מ שנוסף למחיר", "Total includes VAT added to the price") : quote?.taxMode === "included" ? tr2("המחיר כולל מע״מ", "VAT included") : t.taxNone;
  function tr2(h: string, e: string) {
    return he ? h : e;
  }
  const reassure = [
    tr2(`ביטול ללא עלות עד ${cfg.cancelHours} שעות לפני הפגישה`, `Free cancellation up to ${cfg.cancelHours} hours before`),
    tr2(`הבלוק נשמר עבורכם ${cfg.holdMinutes} דקות בזמן ההזמנה`, `The block is held for ${cfg.holdMinutes} minutes while you book`),
    tr2("פרטי כרטיס האשראי אינם נשמרים ב־AOS", "Card details are never stored by AOS"),
  ];
  const mm = Math.floor(left / 60000);
  const ss = Math.floor(left / 1000) % 60;
  const memberSave = quote && !isMember ? Math.round(quote.unit * cfg.memberDiscount * 100) / 100 : 0;
  const nextUrl = `${roomHref}${date ? `?d=${date}${pkg ? `&p=${pkg}` : ""}${start !== null ? `&s=${start}` : ""}` : ""}`;

  const missing = has ? "" : selDate ? `${t.missTime} · ${fmtShort(selDate, lang)}` : t.missDate;
  const nextAvailDay = (() => {
    const from = selDate ?? today;
    return calSlots.find((s) => s.state === "free" && s.day > from)?.day ?? null;
  })();

  const scrollToBook = () => document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <section id="book" aria-labelledby="bk-h" className="bk">
        <div className="bk-head">
          <h2 id="bk-h">{t.bookThis2}</h2>
          <ol aria-label={t.stepsAria} className="bk-steps">
            {labels.map((label, i) => {
              const n = i + 1;
              const done = n < shownStep;
              const cur = n === shownStep;
              const can = n <= reach && n !== shownStep && n < 4;
              return (
                <li key={label} className={cur ? "cur" : done ? "done" : ""}>
                  <button type="button" disabled={!can} aria-current={cur ? "step" : undefined} aria-label={`${n}. ${label}`} onClick={() => can && goStep(n)}>
                    <span className="n">{done ? "✓" : n}</span>
                    <span className="lbl">{label}</span>
                  </button>
                  {n < 4 && <i aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
          <p aria-live="polite" className="bk-cap">
            {tr2(`שלב ${shownStep} מתוך 4 · ${labels[shownStep - 1]}`, `Step ${shownStep} of 4 · ${labels[shownStep - 1]}`)}
          </p>
        </div>

        <div className="bk-body">
          <div className="bk-main" key={shownStep}>
            {shownStep === 1 && (
              <>
                <div>
                  <h3 className="bk-h3">{t.stepDateQ}</h3>
                  <p className="bk-sub">{t.stepDateSub}</p>
                </div>
                <div className="cal-wrap">
                  <div className="cal">
                    <div className="cal-nav">
                      <button type="button" onClick={() => setMOff(clampMoff(mOff - 1))} disabled={mOff <= 0} aria-label={t.prevM}>
                        <Ico d="m15 18-6-6 6-6" size={16} />
                      </button>
                      <span aria-live="polite">{fmtMonth(monthKey, lang)}</span>
                      <button type="button" onClick={() => setMOff(clampMoff(mOff + 1))} disabled={mOff >= mMax} aria-label={t.nextM}>
                        <Ico d="m9 18 6-6-6-6" size={16} />
                      </button>
                    </div>
                    <div role="group" aria-label={fmtMonth(monthKey, lang)} className="cal-grid">
                      {WEEK.map((w) => (
                        <div key={w} aria-hidden="true" className="wd">
                          {parseKey(w).toLocaleDateString(he ? "he-IL" : "en-GB", { timeZone: "UTC", weekday: "narrow" })}
                        </div>
                      ))}
                      {Array.from({ length: cells }, (_, i) => {
                        const dn = i - lead + 1;
                        if (dn < 1 || dn > dim) return <div key={i} className="day blank" />;
                        const k = keyOf(new Date(Date.UTC(cy, cm, dn, 12)));
                        let st: "out" | "closed" | "full" | "avail" = "avail";
                        let n = 0;
                        if (k < today || k > maxK) st = "out";
                        else if (!room.hours[dowOf(k)]) st = "closed";
                        else {
                          n = freeOn(k, calSlots);
                          st = n ? "avail" : "full";
                        }
                        const on = k === selDate;
                        const sub = st === "closed" ? t.closedL : st === "full" ? t.fullL : st === "avail" ? `${n} ${n === 1 ? t.free1 : t.freeN}` : "";
                        const cls = ["day", st, on ? "on" : "", k === today ? "today" : ""].join(" ");
                        return (
                          <button key={i} type="button" className={cls} disabled={st !== "avail" && !on} aria-pressed={on} aria-label={fmtLong(k, lang) + (sub ? ` · ${sub}` : "")} onClick={() => st === "avail" && pickDay(k)}>
                            <span className="n">{dn}</span>
                            <span className="s">
                              {st === "avail" ? (
                                <>
                                  <span className="m">{n}</span>
                                  <span className="d">{sub}</span>
                                </>
                              ) : st === "out" ? (
                                ""
                              ) : (
                                <>
                                  <span className="m">—</span>
                                  <span className="d">{sub}</span>
                                </>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="cal-side">
                    <div className="chosen">
                      <span className="k">{t.chosenDate}</span>
                      <b>{selDate ? fmtLong(selDate, lang) : t.pickDay}</b>
                      {selDate && (
                        <span className="f">
                          {nFree ? `${nFree} ${x(nFree === 1 ? "blockFree" : "blocksFree", lang)}` : x("noneFree", lang)}
                        </span>
                      )}
                    </div>
                    {!isMember && (
                      <div className="sameday">
                        <Ico d="M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 6v6l4 2" style={{ marginTop: 2, color: "var(--gold)" }} />
                        <span>
                          {t.sameDayNote} <Link href={`/${lang}/membership`} className="tap-x">{t.sameDayCta}</Link>
                        </span>
                      </div>
                    )}
                    <ul className="legend">
                      <li>
                        <span className="sw" style={{ border: "1px solid #cfd2d6", color: "var(--ok)" }}>4</span>
                        {t.legFree}
                      </li>
                      <li>
                        <span className="sw" style={{ background: "var(--ink)", color: "#fff" }}>✓</span>
                        {t.legSel}
                      </li>
                      <li>
                        <span className="sw" style={{ background: "var(--bg-3)", color: "var(--g2)", fontWeight: 400 }}>—</span>
                        {t.legNo}
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="bk-actions end">
                  <button type="button" className="btn btn-gold" onClick={() => selDate && goStep(2)} disabled={!selDate}>
                    {t.toTime}
                    <span aria-hidden="true">{arrow}</span>
                  </button>
                </div>
              </>
            )}

            {shownStep === 2 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <h3 className="bk-h3">{t.stepTimeQ}</h3>
                    <p className="bk-sub">{selDate ? fmtLong(selDate, lang) : ""}</p>
                  </div>
                  <button type="button" className="link-btn" onClick={() => goStep(1)}>
                    {t.changeDate}
                  </button>
                </div>
                <b style={{ fontSize: 17 }}>{t.pkQ}</b>
                <div role="group" aria-label={t.pkQ} className="pk-grid">
                  {packages.map((p) => (
                    <button key={p.id} type="button" className="pk" aria-pressed={pkg === p.id} onClick={() => pickPkg(p.id)}>
                      <b>{pkName(p)}</b>
                      <span>{hrsOf(p)}</span>
                      <b>{priceOf(p)}</b>
                      {!isMember && cfg.memberDiscount > 0 && (
                        <small className="pk-m">
                          {tr(lang, "במנוי:", "Members:")} {memberPriceOf(p)}
                        </small>
                      )}
                    </button>
                  ))}
                </div>
                {!pkg && <p className="pk-none">{t.pkFirst}</p>}
                <div id="slots" className="slots">
                  {(pkg ? ds : []).map((s) => {
                    const free = s.state === "free";
                    const on = chosen?.start === s.start;
                    const sub = on ? t.selL : free ? t.free1 : s.state === "past" ? t.pastL : s.state === "members_only" ? x("membersOnly", lang) : t.taken;
                    return (
                      <button key={s.start} type="button" className="slot" disabled={!free} aria-pressed={on} aria-label={`${hm(s.start)}–${hm(s.end)} · ${sub}`} onClick={() => free && pickSlot(s)}>
                        <span className="part">{partOf(s.start)}</span>
                        <span className="time">{hm(s.start)} – {hm(s.end)}</span>
                        <span className="sub">{on ? "✓ " : ""}{sub}</span>
                      </button>
                    );
                  })}
                </div>
                {pkg && !ds.some((s) => s.state === "free") && (
                  <div className="notice">
                    <p>{firstAvail ? t.noSlots : t.noAvail}</p>
                    {nextAvailDay && (
                      <button type="button" className="mini-btn" onClick={() => pickDay(nextAvailDay)}>
                        {t.goNext}
                      </button>
                    )}
                  </div>
                )}
                {bkErr && (
                  <div role="alert" className="alert" style={{ padding: "12px 14px" }}>
                    {errText(bkErr, lang, cfg.cancelHours)}
                  </div>
                )}
                <div className="bk-actions">
                  <button type="button" className="btn btn-line" onClick={() => goStep(1)}>
                    {prevArrow} {t.back}
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    {!has && (
                      <span role="status" style={{ fontSize: 15, fontWeight: needHint ? 600 : 400, color: needHint ? "var(--err)" : "var(--g1)" }}>
                        {missing}
                      </span>
                    )}
                    <button
                      type="button"
                      className={has ? "btn btn-gold" : "btn btn-gold cta-off"}
                      aria-disabled={!has}
                      onClick={() => (has ? goStep(3) : setNeedHint(true))}
                    >
                      {t.toSum}
                      <span aria-hidden="true">{arrow}</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {shownStep === 3 && has && (
              <>
                <div>
                  <h3 className="bk-h3">{t.sumT}</h3>
                  <p className="bk-sub">{t.sumSub}</p>
                </div>
                <div className="sum-box">
                  <dl className="rows">
                    {[
                      [t.roomL, room.name],
                      [t.date, fmtLong(selDate!, lang)],
                      [t.timeL, timeTxt],
                      [t.durL, durTxt],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <dl className="cost">
                    <div>
                      <dt>{x("pkgPrice", lang)}</dt>
                      <dd>{money(quote?.base ?? chosen!.price)}</dd>
                    </div>
                    {quote && quote.disc > 0 && (
                      <div>
                        <dt>{tr2(`הנחת מנוי ${Math.round(cfg.memberDiscount * 100)}%`, `Member discount ${Math.round(cfg.memberDiscount * 100)}%`)}</dt>
                        <dd>−{money(quote.disc)}</dd>
                      </div>
                    )}
                    {isTaxAdded && quote && (
                      <div>
                        <dt>{tr2(`מע״מ ${quote.taxPct}%`, `VAT ${quote.taxPct}%`)}</dt>
                        <dd>{money(quote.tax)}</dd>
                      </div>
                    )}
                    <div className="tot">
                      <dt>{t.totalPay}</dt>
                      <dd>{money(quote?.total ?? chosen!.total)}</dd>
                    </div>
                    <p className="note">{taxShort}</p>
                  </dl>
                </div>
                {!isMember && memberSave > 0 && (
                  <Link href={`/${lang}/membership`} className="upsell">
                    <span>
                      <b>{t.memBadge}</b> · {tr2(`חסכו ${money(memberSave)} בהזמנה הזו עם מנוי`, `Save ${money(memberSave)} on this booking with a membership`)}
                    </span>
                    <span style={{ fontWeight: 600, display: "inline-flex", gap: 8 }}>
                      {t.memCta}
                      <span aria-hidden="true">{arrow}</span>
                    </span>
                  </Link>
                )}
                <ul className="reassure">
                  {reassure.map((r) => (
                    <li key={r}>
                      <Ico d={CHECK} size={16} />
                      {r}
                    </li>
                  ))}
                </ul>
                {bkErr && (
                  <div role="alert" className="alert" style={{ padding: "12px 14px" }}>
                    {errText(bkErr, lang, cfg.cancelHours)}
                  </div>
                )}
                <div className="bk-actions">
                  <button type="button" className="btn btn-line" onClick={() => goStep(2)}>
                    {prevArrow} {t.back}
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <Link href={`/${lang}/terms`} className="link-u" style={{ fontSize: 15, fontWeight: 500 }}>
                      {t.fullTerms}
                    </Link>
                    <button type="button" className="btn btn-gold" onClick={startCheckout} disabled={busy}>
                      {t.toReserve}
                      <span aria-hidden="true">{arrow}</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {shownStep === 4 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <h3 className="bk-h3">{shownPhase === "auth" ? t.dlgAuth : shownPhase === "phone" ? t.dlgPhone : shownPhase === "dead" ? t.dlgDead : t.dlgPay}</h3>
                    <p className="bk-sub">
                      {selDate ? fmtLong(selDate, lang) : ""} {timeTxt ? `· ${timeTxt}` : ""}
                    </p>
                  </div>
                  {shownPhase === "pay" && (
                    <div role="timer" className="timer">
                      <span>{t.holdLeft}</span>
                      <b>
                        {pad(mm)}:{pad(ss)}
                      </b>
                    </div>
                  )}
                </div>

                {shownPhase === "auth" && (
                  <>
                    <p style={{ margin: 0, color: "var(--g1)", fontSize: 16 }}>{t.authWhy}</p>
                    <AuthPanel lang={lang} t={t} idp="bk" next={nextUrl} onSuccess={() => void afterAuth()} start="up" afterEmail={tr(lang, "הקישור יחזיר אתכם לאותו מועד שבחרתם.", "The link brings you back to the slot you chose.")} />
                    <div>
                      <button type="button" className="btn btn-line" onClick={() => goStep(3)}>
                        {prevArrow} {t.backSum}
                      </button>
                    </div>
                  </>
                )}

                {shownPhase === "phone" && (
                  <form onSubmit={savePhone} noValidate style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 14 }}>
                    <p style={{ margin: 0, color: "var(--g1)", fontSize: 16 }}>{t.phoneWhy}</p>
                    <div className="field">
                      <label htmlFor="b-ph">{t.fPhone}</label>
                      <input id="b-ph" className="input ltr-in" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneErr(""); }} />
                    </div>
                    {phoneErr && (
                      <div role="alert" className="alert">
                        {phoneErr}
                      </div>
                    )}
                    <button type="submit" disabled={busy} className="btn btn-dark" style={{ height: 56, fontSize: 17 }}>
                      {t.continueL}
                    </button>
                    <div>
                      <button type="button" className="btn btn-line" onClick={() => goStep(3)}>
                        {prevArrow} {t.backSum}
                      </button>
                    </div>
                  </form>
                )}

                {shownPhase === "pay" && (
                  <>
                    <div className="pay-box">
                      <b style={{ fontSize: 17 }}>{t.payMethods}</b>
                      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--g1)" }}>
                        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{t.payOff}</span>{" "}
                        {tr2(
                          `אפשר לשלוח בקשת הזמנה: הבלוק יישמר עבורכם ל־${cfg.requestHours} שעות וצוות AOS ייצור קשר להשלמת התשלום. ההזמנה מאושרת רק לאחר קבלת התשלום.`,
                          `Send a booking request: the block is held for ${cfg.requestHours} hours and the AOS team will contact you to complete payment. The booking is confirmed only once payment is received.`,
                        )}
                      </p>
                    </div>
                    {coErr && (
                      <div role="alert" className="alert">
                        {coErr}
                      </div>
                    )}
                    <div className="bk-actions">
                      <button type="button" className="link-btn" style={{ color: "var(--g1)", fontSize: 15 }} onClick={() => void cancelHold(3)}>
                        {t.cancelCo}
                      </button>
                      <button type="button" className="btn btn-gold" onClick={() => void sendRequest()} disabled={busy}>
                        {busy ? (
                          t.busyL
                        ) : (
                          <>
                            {t.sendReq} · <span style={{ direction: "ltr", display: "inline-block" }}>{money(quote?.total ?? chosen?.total ?? 0)}</span>
                          </>
                        )}
                      </button>
                    </div>
                    {/* True while payment is offline: sending the request charges nothing. Remove once online payment goes live. */}
                    <p style={{ margin: 0, fontSize: 14, color: "var(--g2)" }}>{tr2("לא מתבצע חיוב כעת.", "You won't be charged now.")}</p>
                  </>
                )}

                {shownPhase === "dead" && (
                  <>
                    <p role="alert" style={{ margin: 0, fontSize: 17 }}>
                      {t.coExpired}
                    </p>
                    <div>
                      <button type="button" className="btn btn-dark" style={{ height: 56 }} onClick={() => void cancelHold(2).then(() => setStart(null))}>
                        {t.chooseAgain}
                      </button>
                    </div>
                  </>
                )}
                {shownPhase === null && busy && <p role="status">{t.busyL}</p>}
              </>
            )}
          </div>

          <aside aria-label={t.yourBooking} className="rail only-desk">
            <div>
              <p className="k0">{t.yourBooking}</p>
              <div className="big">
                <b>{money(room.price)}</b>
                <span style={{ fontSize: 16, color: "#d7d8da" }}>{t.perBlock}</span>
              </div>
            </div>
            <dl>
              {[
                [t.date, selDate ? fmtShort(selDate, lang) : t.notChosen, !!selDate],
                [t.timeL, timeTxt ?? t.notChosen, has],
                [t.durL, has ? durTxt : "—", has],
              ].map(([k, v, on]) => (
                <div key={String(k)}>
                  <dt>{k}</dt>
                  <dd style={{ color: on ? "#fff" : "#b9bcc1" }}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="tot">
              <span style={{ fontSize: 16, color: "#d7d8da" }}>{t.totalPay}</span>
              <b style={{ fontSize: 28, fontWeight: 700, direction: "ltr", color: has ? "var(--gold)" : "#b9bcc1" }}>{has ? money(quote?.total ?? chosen!.total) : "—"}</b>
            </div>
            <ul>
              {reassure.map((r) => (
                <li key={r}>
                  <Ico d={CHECK} size={15} style={{ marginTop: 2, color: "var(--gold)" }} />
                  {r}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {shownStep < 4 && (
        <div className="room-bar only-mob">
          <div style={{ minWidth: 0, lineHeight: 1.25 }}>
            <b>{has ? money(quote?.total ?? chosen!.total) : money(room.price)}</b>
            <span>{has && selDate && timeTxt ? `${fmtShort(selDate, lang)} · ${timeTxt}` : t.perBlock3}</span>
          </div>
          <button type="button" onClick={has ? startCheckout : scrollToBook}>
            {has ? t.toPay : selDate ? t.pickTime : t.chooseDate}
          </button>
        </div>
      )}
    </>
  );
}

