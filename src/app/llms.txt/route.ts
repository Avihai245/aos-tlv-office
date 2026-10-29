import { getSite } from "@/lib/data";
import { buildFaqs } from "@/lib/faq";
import { money } from "@/lib/format";
import { langUrl, SITE_URL } from "@/lib/seo";
import { siteText } from "@/lib/contact";

/**
 * /llms.txt: a plain-language fact sheet for AI assistants and answer engines (https://llmstxt.org).
 * It is generated from the same data as the site, so prices and hours are never out of date.
 */
export async function GET() {
  const site = await getSite();
  const { settings, rooms, offices, packages } = site;
  const room = rooms[0];
  const c = settings.content;
  const he = siteText(c, "he");
  const en = siteText(c, "en");
  const rents = offices.map((o) => o.price ?? 0).filter((p) => p > 0);
  const pct = Math.round(settings.memberDiscount * 100);
  const lines: string[] = [];

  lines.push("# AOS · משרדים וחדר ישיבות בתל אביב (Offices & Meetings, Tel Aviv)");
  lines.push("");
  lines.push(
    `> AOS rents ${offices.length} furnished private offices and one bookable meeting room${room ? ` (up to ${room.capacity} people)` : ""} at ${en.address}, Israel. ` +
      `Meeting-room booking is online, in Hebrew and English. / AOS משכירה ${offices.length} משרדים פרטיים מרוהטים וחדר ישיבות להזמנה אונליין ב${he.address}.`,
  );
  lines.push("");
  lines.push("## Key facts");
  lines.push(`- Name: AOS`);
  lines.push(`- Address: ${en.address} (${he.address})`);
  lines.push(`- Opening hours: ${en.hoursA}; ${en.hoursB}`.replace(/[⁦⁩]/g, ""));
  if (c.phone) lines.push(`- Phone: ${c.phone}`);
  if (c.email) lines.push(`- Email: ${c.email}`);
  lines.push(`- Languages: Hebrew, English`);
  lines.push(`- Currency: ILS (₪)`);
  lines.push("");

  if (room) {
    lines.push("## Meeting room (חדר ישיבות להשכרה)");
    lines.push(`- ${room.nameEn} / ${room.nameHe}: seats up to ${room.capacity}.`);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const byHours = new Map<string, number[]>();
    for (const [d, h] of Object.entries(room.hours)) byHours.set(`${String(h.open).padStart(2, "0")}:00–${String(h.close).padStart(2, "0")}:00`, [...(byHours.get(`${String(h.open).padStart(2, "0")}:00–${String(h.close).padStart(2, "0")}:00`) ?? []), Number(d)]);
    lines.push(`- Bookable hours: ${[...byHours.entries()].map(([hrs, ds]) => `${ds.map((d) => days[d]).join(", ")} ${hrs}`).join("; ")}.`);
    lines.push(`- Equipment and services: ${room.equipEn.concat(room.amenitiesEn).join(", ")}.`);
    const price = (id: string) => (id === "half" ? room.priceHalf : id === "day" ? room.priceDay : room.price);
    for (const p of packages) lines.push(`- ${p.nameEn} (${p.hours} hours, start times ${p.starts.map((s) => `${String(s).padStart(2, "0")}:00`).join(" / ")}): ${money(price(p.id))}`);
    lines.push(`- Tax: ${settings.taxMode === "added" ? `VAT ${settings.taxPct}% is added` : settings.taxMode === "included" ? "prices include VAT" : "the amount shown is the amount payable"}.`);
    lines.push(`- Membership: ${money(settings.memberPrice)} per month plus VAT gives ${pct}% off every meeting-room booking and same-day booking.`);
    lines.push(`- Booking: choose a date and package on the room page, sign in, and send a booking request. The slot is held ${settings.holdMinutes} minutes while booking and ${settings.requestHours} hours after the request. A booking is confirmed once payment is verified.`);
    lines.push(`- Cancellation: free up to ${settings.cancelHours} hours before the meeting.`);
    lines.push(`- Bookings open up to ${settings.windowDays} days ahead. Same-day booking is for members, at least ${settings.samedayLeadHours} hour in advance.`);
    lines.push("");
  }

  lines.push("## Private offices (משרדים להשכרה)");
  lines.push(`- ${offices.length} furnished private offices with a desk, chair, integrated lighting, a shared kitchenette and central A/C.`);
  if (rents.length) lines.push(`- Monthly rent from ${money(Math.min(...rents))}, plus a management fee and VAT. Contact AOS for a tour and a quote.`);
  for (const o of offices) lines.push(`- ${o.nameEn}${o.price ? `: ${money(o.price)} per month` : ""}${o.mgmtFee ? ` + ${money(o.mgmtFee)} management fee` : ""}`);
  lines.push("");

  lines.push("## Pages");
  if (room) {
    lines.push(`- [Book the meeting room (English)](${langUrl("en", `/room/${room.slug}`)}): live availability and prices`);
    lines.push(`- [הזמנת חדר הישיבות](${langUrl("he", `/room/${room.slug}`)}): זמינות ומחירים בזמן אמת`);
  }
  lines.push(`- [Private offices](${langUrl("en", "/offices")}) · [משרדים להשכרה](${langUrl("he", "/offices")})`);
  lines.push(`- [Membership](${langUrl("en", "/membership")}) · [מנוי חדר ישיבות](${langUrl("he", "/membership")})`);
  lines.push(`- [Home (English)](${langUrl("en")}) · [דף הבית](${langUrl("he")})`);
  lines.push(`- [Booking terms](${langUrl("en", "/terms")}) · [Privacy policy](${langUrl("en", "/privacy")}) · [Accessibility statement](${langUrl("en", "/accessibility")})`);
  lines.push(`- Sitemap: ${SITE_URL}/sitemap.xml`);
  lines.push("");

  lines.push("## Frequently asked questions");
  for (const f of buildFaqs("en", { room, offices, settings })) {
    lines.push(`### ${f.q}`);
    lines.push(f.a.replace(/[⁦⁩]/g, ""));
    lines.push("");
  }
  lines.push("## שאלות נפוצות");
  for (const f of buildFaqs("he", { room, offices, settings })) {
    lines.push(`### ${f.q}`);
    lines.push(f.a.replace(/[⁦⁩]/g, ""));
    lines.push("");
  }

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
