import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT, isLang, tr } from "@/i18n";
import { getSite } from "@/lib/data";
import { officeView } from "@/lib/office-view";

export async function generateMetadata({ params }: PageProps<"/[lang]/offices">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: getT(lang).offsTitle };
}

export default async function Offices({ params, searchParams }: PageProps<"/[lang]/offices">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const t = getT(lang);
  const arrow = lang === "he" ? "←" : "→";
  const { offices } = await getSite();
  const onlyAvail = sp.f === "avail";
  const availCount = offices.filter((o) => o.status === "available").length;
  const anySet = offices.some((o) => o.status !== "unset");
  const list = offices.filter((o) => !onlyAvail || o.status === "available");
  const summary = anySet
    ? tr(lang, `${availCount} מתוך ${offices.length} משרדים פנויים`, `${availCount} of ${offices.length} offices available`)
    : tr(lang, `${offices.length} משרדים פרטיים`, `${offices.length} private offices`);
  const filters = [
    { key: "all", label: t.fAll, on: !onlyAvail },
    { key: "avail", label: t.fAvail, on: onlyAvail },
  ];

  return (
    <section aria-labelledby="offs-h" style={{ animation: "aosFade .3s both" }}>
      <div className="wrap" style={{ paddingTop: "clamp(16px,2vw,24px)", paddingBottom: "clamp(56px,7vw,96px)" }}>
        <nav aria-label={t.crumbAria} className="crumb">
          <Link href={`/${lang}`}>{t.home}</Link>
          <span aria-hidden="true" style={{ margin: "0 8px" }}>
            /
          </span>
          <span aria-current="page">{t.nOff}</span>
        </nav>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 32px", flexWrap: "wrap", marginBottom: 24 }}>
          <div style={{ maxWidth: 680 }}>
            <h1 id="offs-h" style={{ margin: 0, fontSize: "clamp(30px,3.4vw,44px)", fontWeight: 700, lineHeight: 1.12, letterSpacing: "-.01em" }}>
              {t.offsTitle}
            </h1>
            <p style={{ margin: "12px 0 0", color: "var(--g1)" }}>{t.offsIntro}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div role="group" aria-label={t.filter} className="seg" style={{ gap: 6 }}>
              {filters.map((f) => (
                <Link
                  key={f.key}
                  href={f.key === "all" ? `/${lang}/offices` : `/${lang}/offices?f=avail`}
                  aria-current={f.on ? "true" : undefined}
                  style={{ minHeight: 40, padding: "0 16px", borderRadius: 9, display: "inline-flex", alignItems: "center", background: f.on ? "#fff" : "transparent", boxShadow: f.on ? "0 1px 3px rgba(17,18,20,.14)" : "none", fontSize: 15, fontWeight: f.on ? 600 : 500, color: "var(--ink)" }}
                >
                  {f.label}
                </Link>
              ))}
            </div>
            <span style={{ fontSize: 15, color: "var(--g2)" }}>{summary}</span>
          </div>
        </div>
        {list.length === 0 && <p style={{ color: "var(--g1)", background: "var(--bg-2)", borderRadius: 12, padding: 20 }}>{t.noOffices}</p>}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,280px),1fr))", gap: 16 }}>
          {list.map((o) => {
            const v = officeView(o, lang, t);
            return (
              <li key={o.id}>
                <Link href={v.href} className="off-tile">
                  <span style={{ position: "relative", display: "block", aspectRatio: "4 / 3", background: "#f1f1f0" }}>
                    {v.img ? (
                      <Image src={v.img} alt={v.alt} fill sizes="(min-width: 1024px) 25vw, 100vw" style={{ objectFit: "cover" }} />
                    ) : (
                      <span style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "#45494f" }}>
                        <b style={{ fontSize: 40, fontWeight: 600, lineHeight: 1, direction: "ltr" }}>{v.idx}</b>
                        <span style={{ fontSize: 14 }}>{t.officePhotoSoon}</span>
                      </span>
                    )}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 18px 18px", flex: 1 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <b style={{ fontSize: 19, fontWeight: 600 }}>{v.name}</b>
                      <span className={`pill ${v.pill}`} style={{ fontSize: 13, padding: "4px 10px" }}>
                        {v.status}
                      </span>
                    </span>
                    <span style={{ fontSize: 15, color: "var(--g2)" }}>{v.amen}</span>
                    <span style={{ marginTop: "auto", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 15 }}>
                      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                        <b style={{ fontSize: 18, fontWeight: 700 }}>{v.rent}</b>
                        <span style={{ fontSize: 14, color: "var(--g2)" }}>{v.feeLine}</span>
                        <span style={{ fontSize: 14, color: "var(--g2)" }}>{v.vatL}</span>
                      </span>
                      <span style={{ fontWeight: 600, display: "inline-flex", gap: 6 }}>
                        {v.cta}
                        <span aria-hidden="true">{arrow}</span>
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
