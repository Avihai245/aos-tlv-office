import type { Dict, Lang } from "@/i18n";
import { addDays, fmtDayMonth, fmtDow, fmtLong, fmtShort, hm, range, todayKey } from "./format";
import type { Slot } from "./types";

export const freeSlots = (slots: Slot[]) => slots.filter((s) => s.state === "free");

export function freeByDay(slots: Slot[]) {
  const m = new Map<string, Slot[]>();
  for (const s of freeSlots(slots)) m.set(s.day, [...(m.get(s.day) ?? []), s]);
  return m;
}

export function nextFree(slots: Slot[]) {
  const f = freeSlots(slots)[0];
  return f ? { day: f.day, start: f.start, end: f.end } : null;
}

export function availOf(slots: Slot[], t: Dict, lang: Lang) {
  const n = nextFree(slots);
  if (!n) return { dot: "#8a8478", avail: t.availNone, n };
  if (n.day === todayKey()) return { dot: "#3c7a52", avail: t.availToday + " · " + hm(n.start), n };
  return { dot: "#b8995a", avail: t.availFrom + fmtShort(n.day, lang), n };
}

export function dayLabel(key: string, t: Dict, lang: Lang) {
  const today = todayKey();
  if (key === today) return t.today;
  if (key === addDays(today, 1)) return t.tomorrow;
  return fmtShort(key, lang);
}

export function heroDates(slots: Slot[], t: Dict, lang: Lang, hrefOf: (day: string) => string, max = 5) {
  const today = todayKey();
  const out: { href: string; dow: string; day: string; sub: string; aria: string }[] = [];
  for (const [day, list] of freeByDay(slots)) {
    if (out.length >= max) break;
    const n = list.length;
    out.push({
      href: hrefOf(day),
      dow: day === today ? t.today : day === addDays(today, 1) ? t.tomorrow : fmtDow(day, lang),
      day: fmtDayMonth(day, lang),
      sub: `${n} ${n === 1 ? t.free1 : t.freeN}`,
      aria: `${fmtLong(day, lang)} · ${n} ${t.freeN}`,
    });
  }
  return out;
}

export function nextSlotLinks(slots: Slot[], t: Dict, lang: Lang, hrefOf: (s: Slot) => string, max = 4) {
  return freeSlots(slots)
    .slice(0, max)
    .map((s) => ({
      href: hrefOf(s),
      day: dayLabel(s.day, t, lang),
      time: range(s.start, s.end),
      aria: `${fmtLong(s.day, lang)} ${hm(s.start)}–${hm(s.end)}`,
    }));
}
