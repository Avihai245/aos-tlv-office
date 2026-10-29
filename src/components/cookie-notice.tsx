"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { tr, type Lang } from "@/i18n";

const KEY = "aos_cookie_notice";

/**
 * Informational notice for the cookies the site itself sets. It collects nothing and changes nothing: the only things stored in the
 * browser are the sign-in, the chosen language and the accessibility settings, all needed to run the site. If analytics or advertising
 * tags are ever added, this has to become a real consent prompt with an equally prominent "reject" choice.
 */
export function CookieNotice({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);

  // Shown after the page has loaded, so it never competes with the first paint.
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Private mode: the notice simply comes back on the next visit.
    }
    setOpen(false);
  };

  return (
    <section className="cookie-note" role="region" aria-label={tr(lang, "הודעת עוגיות", "Cookie notice")}>
      <p>
        {tr(lang, "האתר משתמש בעוגיות הכרחיות בלבד, ללא פרסום או מעקב.", "This site uses only essential cookies, with no advertising or tracking.")}{" "}
        <Link href={`/${lang}/privacy`}>{tr(lang, "מדיניות פרטיות", "Privacy policy")}</Link>
      </p>
      <button type="button" onClick={close}>
        {tr(lang, "הבנתי", "Got it")}
      </button>
    </section>
  );
}
