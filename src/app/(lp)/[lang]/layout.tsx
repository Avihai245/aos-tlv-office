import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { A11yWidget } from "@/components/a11y-widget";
import { CookieNotice } from "@/components/cookie-notice";
import { dirOf, getT, isLang } from "@/i18n";
import { frank, plex } from "@/lib/fonts";
import { SITE_URL } from "@/lib/seo";
import "@/styles/base.css";
import "@/styles/lp.css";

export const viewport: Viewport = { themeColor: "#0b0b0c", width: "device-width", initialScale: 1 };

// Campaign pages are reached from ads, not from search, so they stay out of the index and out of the sitemap.
export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: "AOS",
    robots: { index: false, follow: true },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/uploads/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: { url: "/uploads/apple-touch-icon.png", sizes: "180x180" },
    },
  };
}

export default async function LpLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  return (
    <html lang={lang} dir={dirOf(lang)} className={`${plex.variable} ${frank.variable}`}>
      <body className="lp">
        <div id="aos-root" dir={dirOf(lang)} lang={lang}>
          {children}
          <A11yWidget lang={lang} t={t} />
          <CookieNotice lang={lang} />
        </div>
      </body>
    </html>
  );
}
