import Link from "next/link";
import type { Dict, Lang } from "@/i18n";
import { tr } from "@/i18n";
import { fmtDate, money } from "@/lib/format";
import type { Room, Settings, Viewer } from "@/lib/types";

const CHECK = "M20 6 9 17l-5-5";

export function MembershipBanner({
  lang,
  t,
  room,
  settings,
  viewer,
  solid,
}: {
  lang: Lang;
  t: Dict;
  room: Room | undefined;
  settings: Settings;
  viewer: Viewer | null;
  solid?: boolean;
}) {
  const arrow = lang === "he" ? "←" : "→";
  const rp = room?.price ?? 0;
  const save = Math.round(rp * settings.memberDiscount * 100) / 100;
  const pct = Math.round(settings.memberDiscount * 100);
  const benefits = tr(
    lang,
    [`${pct}% הנחה על כל הזמנה של חדר הישיבות`, "תיאום מהרגע להרגע, כולל הזמנה לאותו היום, לפי מקום פנוי", "ההנחה מופעלת אוטומטית בכל הזמנה"],
    [`${pct}% off every meeting-room booking`, "Book at the last minute, including same day, subject to availability", "The discount applies automatically to every booking"],
  );
  const example =
    rp > 0
      ? tr(
          lang,
          `בלוק של 3 שעות: ${money(rp - save)} במקום ${money(rp)}. חוסכים ${money(save)} בכל הזמנה.`,
          `A 3-hour block: ${money(rp - save)} instead of ${money(rp)}. Save ${money(save)} every time.`,
        )
      : "";
  const until = viewer?.memberUntil ? fmtDate(viewer.memberUntil, lang, { day: "numeric", month: "long", year: "numeric" }) : "";
  const onSub = tr(
    lang,
    `ההנחה של ${pct}% מופעלת אוטומטית בהזמנות שלכם.${until ? ` בתוקף עד ${until}.` : ""}`,
    `Your ${pct}% discount applies automatically.${until ? ` Valid until ${until}.` : ""}`,
  );

  return (
    <div className={solid ? "mem mem-solid" : "mem"}>
      {viewer?.isMember ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14, gridColumn: "1/-1" }}>
          <span style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--gold)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
              <path d={CHECK} />
            </svg>
          </span>
          <div>
            <b style={{ display: "block", fontSize: 20, color: "#fff" }}>{t.memOnT}</b>
            <span style={{ fontSize: 15, color: "#c9cbcf" }}>{onSub}</span>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <span className="mem-badge">{t.memBadge}</span>
            <h3 className="mem-head">{tr(lang, `${pct}% הנחה על כל פגישה`, `${pct}% off every meeting`)}</h3>
            <ul className="mem-list">
              {benefits.map((x) => (
                <li key={x}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", flex: "none", marginTop: 3, color: "var(--gold)" }} aria-hidden="true">
                    <path d={CHECK} />
                  </svg>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="mem-card">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, direction: "ltr", color: "#fff" }}>{money(settings.memberPrice)}</b>
              <span style={{ fontSize: 16, color: "#d7d8da" }}>{t.memPer}</span>
            </div>
            {example && <p style={{ margin: 0, fontSize: 15, color: "#d7d8da" }}>{example}</p>}
            <Link href={`/${lang}/membership`} className="btn btn-gold on-dark" style={{ height: 56, fontSize: 17, borderRadius: 14 }}>
              {t.memCta}
              <span aria-hidden="true">{arrow}</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
