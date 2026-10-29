import { tr, type Lang } from "@/i18n";
import { siteText } from "./contact";
import { money } from "./format";
import type { Office, Room, Settings } from "./types";

export type Faq = { q: string; a: string };

/** One list of questions and answers, used both for the visible FAQ and for its structured data. */
export function buildFaqs(lang: Lang, ctx: { room?: Room; offices: Office[]; settings: Settings }): Faq[] {
  const { room, offices, settings } = ctx;
  const s = siteText(settings.content, lang);
  const he = lang === "he";
  // Plain text for structured data; the page wraps clock ranges for right-to-left display when it renders them.
  const hours = `${s.hoursA}, ${s.hoursB}`.replace(/[\u2066\u2069]/g, "");
  const rents = offices.map((o) => o.price ?? 0).filter((p) => p > 0);
  const pct = Math.round(settings.memberDiscount * 100);
  const list: Faq[] = [];

  list.push({
    q: tr(lang, "איפה AOS נמצאת?", "Where is AOS?"),
    a: tr(lang, `AOS נמצאת ב${s.address}, במרכז העסקים של העיר.`, `AOS is at ${s.address}, in the city's business district.`),
  });

  if (room) {
    const name = he ? room.nameHe : room.nameEn;
    list.push({
      q: tr(lang, "כמה עולה לשכור חדר ישיבות בתל אביב?", "How much does it cost to rent a meeting room in Tel Aviv?"),
      a: tr(
        lang,
        `${name} ב־AOS מושכר ב־${money(room.price)} ל־3 שעות, ${money(room.priceHalf)} לחצי יום (5 שעות) ו־${money(room.priceDay)} ליום מלא (09:00–18:00). למנויים ${pct}% הנחה על כל הזמנה.`,
        `${name} at AOS costs ${money(room.price)} for 3 hours, ${money(room.priceHalf)} for a half day (5 hours) and ${money(room.priceDay)} for a full day (09:00–18:00). Members get ${pct}% off every booking.`,
      ),
    });
    list.push({
      q: tr(lang, "כמה אנשים נכנסים בחדר הישיבות?", "How many people fit in the meeting room?"),
      a: tr(
        lang,
        `החדר מתאים לעד ${room.capacity} משתתפים, עם ${room.equipHe.concat(room.amenitiesHe).join(", ")}.`,
        `The room seats up to ${room.capacity} people and includes ${room.equipEn.concat(room.amenitiesEn).join(", ")}.`,
      ),
    });
  }

  list.push({
    q: tr(lang, "איך מזמינים חדר ישיבות?", "How do I book a meeting room?"),
    a: tr(
      lang,
      "בוחרים יום וחבילה (3 שעות, חצי יום או יום מלא), מתחברים לחשבון ושולחים בקשת הזמנה. ההזמנה מאושרת לאחר אימות התשלום.",
      "Choose a day and a package (3 hours, half day or full day), sign in and send a booking request. It is confirmed once payment is verified.",
    ),
  });
  list.push({
    q: tr(lang, "האם אפשר לבטל הזמנה?", "Can I cancel a booking?"),
    a: tr(lang, `כן, עד ${settings.cancelHours} שעות לפני הפגישה, מאזור "החשבון שלי".`, `Yes, up to ${settings.cancelHours} hours before the meeting, from "My account".`),
  });
  list.push({
    q: tr(lang, "מה כלול בחדר?", "What is included in the room?"),
    a: room
      ? tr(lang, `${room.equipHe.concat(room.amenitiesHe).join(", ")}.`, `${room.equipEn.concat(room.amenitiesEn).join(", ")}.`)
      : tr(lang, "טלוויזיה 75 אינץ׳, אינטרנט מהיר, מיזוג, מקרר משקאות, קפה ועוגיות.", "A 75-inch TV, fast internet, A/C, a drinks fridge, coffee and cookies."),
  });
  list.push({
    q: tr(lang, "כמה עולה לשכור משרד פרטי?", "How much does a private office cost?"),
    a: rents.length
      ? tr(
          lang,
          `${offices.length} משרדים פרטיים מרוהטים בשכירות חודשית החל מ־${money(Math.min(...rents))}, בתוספת דמי ניהול ומע״מ. משאירים פנייה ונחזור לתאם סיור והצעת מחיר.`,
          `${offices.length} furnished private offices, rented monthly from ${money(Math.min(...rents))} plus a management fee and VAT. Send an enquiry and we will arrange a tour and a quote.`,
        )
      : tr(lang, "בדף המשרדים מוצג הסטטוס של כל אחד משבעת המשרדים. משאירים פנייה ונחזור לתאם סיור והצעת מחיר.", "The offices page shows the status of each of the seven offices. Send an enquiry and we will arrange a tour and a quote."),
  });
  list.push({ q: tr(lang, "מה שעות הפעילות?", "What are the opening hours?"), a: hours });
  return list;
}
