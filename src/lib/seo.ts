import type { Metadata } from "next";
import type { Lang } from "@/i18n";

/** Public address of the site (set NEXT_PUBLIC_SITE_URL in production). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
export const absUrl = (path = "") => (path.startsWith("http") ? path : `${SITE_URL}${path}`);
export const langUrl = (lang: Lang, path = "") => `${SITE_URL}/${lang}${path}`;

/** Canonical address plus the Hebrew and English versions of the same page. */
export function alternatesFor(lang: Lang, path = ""): NonNullable<Metadata["alternates"]> {
  return {
    canonical: langUrl(lang, path),
    languages: { he: langUrl("he", path), en: langUrl("en", path), "x-default": langUrl("he", path) },
  };
}

type PageMeta = { lang: Lang; path?: string; title: string; description: string; image?: string; imageAlt?: string; absoluteTitle?: boolean; noindex?: boolean };

/** Shortens text to at most `max` characters at a word boundary, the length search results show. */
export function clip(text: string, max = 158) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).replace(/[,;:·\-–]+$/, "") + "…";
}

/** Title, description, canonical, hreflang, Open Graph and Twitter tags for one page. */
export function pageMeta({ lang, path = "", title, description, image = "/uploads/og-home.jpg", imageAlt, absoluteTitle, noindex }: PageMeta): Metadata {
  const url = langUrl(lang, path);
  const alt = imageAlt ?? (lang === "he" ? "AOS: משרדים וחדר ישיבות בתל אביב" : "AOS: offices and a meeting room in Tel Aviv");
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: clip(description),
    alternates: alternatesFor(lang, path),
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      siteName: "AOS",
      url,
      title,
      description: clip(description),
      locale: lang === "he" ? "he_IL" : "en_GB",
      alternateLocale: lang === "he" ? ["en_GB"] : ["he_IL"],
      images: [{ url: absUrl(image), width: 1200, height: 630, alt }],
    },
    twitter: { card: "summary_large_image", title, description: clip(description), images: [absUrl(image)] },
  };
}

/** Escapes a JSON-LD payload so it can sit inside a <script> tag. */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
