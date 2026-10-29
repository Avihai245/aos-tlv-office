import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { A11yWidget } from "@/components/a11y-widget";
import { CookieNotice } from "@/components/cookie-notice";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { dirOf, getT, isLang, tr } from "@/i18n";
import { graph, businessSchema, websiteSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/seo";
import { frank, plex } from "@/lib/fonts";
import { getSite, getViewer } from "@/lib/data";
import { roomPath } from "@/lib/urls";
import "@/styles/base.css";
import "@/styles/home.css";
import "@/styles/booking.css";

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: tr(lang, "AOS · משרדים וחדר ישיבות בתל אביב", "AOS · Offices & Meetings · Tel Aviv"),
      template: "%s · AOS",
    },
    description: tr(
      lang,
      "AOS בדרך מנחם בגין 150, תל אביב: שבעה משרדים פרטיים להשכרה וחדר ישיבות להזמנה באתר.",
      "Seven private offices and a meeting room booked online, 150 Menachem Begin Road, Tel Aviv.",
    ),
    applicationName: "AOS",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/uploads/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: { url: "/uploads/apple-touch-icon.png", sizes: "180x180" },
    },
    // Regional hints for search engines (ISO 3166-2 code for the Tel Aviv district).
    other: { "geo.region": "IL-TA", "geo.placename": "Tel Aviv" },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  const [site, viewer] = await Promise.all([getSite(), getViewer()]);
  const bookHref = site.rooms.length === 1 ? roomPath(lang, site.rooms[0]) : `/${lang}/rooms`;
  const ld = graph(businessSchema(lang, site), websiteSchema(lang));

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
          <CookieNotice lang={lang} />
        </div>
        <JsonLd data={ld} />
      </body>
    </html>
  );
}
