import Link from "next/link";
import type { Dict, Lang } from "@/i18n";
import { tr } from "@/i18n";
import type { Viewer } from "@/lib/types";
import { HeaderNav, LangToggle, MobileHeader, type NavItem } from "./header-client";
import { Logo } from "./logo";

export function navItems(lang: Lang, t: Dict, bookHref: string): NavItem[] {
  return [
    { label: t.nRooms, href: bookHref, match: "/room" },
    { label: t.nOff, href: `/${lang}/offices`, match: "/offices" },
    { label: t.nComplex, href: `/${lang}#complex` },
    { label: t.nLocCon, href: `/${lang}#location` },
  ];
}

export function SiteHeader({ lang, t, viewer, bookHref }: { lang: Lang; t: Dict; viewer: Viewer | null; bookHref: string }) {
  const items = navItems(lang, t, bookHref);
  const account = viewer ? tr(lang, "האזור שלי", "My area") : t.signInL;
  const accountHref = `/${lang}/account`;
  return (
    <header className="hdr">
      <div className="only-desk">
        <div className="hdr-desk">
          <div style={{ justifySelf: "start" }}>
            <Logo lang={lang} />
          </div>
          <HeaderNav items={items} aria={t.navAria} />
          <div className="hdr-tools">
            <LangToggle lang={lang} label={t.langBtn} aria={t.langAria} variant="hdr" />
            <Link href={accountHref} className="hdr-ico" style={{ fontWeight: 500 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" }} aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
              {account}
            </Link>
            <Link href={bookHref} className="hdr-book">
              {t.navBook}
            </Link>
          </div>
        </div>
      </div>
      <div className="only-mob">
        <MobileHeader
          lang={lang}
          items={items}
          bookHref={bookHref}
          accountHref={accountHref}
          labels={{ navAria: t.navAria, navBook: t.navBook, navBookS: t.navBookS, menu: t.menu, langFull: t.langFull, langAria: t.langAria, account }}
        />
      </div>
    </header>
  );
}
