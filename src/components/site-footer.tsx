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
  const nav2 = [
    { label: viewer ? t.myAcc : t.signInL, href: `/${lang}/account` },
    { label: t.nFaq, href: `/${lang}#faq` },
    { label: t.privacy, href: `/${lang}/privacy` },
    { label: t.terms, href: `/${lang}/terms` },
    { label: tr(lang, "הצהרת נגישות", "Accessibility statement"), href: `/${lang}/accessibility` },
  ];
  return (
    <footer className="ftr">
      <div className="ftr-in">
        <div className="ftr-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="ftr-logo">AOS</span>
            <address>
              <span style={{ color: "#fff" }}>{s.address}</span>
              <span>{s.hoursA}</span>
              <span>{s.hoursB}</span>
              {links.map((l) => (
                <a key={l.href} href={l.href} target={l.target} rel="noopener">
                  {l.label}
                </a>
              ))}
            </address>
          </div>
          <nav aria-label={t.footAria}>
            <h2>{t.explore}</h2>
            <div>
              {nav1.map((n) => (
                <Link key={n.label} href={n.href}>
                  {n.label}
                </Link>
              ))}
            </div>
          </nav>
          <nav aria-label={t.footAria2}>
            <h2>{t.infoL}</h2>
            <div>
              {nav2.map((n) => (
                <Link key={n.label} href={n.href}>
                  {n.label}
                </Link>
              ))}
            </div>
          </nav>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
            <Link href={bookHref} className="ftr-book">
              {t.navBook}
            </Link>
            <LangToggle lang={lang} label={t.langFull} aria={t.langAria} variant="ftr" />
          </div>
        </div>
        <p className="copy">© AOS</p>
      </div>
    </footer>
  );
}
