import Link from "next/link";
import { headers } from "next/headers";
import { getT, isLang } from "@/i18n";

export default async function NotFound() {
  const h = await headers();
  const seg = (h.get("x-pathname") || "").split("/")[1] ?? "";
  const lang = isLang(seg) ? seg : "he";
  const t = getT(lang);
  return (
    <section className="center-page">
      <h1>{t.nf}</h1>
      <Link href={`/${lang}`} className="btn btn-dark" style={{ height: 52, padding: "0 24px" }}>
        {t.home}
      </Link>
    </section>
  );
}
