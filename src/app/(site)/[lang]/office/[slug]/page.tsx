import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { OfficeGallery } from "@/components/office-gallery";
import { OfficeInquiry } from "@/components/office-inquiry";
import { getT, isLang } from "@/i18n";
import { getSite } from "@/lib/data";
import { imgSrc, money } from "@/lib/format";
import { isUuid, officePath } from "@/lib/urls";
import { JsonLd } from "@/components/json-ld";
import { siteText } from "@/lib/contact";
import { breadcrumbSchema, graph, officeSchema } from "@/lib/schema";
import { langUrl, pageMeta } from "@/lib/seo";
import { officeOpen, officeView } from "@/lib/office-view";

export async function generateMetadata({ params }: PageProps<"/[lang]/office/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const { offices, settings } = await getSite();
  const o = offices.find((x) => x.slug === slug);
  if (!o) return {};
  const he = lang === "he";
  const name = he ? o.nameHe : o.nameEn;
  const amen = (he ? o.amenitiesHe : o.amenitiesEn).join(", ");
  const address = siteText(settings.content, lang).address;
  return pageMeta({
    lang,
    path: `/office/${o.slug}`,
    title: he ? `${name} · משרד פרטי להשכרה בתל אביב` : `${name} · Private office for rent in Tel Aviv`,
    description: he
      ? `${name} ב${address}: ${amen}.${o.price ? ` שכירות חודשית ${money(o.price)}${o.mgmtFee ? ` + ${money(o.mgmtFee)} דמי ניהול` : ""} + מע״מ.` : ""} אפשר לקבוע סיור.`
      : `${name} at ${address}: ${amen}.${o.price ? ` Monthly rent ${money(o.price)}${o.mgmtFee ? ` + ${money(o.mgmtFee)} management fee` : ""} + VAT.` : ""} Tours on request.`,
    // The share card is a branded 1200x630 image under 100 KB; raw office photos can be several MB and WhatsApp skips those.
    image: `/uploads/og-home-${lang}.jpg`,
    imageAlt: `${name}: ${he ? "משרד פרטי להשכרה בתל אביב" : "private office for rent in Tel Aviv"}`,
  });
}

export default async function OfficePage({ params }: PageProps<"/[lang]/office/[slug]">) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  const he = lang === "he";
  const arrow = he ? "←" : "→";
  const { offices } = await getSite();
  const o = offices.find((x) => x.slug === slug);
  if (!o) {
    // A link shared before the readable addresses existed: send it to the new address.
    const old = isUuid(slug) ? offices.find((x) => x.id === slug) : undefined;
    if (old) permanentRedirect(officePath(lang, old));
    notFound();
  }
  const v = officeView(o, lang, t);
  const open = officeOpen(o);
  const priced = (o.price ?? 0) > 0;
  const fee = (o.mgmtFee ?? 0) > 0;
  const images = o.images.map((g) => ({ src: imgSrc(g.src), alt: (he ? g.he : g.en) || v.name }));
  const desc = he ? o.descHe : o.descEn;
  const rows: { k: string; v: React.ReactNode }[] = [{ k: he ? "שכירות" : "Rent", v: <b style={{ fontWeight: 600 }}>{v.rent}</b> }];
  if (priced && fee) {
    rows.push({ k: he ? "דמי ניהול" : "Management fee", v: `${money(o.mgmtFee)} ${t.monthly}` });
  }

  return (
    <section aria-labelledby="ofc-h" style={{ animation: "aosFade .3s both" }}>
      <JsonLd
        data={graph(
          officeSchema(lang, o, langUrl(lang, `/office/${o.slug}`)),
          breadcrumbSchema([
            { name: t.home, path: "", lang },
            { name: t.nOff, path: "/offices", lang },
            { name: v.name, path: `/office/${o.slug}`, lang },
          ]),
        )}
      />
      <div className="wrap" style={{ paddingTop: "clamp(16px,2vw,24px)", paddingBottom: "clamp(56px,7vw,96px)" }}>
        <nav aria-label={t.crumbAria} className="crumb" style={{ marginBottom: 16 }}>
          <Link href={`/${lang}`}>{t.home}</Link>
          <span aria-hidden="true" style={{ margin: "0 8px" }}>/</span>
          <Link href={`/${lang}/offices`}>{t.nOff}</Link>
          <span aria-hidden="true" style={{ margin: "0 8px" }}>/</span>
          <span aria-current="page">{v.name}</span>
        </nav>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))", gap: "clamp(24px,4vw,56px)", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            {images.length ? (
              <OfficeGallery items={images} />
            ) : (
              <div style={{ aspectRatio: "4 / 3", borderRadius: 16, background: "#f1f1f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#45494f" }}>
                <b style={{ fontSize: 64, fontWeight: 600, lineHeight: 1, direction: "ltr" }}>{v.idx}</b>
                <span style={{ fontSize: 16 }}>{t.officePhotoSoon}</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <span style={{ fontSize: 14, color: "var(--g2)", direction: "ltr", display: "inline-block" }}>{o.code}</span>
              <h1 id="ofc-h" style={{ margin: "4px 0 0", fontSize: "clamp(30px,3.4vw,44px)", fontWeight: 700, lineHeight: 1.12 }}>
                {v.name}
              </h1>
              <span className={`pill ${v.pill}`} style={{ display: "inline-block", marginTop: 12, fontSize: 14, padding: "5px 12px" }}>
                {v.status}
              </span>
            </div>
            {desc && <p style={{ margin: 0, fontSize: 17, color: "var(--g1)" }}>{desc}</p>}
            <dl className="kv where" style={{ margin: 0 }}>
              {rows.map((r) => (
                <div key={r.k}>
                  <dt>{r.k}</dt>
                  <dd>{r.v}</dd>
                </div>
              ))}
              <div>
                <dt>{t.amen}</dt>
                <dd style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {v.amenList.map((a) => (
                    <span key={a}>{a}</span>
                  ))}
                </dd>
              </div>
            </dl>
            <div className="con-card">
              {open ? (
                <OfficeInquiry lang={lang} t={t} officeId={o.id} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
                  <p style={{ margin: 0 }}>{t.offNA}</p>
                  <Link href={`/${lang}#contact`} className="btn btn-out" style={{ height: 48, padding: "0 20px", fontSize: 16, borderRadius: 12, gap: 8 }}>
                    {t.generalInq}
                    <span aria-hidden="true">{arrow}</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
