"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { errText, tr, type Dict, type Lang } from "@/i18n";
import { addDays, dowOf, fmtLong, money, pad, parseKey, phoneOk, range, todayKey } from "@/lib/format";
import type { RoomCopy } from "@/lib/lp-copy";
import { fetchSlots } from "@/lib/slots";
import { createClient } from "@/lib/supabase/client";
import { getUtm, track } from "@/lib/track";
import type { Pkg, Slot } from "@/lib/types";
import { bookingPath } from "@/lib/urls";
import { AuthPanel } from "../auth-panel";

export type LpRoom = { id: string; price: number; priceHalf: number; priceDay: number; hours: Record<number, { open: number; close: number }> };
export type LpCfg = { cancelHours: number; requestHours: number; taxMode: "none" | "included" | "added"; memberDiscount: number };
export type LpViewer = { id: string; name: string; email: string; phone: string; isMember: boolean } | null;

const DAYS = 14;
const CHECK = "M20 6 9 17l-5-5";

/**
 * The booking card of the meeting-room page: 14 days, a length (3 hours, half day, full day), a time, then details.
 * It uses the same database functions as the booking page (availability, hold, request) and records the request as coming from
 * this page together with the campaign tags, so it shows up in the same calendar and in the back office like any other booking.
 */
export function LpBooking({ lang, t, c, room, packages, cfg, viewer, initialSlots, nextPath }: { lang: Lang; t: Dict; c: RoomCopy; room: LpRoom; packages: Pkg[]; cfg: LpCfg; viewer: LpViewer; initialSlots: Slot[]; nextPath: string }) {
  const he = lang === "he";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const loc = he ? "he-IL" : "en-GB";
  const arrow = he ? "←" : "→";
  const today = todayKey();
  const member = !!viewer?.isMember;

  const [slotsBy, setSlotsBy] = useState<Record<string, Slot[]>>({ p3: initialSlots });
  const [pkg, setPkg] = useState<string | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [step, setStep] = useState<"pick" | "details" | "done">("pick");
  const [hint, setHint] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [localUid, setLocalUid] = useState<string | null>(null);
  const [phone, setPhone] = useState(viewer?.phone ?? "");
  const [done, setDone] = useState<{ ref: string; when: string; total: string } | null>(null);

  const uid = viewer?.id ?? localUid;
  const list = useMemo(() => slotsBy[pkg ?? "p3"] ?? slotsBy.p3 ?? [], [slotsBy, pkg]);
  const pk = packages.find((p) => p.id === pkg) ?? null;

  // The next 14 days with what is open on each, for the package chosen (3 hours until one is chosen).
  const days = useMemo(() => {
    return Array.from({ length: DAYS }, (_, i) => {
      const k = addDays(today, i);
      const ds = list.filter((s) => s.day === k);
      const free = ds.filter((s) => s.state === "free").length;
      const st: "closed" | "full" | "members" | "open" =
        !room.hours[dowOf(k)] || ds.length === 0 || ds.every((s) => s.state === "past") ? "closed" : free ? "open" : ds.some((s) => s.state === "members_only") ? "members" : "full";
      return { k, free, st };
    });
  }, [list, room.hours, today]);
  const date = pickedDate && days.some((d) => d.k === pickedDate && d.st === "open") ? pickedDate : days.find((d) => d.st === "open")?.k ?? null;
  const slots = pkg && date ? list.filter((s) => s.day === date) : [];
  const chosen = pkg && date && start !== null ? slots.find((s) => s.start === start && s.state === "free") ?? null : null;
  const end = chosen && pk ? chosen.start + pk.hours : null;

  const base = (p: Pkg) => (p.id === "half" ? room.priceHalf : p.id === "day" ? room.priceDay : room.price);
  const priceOf = (p: Pkg) => money(member ? Math.round(base(p) * (1 - cfg.memberDiscount) * 100) / 100 : base(p));
  const vatNote = cfg.taxMode === "added" ? c.plusVat : cfg.taxMode === "included" ? c.inclVat : c.finalP;
  const stateText = (s: string) => ({ held: he ? "שמור זמנית" : "On hold", booked: he ? "תפוס" : "Booked", blocked: he ? "לא זמין" : "Unavailable", past: he ? "עבר" : "Past", members_only: c.members })[s] ?? "";
  const dayLabel = (k: string) => fmtLong(k, lang).replace(/\s\d{4}$/, "");
  const when = chosen && end !== null ? `${dayLabel(chosen.day)} · ${range(chosen.start, end)}` : c.noTime;
  const total = chosen ? money(chosen.total) + (cfg.taxMode === "added" ? ` ${c.inclVatShort}` : "") : "";
  const steps = [c.stTime, c.stDetails, c.stDone];
  const stepIdx = step === "pick" ? 0 : step === "details" ? 1 : 2;

  async function loadPkg(p: string) {
    const rows = await fetchSlots(supabase, room.id, today, DAYS, p);
    setSlotsBy((s) => ({ ...s, [p]: rows }));
  }
  const pickPkg = (p: Pkg) => {
    setPkg(p.id);
    setStart(null);
    setErr("");
    setHint(false);
    if (!slotsBy[p.id]) void loadPkg(p.id);
  };

  async function book(userId: string) {
    if (!chosen || end === null || !userId) return;
    setBusy(true);
    setErr("");
    const hold = await supabase.rpc("create_hold", { p_room: room.id, p_date: chosen.day, p_start: chosen.start, p_end: end, p_source: "lp-room", p_utm: getUtm() });
    const h = (hold.data ?? {}) as { err?: string; booking?: { id: string } };
    if (hold.error || h.err || !h.booking) {
      const code = hold.error ? "gen" : h.err ?? "gen";
      setBusy(false);
      setErr(errText(code, lang, cfg.cancelHours));
      if (["taken", "slot", "sameday", "lead"].includes(code)) {
        setStep("pick");
        setStart(null);
        if (pkg) void loadPkg(pkg);
      }
      return;
    }
    const req = await supabase.rpc("request_booking", { p_booking: h.booking.id });
    const r = (req.data ?? {}) as { err?: string; booking?: { ref: string; total: number } };
    setBusy(false);
    if (req.error || r.err || !r.booking) {
      setErr(errText(req.error ? "gen" : r.err ?? "gen", lang, cfg.cancelHours));
      return;
    }
    setDone({ ref: r.booking.ref, when, total: money(Number(r.booking.total) || chosen.total) });
    setStep("done");
    track("booking_request_submit", { lp: "meeting_room", value: Number(r.booking.total) || chosen.total, currency: "ILS" });
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // After signing in or up: learn who it is, refresh what the server knows, and send the request once there is a phone number.
  async function afterAuth() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setLocalUid(u.user.id);
    const { data: p } = await supabase.from("profiles").select("phone").eq("id", u.user.id).maybeSingle();
    setPhone(p?.phone ?? "");
    router.refresh();
    if (p?.phone) await book(u.user.id);
  }

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    if (!phoneOk(phone)) return setErr(errText("phone", lang));
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ phone: phone.trim() }).eq("id", uid);
    setBusy(false);
    if (error) return setErr(errText("gen", lang));
    await book(uid);
  }

  const cont = () => {
    if (!chosen) return setHint(true);
    setStep("details");
    setErr("");
    setHint(false);
    track("begin_checkout", { lp: "meeting_room", value: chosen.total, currency: "ILS" });
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const needPhone = !!uid && !phone;
  const pkgTitle = c.pkTitle;

  return (
    <div id="book" className="lp-book">
      <div className="lp-book-top">
        <div>
          <h2>{c.bookT}</h2>
          <p>{c.bookSub}</p>
        </div>
        <div className="lp-price">
          <b>{money(member ? Math.round(room.price * (1 - cfg.memberDiscount) * 100) / 100 : room.price)}</b>
          <span>
            {c.per3k} · {vatNote}
          </span>
        </div>
      </div>
      <ol aria-label={c.stepsAria} className="lp-steps">
        {steps.map((l, i) => (
          <li key={l} className={i <= stepIdx ? "on" : ""} aria-current={i === stepIdx ? "step" : undefined}>
            <i aria-hidden="true" />
            {l}
          </li>
        ))}
      </ol>

      {step === "pick" && (
        <>
          <div className="lp-blk">
            <div className="lp-blk-h">
              <b>{c.pickDay}</b>
              <span>{[...new Set(days.map((d) => parseKey(d.k).toLocaleDateString(loc, { timeZone: "UTC", month: "long" })))].join(" – ")}</span>
            </div>
            <div role="group" aria-label={c.pickDay} className="lp-days">
              {days.map((d) => {
                const ok = d.st === "open";
                const sub = ok ? `${d.free}` : d.st === "closed" ? c.closed : d.st === "full" ? c.full : c.members;
                return (
                  <button
                    key={d.k}
                    type="button"
                    className="lp-day"
                    disabled={!ok}
                    aria-pressed={d.k === date}
                    aria-label={`${dayLabel(d.k)}, ${ok ? `${d.free} ${c.freeAria}` : sub}`}
                    onClick={() => {
                      setPickedDate(d.k);
                      setStart(null);
                      setHint(false);
                      track("select_date", { lp: "meeting_room" });
                    }}
                  >
                    <span className="wd">{parseKey(d.k).toLocaleDateString(loc, { timeZone: "UTC", weekday: he ? "narrow" : "short" })}</span>
                    <b>{parseKey(d.k).getUTCDate()}</b>
                    <span className="s">{sub}</span>
                  </button>
                );
              })}
            </div>
            <p className="lp-note">
              {c.legendNarrow}
              {member ? c.sameDayMem : c.sameDay}
            </p>
            {days.every((d) => d.st !== "open") && <p className="lp-empty soft">{c.noDays}</p>}
          </div>

          <div className="lp-blk">
            <b>{pkgTitle}</b>
            <div role="group" aria-label={pkgTitle} className="lp-pks">
              {packages.map((p) => (
                <button key={p.id} type="button" className="lp-pk" aria-pressed={p.id === pkg} onClick={() => pickPkg(p)}>
                  <b>{he ? p.nameHe : p.nameEn}</b>
                  <span>{p.starts.map((s) => `${pad(s)}–${pad(s + p.hours)}`).join(" · ")}</span>
                  <b>{priceOf(p)}</b>
                </button>
              ))}
            </div>
          </div>

          <div className="lp-blk">
            <b>
              {c.pickTime}
              {date ? ` · ${dayLabel(date)}` : ""}
            </b>
            {!pkg && <p className="lp-empty">{c.pkFirst}</p>}
            {pkg && date && !slots.some((s) => s.state === "free") && <p className="lp-empty soft">{c.noSlots}</p>}
            <div role="group" aria-label={c.pickTime} className="lp-slots">
              {slots.map((s) => {
                const free = s.state === "free";
                return (
                  <button
                    key={s.start}
                    type="button"
                    className="lp-slot"
                    disabled={!free}
                    aria-pressed={free && s.start === start}
                    onClick={() => {
                      setStart(s.start === start ? null : s.start);
                      setHint(false);
                      track("select_time", { lp: "meeting_room" });
                    }}
                  >
                    <b>{range(s.start, s.end)}</b>
                    <span>{free ? money(s.total) : stateText(s.state)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lp-sum">
            <div className="lp-sum-row">
              <span>{when}</span>
              <b>{total}</b>
            </div>
            <button type="button" className="lp-submit dark" onClick={cont} data-cta="continue" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {c.cont}
              <span aria-hidden="true">{arrow}</span>
            </button>
            {hint && (
              <p role="alert" className="lp-err">
                {c.needPick}
              </p>
            )}
          </div>
        </>
      )}

      {step === "details" && (
        <>
          <div className="lp-recap">
            <span>
              <b>{when}</b>
              <small>{total}</small>
            </span>
            <button type="button" className="lp-linkbtn" onClick={() => setStep("pick")}>
              {c.change}
            </button>
          </div>
          {!uid && (
            <>
              <p className="lp-note" style={{ fontSize: 15 }}>
                {c.signInFirst}
              </p>
              <AuthPanel lang={lang} t={t} idp="lp" next={nextPath} onSuccess={afterAuth} start="up" afterEmail={tr(lang, "הקישור יחזיר אתכם לאותו מועד שבחרתם.", "The link brings you back to the slot you chose.")} />
            </>
          )}
          {needPhone && (
            <form onSubmit={savePhone} noValidate className="lp-form">
              <div className="lp-fld">
                <label htmlFor="lp-ph">{c.fPhone}</label>
                <input id="lp-ph" className="lp-in ltr" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" value={phone} onChange={(e) => (setPhone(e.target.value), setErr(""))} />
              </div>
              <p className="lp-note">{c.phoneWhy}</p>
              <button type="submit" className="lp-submit dark" disabled={busy}>
                {busy ? tr(lang, "רגע…", "One moment…") : c.savePhone}
              </button>
            </form>
          )}
          {uid && !needPhone && (
            <div className="lp-form">
              <p className="lp-note" style={{ fontSize: 15 }}>
                {c.bookingAs}
                {viewer?.name || viewer?.email || ""}
                {viewer?.email && viewer?.name ? ` · ${viewer.email}` : ""}
              </p>
              <button type="button" className="lp-submit dark" disabled={busy} onClick={() => void book(uid)} data-cta="send_request">
                {busy ? tr(lang, "רגע…", "One moment…") : c.submitReq}
              </button>
              {/* True while payment is offline: sending the request charges nothing. Remove once online payment goes live. */}
              <p className="lp-note">{tr(lang, "לא מתבצע חיוב כעת.", "You won't be charged now.")}</p>
              {viewer && (
                <button
                  type="button"
                  className="lp-linkbtn"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.refresh();
                  }}
                >
                  {c.notYou}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {step === "done" && done && (
        <div role="status" className="lp-done">
          <span className="ok" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d={CHECK} />
            </svg>
          </span>
          <h3>{c.doneT}</h3>
          <dl className="lp-dl-done">
            <dt>{c.refL}</dt>
            <dd style={{ direction: "ltr", textAlign: "start" }}>{done.ref}</dd>
            <dt>{c.whenL}</dt>
            <dd>{done.when}</dd>
            <dt>{c.totalL}</dt>
            <dd>{done.total}</dd>
          </dl>
          <p>{he ? `שלחנו אישור קבלה. ניצור קשר להשלמת התשלום, וההזמנה תאושר לאחר אימותו. המועד שמור עבורכם ${cfg.requestHours} שעות.` : `We will contact you to complete payment, and the booking is confirmed once it is verified. The time is held for you for ${cfg.requestHours} hours.`}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={bookingPath(lang, done.ref)} className="lp-link light">
              {c.toBooking}
            </Link>
            <Link href={`/${lang}/account`} className="lp-link line">
              {c.toAccount}
            </Link>
          </div>
        </div>
      )}

      {err && (
        <p role="alert" className="lp-err">
          {err}
        </p>
      )}
    </div>
  );
}
