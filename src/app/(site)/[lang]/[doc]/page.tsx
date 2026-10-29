import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT, isLang, tr, type Lang } from "@/i18n";
import { getSite } from "@/lib/data";
import { docItems, type DocKind } from "@/lib/docs";
import { pageMeta } from "@/lib/seo";

const KINDS: DocKind[] = ["privacy", "terms", "accessibility"];
const isKind = (x: string): x is DocKind => (KINDS as string[]).includes(x);

const titleOf = (kind: DocKind, lang: Lang) => {
  const t = getT(lang);
  return kind === "privacy" ? t.privacy : kind === "terms" ? t.terms : t.a11yStmt;
};

export function generateStaticParams() {
  return KINDS.flatMap((doc) => (["he", "en"] as const).map((lang) => ({ lang, doc })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[doc]">): Promise<Metadata> {
  const { lang, doc } = await params;
  if (!isLang(lang) || !isKind(doc)) return {};
  const he = lang === "he";
  const description =
    doc === "privacy"
      ? he ? "מדיניות הפרטיות של AOS: איזה מידע נאסף, לשם מה, עם מי הוא משותף ומה הזכויות שלכם." : "AOS privacy policy: what we collect, why, who we share it with and your rights."
      : doc === "terms"
        ? he ? "תנאי ההזמנה של חדר הישיבות ב־AOS: חבילות, אישור הזמנה, ביטול ומחירים." : "Booking terms for the AOS meeting room: packages, confirmation, cancellation and prices."
        : he ? "הצהרת הנגישות של אתר AOS ושל המתחם: רמת הנגישות, התאמות ופנייה בנושא נגישות." : "Accessibility statement for the AOS website and premises: level, adjustments and how to report an issue.";
  return pageMeta({ lang, path: `/${doc}`, title: titleOf(doc, lang), description });
}

export default async function DocPage({ params }: PageProps<"/[lang]/[doc]">) {
  const { lang, doc } = await params;
  if (!isLang(lang) || !isKind(doc)) notFound();
  const { settings } = await getSite();
  const items = docItems(doc, lang, settings);
  return (
    <article aria-labelledby="doc-h" className="doc">
      <h1 id="doc-h">{titleOf(doc, lang)}</h1>
      {items.map((d) => (
        <section key={d.h}>
          <h2>{d.h}</h2>
          <p>{d.p}</p>
        </section>
      ))}
      <p style={{ marginTop: 8, fontSize: 14, color: "var(--g2)" }}>{tr(lang, "עדכון אחרון: 28 באוקטובר 2026", "Last updated: 28 October 2026")}</p>
    </article>
  );
}
