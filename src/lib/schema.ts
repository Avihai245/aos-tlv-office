import type { Lang } from "@/i18n";
import { tr } from "@/i18n";
import { siteText } from "./contact";
import { absUrl, langUrl, SITE_URL } from "./seo";
import type { Faq } from "./faq";
import { imgSrc } from "./format";
import type { Office, Room, Site } from "./types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hh = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

export const BUSINESS_ID = `${SITE_URL}/#business`;
export const SITE_ID = `${SITE_URL}/#website`;

/** Street and city from an address like "דרך מנחם בגין 150, תל אביב". */
function postalAddress(address: string) {
  const [street, ...rest] = address.split(",").map((x) => x.trim());
  return { "@type": "PostalAddress", streetAddress: street, addressLocality: rest.join(", ") || "Tel Aviv", addressCountry: "IL" };
}

/** Days with the same opening hours are grouped into one specification. */
function openingHours(rooms: Room[]) {
  const first = rooms[0];
  if (!first) return undefined;
  const groups = new Map<string, number[]>();
  for (const [d, h] of Object.entries(first.hours)) {
    const key = `${h.open}-${h.close}`;
    groups.set(key, [...(groups.get(key) ?? []), Number(d)]);
  }
  return [...groups.entries()].map(([key, days]) => {
    const [open, close] = key.split("-").map(Number);
    return { "@type": "OpeningHoursSpecification", dayOfWeek: days.map((d) => DAYS[d]), opens: hh(open), closes: hh(close) };
  });
}

/** The business itself: one entity every page can point to with its @id. */
export function businessSchema(lang: Lang, site: Site) {
  const { settings, rooms } = site;
  const c = settings.content;
  const s = siteText(c, lang);
  const room = rooms[0];
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  return {
    "@type": ["LocalBusiness", "ProfessionalService"],
    "@id": BUSINESS_ID,
    name: "AOS",
    alternateName: tr(lang, "AOS משרדים וחדר ישיבות", "AOS Offices & Meetings"),
    description: tr(
      lang,
      `משרדים פרטיים להשכרה וחדר ישיבות להזמנה אונליין ב${s.address}.`,
      `Private offices to rent and a meeting room to book online at ${s.address}.`,
    ),
    url: langUrl(lang),
    image: [absUrl("/uploads/og-home.jpg"), absUrl("/uploads/og-room.jpg")],
    logo: { "@type": "ImageObject", url: absUrl("/uploads/icon-512.png"), width: 512, height: 512 },
    address: postalAddress(s.address),
    ...(Number.isFinite(lat) && Number.isFinite(lng) && c.lat && c.lng ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } } : {}),
    hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.addressHe || s.address)}`,
    areaServed: { "@type": "City", name: tr(lang, "תל אביב-יפו", "Tel Aviv-Yafo") },
    ...(c.phone ? { telephone: c.phone } : {}),
    ...(c.email ? { email: c.email } : {}),
    priceRange: "₪₪",
    currenciesAccepted: "ILS",
    availableLanguage: ["he", "en"],
    openingHoursSpecification: openingHours(rooms),
    ...(room ? { amenityFeature: (lang === "he" ? room.equipHe.concat(room.amenitiesHe) : room.equipEn.concat(room.amenitiesEn)).map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })) } : {}),
  };
}

export function websiteSchema(lang: Lang) {
  return { "@type": "WebSite", "@id": SITE_ID, url: SITE_URL, name: "AOS", inLanguage: lang === "he" ? "he-IL" : "en-GB", publisher: { "@id": BUSINESS_ID } };
}

export const graph = (...nodes: unknown[]) => ({ "@context": "https://schema.org", "@graph": nodes });

export function breadcrumbSchema(items: { name: string; path: string; lang: Lang }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: langUrl(it.lang, it.path) })),
  };
}

export function faqSchema(faqs: Faq[]) {
  return { "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

/** The meeting room as a rentable product with one offer per package. */
export function roomSchema(lang: Lang, site: Site, room: Room, pageUrl: string) {
  const he = lang === "he";
  const { settings, packages } = site;
  const name = he ? room.nameHe : room.nameEn;
  const vat = settings.taxMode === "included" ? true : settings.taxMode === "added" ? false : undefined;
  const priceOf = (id: string) => (id === "half" ? room.priceHalf : id === "day" ? room.priceDay : room.price);
  const offers = packages
    .filter((p) => priceOf(p.id) > 0)
    .map((p) => ({
      "@type": "Offer",
      name: `${he ? p.nameHe : p.nameEn} (${p.hours}h)`,
      price: priceOf(p.id),
      priceCurrency: "ILS",
      availability: "https://schema.org/InStock",
      url: pageUrl,
      seller: { "@id": BUSINESS_ID },
      ...(vat === undefined ? {} : { priceSpecification: { "@type": "PriceSpecification", price: priceOf(p.id), priceCurrency: "ILS", valueAddedTaxIncluded: vat } }),
    }));
  return {
    "@type": "Product",
    "@id": `${pageUrl}#room`,
    name,
    description: he ? room.descHe : room.descEn,
    image: room.images.map((g) => absUrl(imgSrc(g.src))),
    category: tr(lang, "חדר ישיבות להשכרה", "Meeting room rental"),
    brand: { "@type": "Brand", name: "AOS" },
    additionalProperty: [{ "@type": "PropertyValue", name: tr(lang, "קיבולת", "Capacity"), value: room.capacity, unitText: tr(lang, "משתתפים", "people") }],
    ...(offers.length ? { offers } : {}),
  };
}

/** A private office with its monthly rent (rent excludes VAT and management fee). */
export function officeSchema(lang: Lang, office: Office, pageUrl: string) {
  const he = lang === "he";
  const name = he ? office.nameHe : office.nameEn;
  const amen = he ? office.amenitiesHe : office.amenitiesEn;
  return {
    "@type": "Product",
    "@id": `${pageUrl}#office`,
    name,
    description: (he ? office.descHe : office.descEn) || amen.join(", "),
    image: office.images.map((g) => absUrl(imgSrc(g.src))),
    category: tr(lang, "משרד פרטי להשכרה", "Private office rental"),
    brand: { "@type": "Brand", name: "AOS" },
    ...(office.price && office.price > 0
      ? {
          offers: {
            "@type": "Offer",
            price: office.price,
            priceCurrency: "ILS",
            url: pageUrl,
            seller: { "@id": BUSINESS_ID },
            priceSpecification: { "@type": "UnitPriceSpecification", price: office.price, priceCurrency: "ILS", unitCode: "MON", valueAddedTaxIncluded: false },
          },
        }
      : {}),
  };
}
