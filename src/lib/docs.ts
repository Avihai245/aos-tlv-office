import docs from "@/i18n/docs.json";
import type { Lang } from "@/i18n";
import { fixRanges } from "./format";
import type { Settings } from "./types";

export type DocKind = "privacy" | "terms" | "accessibility";
type Item = { hHe: string; hEn: string; pHe: string; pEn: string };

/** Policy texts from the design, with the business details and booking rules filled in from settings. */
export function docItems(kind: DocKind, lang: Lang, settings: Settings): { h: string; p: string }[] {
  const c = settings.content;
  const he = lang === "he";
  const contact = [c.email ? (he ? "אימייל: " : "Email: ") + c.email : "", c.phone ? (he ? "טלפון: " : "Phone: ") + c.phone : ""].filter(Boolean).join(" · ");
  const fill = (s: string) =>
    s
      .replaceAll("{address}", (he ? c.addressHe : c.addressEn) || (he ? "תל אביב" : "Tel Aviv"))
      .replaceAll("{biz}", "AOS")
      .replaceAll("{pcl}", contact)
      .replaceAll("{cl}", contact)
      .replaceAll("{co}", contact)
      .replaceAll("{holdMinutes}", String(settings.holdMinutes))
      .replaceAll("{requestHours}", String(settings.requestHours))
      .replaceAll("{cancelHours}", String(settings.cancelHours));

  let items: Item[];
  if (kind === "terms") {
    items = docs.terms.slice();
    items[0] = {
      hHe: "חבילות הזמנה",
      hEn: "Booking packages",
      pHe: "הזמנת חדר הישיבות נעשית בחבילות: 3 שעות (09–12, 12–15 או 15–18), חצי יום של 5 שעות (09–14 או 13–18) או יום מלא (09:00–18:00), לפי הזמינות המוצגת ביומן החדר.",
      pEn: "The meeting room is booked in packages: 3 hours (09–12, 12–15 or 15–18), a 5-hour half day (09–14 or 13–18) or a full day (09:00–18:00), as shown on the room calendar.",
    };
  } else {
    const set = kind === "privacy" ? docs.privacy : docs.a11y;
    items = contact ? set.with : set.without;
  }
  return items.map((x) => ({ h: fill(he ? x.hHe : x.hEn), p: fixRanges(fill(he ? x.pHe : x.pEn)) }));
}
