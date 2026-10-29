import Link from "next/link";
import type { Dict, Lang } from "@/i18n";
import { tr } from "@/i18n";
import { contactLinks, siteText } from "@/lib/contact";
import type { SiteContent, Viewer } from "@/lib/types";
import { LangToggle } from "./header-client";
import { navItems } from "./site-header";

export function SiteFooter({ lang, t, c, viewer, bookHref }: { lang: Lang; t: Dict; c: SiteContent; viewer: Viewer | null; bookHref: string }) {
  const s = siteText(c, lang);
  const links = contactLinks(c);
  const nav1 = navItems(lang, t, bookHref);
  // Two groups of links: the pages of the site (with the account) and the information pages.
  const site = [...nav1, { label: viewer ? t.myAcc : t.signInL, href: `/${lang}/account` }];
  const info = [
    { label: t.nFaq, href: `/${lang}#faq` },
    { label: t.privacy, href: `/${lang}/privacy` },
    { label: t.terms, href: `/${lang}/terms` },
    { label: tr(lang, "הצהרת נגישות", "Accessibility statement"), href: `/${lang}/accessibility` },
  ];
  return (
    <footer className="ftr">
      <div className="ftr-in">
        <div className="ftr-top">
          <span className="ftr-logo">AOS</span>
          <address>
            <span className="ad">{s.address}</span>
            <span>
              {s.hoursA}
              <i aria-hidden="true"> · </i>
              {s.hoursB}
            </span>
            {links.length > 0 && (
              <span className="ct">
                {links.map((l) => (
                  <a key={l.href} href={l.href} target={l.target} rel="noopener">
                    {l.label}
                  </a>
                ))}
              </span>
            )}
          </address>
          <div className="ftr-act">
            <Link href={bookHref} className="ftr-book">
              {t.navBook}
            </Link>
            <LangToggle lang={lang} label={t.langFull} aria={t.langAria} variant="ftr" />
          </div>
        </div>
        <div className="ftr-bot">
          <nav aria-label={t.footAria}>
            {site.map((n) => (
              <Link key={n.label} href={n.href}>
                {n.label}
              </Link>
            ))}
          </nav>
          <nav aria-label={t.footAria2} className="legal">
            {info.map((n) => (
              <Link key={n.label} href={n.href}>
                {n.label}
              </Link>
            ))}
          </nav>
          <p className="copy">© AOS</p>
        </div>
      </div>
    </footer>
  );
}
