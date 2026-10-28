import Link from "next/link";
import type { Lang } from "@/i18n";

export function Logo({ lang, small }: { lang: Lang; small?: boolean }) {
  return (
    <Link href={`/${lang}`} aria-label="AOS" className={small ? "logo sm" : "logo"}>
      <span className="logo-in">
        <span className="logo-mark" aria-hidden="true">
          <span>A</span>
          <span>O</span>
          <span>S</span>
        </span>
        <span className="logo-sub" aria-hidden="true">
          <span>OFFICES</span>
          <span>·</span>
          <span>MEETINGS</span>
        </span>
      </span>
    </Link>
  );
}
