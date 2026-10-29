import Link from "next/link";
import type { Lang } from "@/i18n";

type Head = { skip: string; langBtn: string; langAria: string; ctaTop: string };
type Foot = { footAria: string; toSite: string; privacy: string; a11y: string; terms?: string };

/** Page header of a landing page: the logo (back to the site), the language switch and the one action. */
export function LpHeader({ lang, c, ctaHref, langHref }: { lang: Lang; c: Head; ctaHref: string; langHref: string }) {
  const other = lang === "he" ? "en" : "he";
  return (
    <>
      <a href={ctaHref} className="lp-skip">
        {c.skip}
      </a>
      <header className="lp-hdr">
        <div className="lp-wrap">
          <Link href={`/${lang}`} aria-label="AOS" className="lp-logo">
            AOS
          </Link>
          <div className="lp-hdr-act">
            <a href={langHref} className="lp-lang" hrefLang={other} lang={other} aria-label={`${c.langBtn} · ${c.langAria}`}>
              {c.langBtn}
            </a>
            <a href={ctaHref} className="lp-pill" data-cta="header">
              {c.ctaTop}
            </a>
          </div>
        </div>
      </header>
    </>
  );
}

export function LpFooter({ lang, c }: { lang: Lang; c: Foot }) {
  return (
    <footer className="lp-ftr">
      <div className="lp-wrap">
        <span className="lp-ftr-logo">AOS</span>
        <nav aria-label={c.footAria}>
          <Link href={`/${lang}`}>{c.toSite}</Link>
          {c.terms && <Link href={`/${lang}/terms`}>{c.terms}</Link>}
          <Link href={`/${lang}/privacy`}>{c.privacy}</Link>
          <Link href={`/${lang}/accessibility`}>{c.a11y}</Link>
        </nav>
      </div>
    </footer>
  );
}

/** The same page in the other language, keeping the campaign tags and any selection in the address. */
export function otherLangHref(lang: Lang, slug: string, sp: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, x);
  const s = q.toString();
  return `/${lang === "he" ? "en" : "he"}/lp/${slug}${s ? `?${s}` : ""}`;
}
