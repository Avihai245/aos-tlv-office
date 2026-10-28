"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Lang } from "@/i18n";
import { Logo } from "./logo";

export type NavItem = { label: string; href: string; match?: string };

const stripLang = (p: string) => p.replace(/^\/(he|en)(?=\/|$)/, "") || "/";

export function useLangSwap(lang: Lang) {
  const pathname = usePathname();
  const other: Lang = lang === "he" ? "en" : "he";
  const rest = stripLang(pathname);
  const href = `/${other}${rest === "/" ? "" : rest}`;
  const remember = () => {
    document.cookie = `aos_lang=${other}; path=/; max-age=31536000; samesite=lax`;
  };
  return { href, remember };
}

export function LangToggle({ lang, label, aria, variant }: { lang: Lang; label: string; aria: string; variant: "hdr" | "ftr" | "menu" }) {
  const { href, remember } = useLangSwap(lang);
  const cls = variant === "hdr" ? "hdr-ico" : variant === "ftr" ? "ftr-lang" : "";
  if (variant === "menu") {
    return (
      <Link href={href} onClick={remember} hrefLang={lang === "he" ? "en" : "he"} className="lang-menu" aria-label={aria}>
        {label}
      </Link>
    );
  }
  return (
    <Link href={href} onClick={remember} hrefLang={lang === "he" ? "en" : "he"} aria-label={aria} className={cls} style={variant === "ftr" ? { display: "inline-flex", alignItems: "center" } : undefined}>
      {label}
    </Link>
  );
}

function isCurrent(pathname: string, item: NavItem) {
  const p = stripLang(pathname);
  if (!item.match) return false;
  return p === item.match || p.startsWith(item.match + "/");
}

export function HeaderNav({ items, aria }: { items: NavItem[]; aria: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={aria} className="hdr-nav">
      {items.map((n) => (
        <Link key={n.label} href={n.href} aria-current={isCurrent(pathname, n) ? "page" : undefined}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileHeader({
  lang,
  items,
  bookHref,
  accountHref,
  labels,
}: {
  lang: Lang;
  items: NavItem[];
  bookHref: string;
  accountHref: string;
  labels: { navAria: string; navBook: string; navBookS: string; menu: string; langFull: string; langAria: string; account: string };
}) {
  const pathname = usePathname();
  // The menu is open for a specific path, so navigating anywhere closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const { href: langHref, remember } = useLangSwap(lang);
  const onRoom = stripLang(pathname).startsWith("/room");
  const arrow = lang === "he" ? "←" : "→";

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="hdr-mob">
        <Logo lang={lang} small />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!onRoom && (
            <Link href={bookHref} className="hdr-book s">
              {labels.navBookS}
            </Link>
          )}
          <button
            type="button"
            className="menu-btn"
            onClick={() => setOpenAt(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="mnav"
            aria-label={labels.menu}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.75, strokeLinecap: "round" }} aria-hidden="true">
              <path d={open ? "M18 6 6 18M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mnav" aria-label={labels.navAria} className="mnav">
          {[...items, { label: labels.account, href: accountHref, match: "/account" }].map((n) => (
            <Link key={n.label} href={n.href} className="item" aria-current={isCurrent(pathname, n) ? "page" : undefined}>
              {n.label}
              <span aria-hidden="true" style={{ color: "var(--g2)" }}>
                {arrow}
              </span>
            </Link>
          ))}
          <div className="foot">
            <Link href={bookHref} className="book">
              {labels.navBook}
            </Link>
            <button type="button" onClick={() => { remember(); window.location.assign(langHref); }}>
              {labels.langFull}
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
