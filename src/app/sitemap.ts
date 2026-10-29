import type { MetadataRoute } from "next";
import { getSite } from "@/lib/data";
import { langUrl } from "@/lib/seo";

type Entry = MetadataRoute.Sitemap[number];

/** Every public page in both languages, each pointing at its translation. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { rooms, offices } = await getSite();
  const pages: { path: string; priority: number; freq: Entry["changeFrequency"] }[] = [
    { path: "", priority: 1, freq: "daily" },
    ...rooms.map((r) => ({ path: `/room/${r.slug}`, priority: 0.9, freq: "daily" as const })),
    { path: "/offices", priority: 0.8, freq: "weekly" },
    ...offices.map((o) => ({ path: `/office/${o.slug}`, priority: 0.7, freq: "weekly" as const })),
    { path: "/membership", priority: 0.6, freq: "monthly" },
    { path: "/privacy", priority: 0.2, freq: "yearly" },
    { path: "/terms", priority: 0.3, freq: "yearly" },
    { path: "/accessibility", priority: 0.2, freq: "yearly" },
  ];
  return pages.flatMap((p) =>
    (["he", "en"] as const).map((lang) => ({
      url: langUrl(lang, p.path),
      changeFrequency: p.freq,
      priority: p.priority,
      alternates: { languages: { he: langUrl("he", p.path), en: langUrl("en", p.path) } },
    })),
  );
}
