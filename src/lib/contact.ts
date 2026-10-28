import type { Lang } from "@/i18n";
import { fixRanges } from "./format";
import type { SiteContent } from "./types";

export type ContactLink = { href: string; label: string; target: "_self" | "_blank" };

export function contactLinks(c: SiteContent): ContactLink[] {
  const out: ContactLink[] = [];
  if (c.phone) out.push({ href: "tel:" + c.phone.replace(/[^\d+]/g, ""), label: c.phone, target: "_self" });
  if (c.email) out.push({ href: "mailto:" + c.email, label: c.email, target: "_self" });
  if (c.whatsapp) out.push({ href: "https://wa.me/" + c.whatsapp.replace(/\D/g, ""), label: "WhatsApp", target: "_blank" });
  return out;
}

export const siteText = (c: SiteContent, lang: Lang) => ({
  address: lang === "he" ? c.addressHe : c.addressEn,
  hoursA: fixRanges(lang === "he" ? c.hoursAHe : c.hoursAEn),
  hoursB: fixRanges(lang === "he" ? c.hoursBHe : c.hoursBEn),
  heroA: lang === "he" ? c.heroAHe : c.heroAEn,
  heroB: lang === "he" ? c.heroBHe : c.heroBEn,
  heroSub: lang === "he" ? c.heroSubHe : c.heroSubEn,
});

export const mapQuery = (address: string) => encodeURIComponent(address);
