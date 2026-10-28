import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { A11yWidget } from "@/components/a11y-widget";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { dirOf, getT, isLang, tr } from "@/i18n";
import { siteText } from "@/lib/contact";
import { frank, plex } from "@/lib/fonts";
import { getSite, getViewer } from "@/lib/data";
import "@/styles/base.css";
import "@/styles/home.css";
import "@/styles/booking.css";

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: {
      default: tr(lang, "AOS · משרדים וחדר ישיבות בתל אביב", "AOS · Offices & Meetings · Tel Aviv"),
      template: "%s · AOS",
    },
    description: tr(
      lang,
      "AOS בדרך מנחם בגין 150, תל אביב: שבעה משרדים פרטיים להשכרה וחדר ישיבות להזמנה באתר.",
      "Seven private offices and a meeting room booked online, 150 Menachem Begin Road, Tel Aviv.",
    ),
    openGraph: {
      type: "website",
      siteName: "AOS",
      title: tr(lang, "AOS · משרדים וחדר ישיבות בתל אביב", "AOS · Offices & Meetings · Tel Aviv"),
      images: ["/uploads/corridor-2026.jpg"],
      locale: lang === "he" ? "he_IL" : "en_GB",
    },
    twitter: { card: "summary_large_image" },
    alternates: { languages: { he: "/he", en: "/en" } },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  const [site, viewer] = await Promise.all([getSite(), getViewer()]);
  const bookHref = site.rooms.length === 1 ? `/${lang}/room/${site.rooms[0].id}` : `/${lang}/rooms`;
  const s = siteText(site.settings.content, lang);
  const ld = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "AOS",
    description: "Private offices and a meeting room",
    image: "/uploads/corridor-2026.jpg",
    address: { "@type": "PostalAddress", streetAddress: s.address, addressCountry: "IL" },
  };

  return (
    <html lang={lang} dir={dirOf(lang)} className={`${plex.variable} ${frank.variable}`}>
      <body>
        <div id="aos-root" dir={dirOf(lang)} lang={lang}>
          <a href="#main" className="skip">
            {t.skip}
          </a>
          <SiteHeader lang={lang} t={t} viewer={viewer} bookHref={bookHref} />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter lang={lang} t={t} c={site.settings.content} viewer={viewer} bookHref={bookHref} />
          <A11yWidget lang={lang} t={t} />
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      </body>
    </html>
  );
}
