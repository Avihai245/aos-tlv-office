import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT, isLang, tr, type Lang } from "@/i18n";
import { getSite } from "@/lib/data";
import { docItems, type DocKind } from "@/lib/docs";

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
  return { title: titleOf(doc, lang) };
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
