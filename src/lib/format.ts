import type { Lang } from "@/i18n";

export const TZ = "Asia/Jerusalem";

export const pad = (n: number) => String(n).padStart(2, "0");
export const money = (n: number | null | undefined) =>
  "₪" + (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const hm = (h: number) => pad(Math.floor(h)) + ":" + pad(Math.round((h % 1) * 60));
/** Wraps a left-to-right fragment (time ranges, numbers) so it renders intact inside Hebrew text. */
export const iso = (s: string) => "⁦" + s + "⁩";
export const range = (a: number, b: number) => iso(hm(a) + "–" + hm(b));
/** Keeps clock ranges such as 09:00–12:00 or 09–12 in reading order inside right-to-left text. */
export const fixRanges = (s: string) => s.replace(/\d{2}(?::\d{2})?\s?[–-]\s?\d{2}(?::\d{2})?/g, (m) => iso(m));

const locOf = (lang: Lang) => (lang === "he" ? "he-IL" : "en-GB");

/** Day keys are plain "YYYY-MM-DD" strings, anchored to UTC noon so DST never shifts them. */
export const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};
export const keyOf = (d: Date) => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
export const addDays = (k: string, n: number) => {
  const d = parseKey(k);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
};
export const dowOf = (k: string) => parseKey(k).getUTCDay();

/** Today's date and clock in Israel, regardless of the server or browser time zone. */
export const nowIL = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return { key: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) + Number(g("minute")) / 60 };
};
export const todayKey = () => nowIL().key;

const fmt = (k: string, lang: Lang, o: Intl.DateTimeFormatOptions) =>
  parseKey(k).toLocaleDateString(locOf(lang), { timeZone: "UTC", ...o });
export const fmtLong = (k: string, lang: Lang) => fmt(k, lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const fmtShort = (k: string, lang: Lang) => fmt(k, lang, { weekday: "short", day: "numeric", month: "short" });
export const fmtMonth = (k: string, lang: Lang) => fmt(k, lang, { month: "long", year: "numeric" });
export const fmtDow = (k: string, lang: Lang, weekday: "short" | "narrow" = "short") => fmt(k, lang, { weekday });
export const fmtDayMonth = (k: string, lang: Lang) => fmt(k, lang, { day: "numeric", month: "short" });
export const fmtMon = (k: string, lang: Lang) => fmt(k, lang, { month: "short" });
export const fmtDate = (iso: string, lang: Lang, o: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleDateString(locOf(lang), { timeZone: TZ, ...o });
export const fmtDateTime = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleString(locOf(lang), { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
export const phoneOk = (p: string) => p.replace(/\D/g, "").length >= 9;

/** Images are stored as "uploads/x.jpg" in the database; serve them from /public. */
export const imgSrc = (s: string) => (s.startsWith("/") || s.startsWith("http") ? s : "/" + s);

/** Splits an ISO timestamp into its Israel-local date key and decimal hour. */
export function localParts(isoStr: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(isoStr));
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) + Number(g("minute")) / 60 };
}
