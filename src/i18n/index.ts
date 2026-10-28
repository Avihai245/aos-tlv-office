import he from "./he.json";
import en from "./en.json";
import tables from "./tables.json";

export type Lang = "he" | "en";
export const LANGS: Lang[] = ["he", "en"];
export type Dict = Record<keyof typeof he, string>;

const dicts: Record<Lang, Dict> = { he, en };

export const isLang = (x: string): x is Lang => x === "he" || x === "en";
export const getT = (lang: Lang): Dict => dicts[lang];
export const dirOf = (lang: Lang) => (lang === "he" ? "rtl" : "ltr");

type Pair = { he: string; en: string };
const pick = (p: Pair | undefined, lang: Lang, fallback = "") => (p ? p[lang] : fallback);

export const errText = (code: string, lang: Lang, hours?: number) => {
  const e = (tables.err as Record<string, Pair>)[code] ?? tables.err.gen;
  return pick(e, lang).replace("{h}", String(hours ?? ""));
};
export const statusText = (s: string, lang: Lang) => pick((tables.status as Record<string, Pair>)[s], lang, s);
export const payText = (s: string, lang: Lang) => pick((tables.pay as Record<string, Pair>)[s], lang, s);
export const officeStatusText = (s: string, lang: Lang) => pick((tables.office as Record<string, Pair>)[s], lang, s);
export const privacyDoc = (lang: Lang) =>
  tables.priv.map((x) => ({ h: lang === "he" ? x.hHe : x.hEn, p: lang === "he" ? x.pHe : x.pEn }));

/** Pick the Hebrew or English variant of a bilingual pair. */
export const tr = <T,>(lang: Lang, he: T, en: T): T => (lang === "he" ? he : en);
