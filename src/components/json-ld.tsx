import { ldJson } from "@/lib/seo";

/** Structured data for search engines and AI answer engines. The content must match what the page shows. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />;
}
