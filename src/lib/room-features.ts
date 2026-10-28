import type { Lang } from "@/i18n";
import type { Room } from "./types";

const IC = {
  tv: "M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM17 2l-5 5-5-5",
  wifi: "M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0",
  ac: "M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4",
  fr: "M6 8l1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8M5 8h14M7 15a6.5 6.5 0 0 1 5 0a6.5 6.5 0 0 0 5 0M12 8l1-6h2",
  cof: "M10 2v2M14 2v2M6 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h12zM17 10h1a3 3 0 0 1 0 6h-1",
  ck: "M12 2a10 10 0 1 0 10 10a4 4 0 0 1-5-5a4 4 0 0 1-5-5M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01",
  ok: "M20 6 9 17l-5-5",
} as const;

const FM: Record<Lang, [RegExp, keyof typeof IC, string][]> = {
  he: [
    [/טלוויזיה|מסך/, "tv", "למצגות ולשיחות וידאו על מסך גדול"],
    [/אינטרנט/, "wifi", "חיבור מהיר ויציב לכל המשתתפים"],
    [/מיזוג/, "ac", "טמפרטורה נעימה לאורך כל הפגישה"],
    [/מקרר/, "fr", "משקאות קרים זמינים בחדר"],
    [/קפה/, "cof", "קפה טרי לפני הפגישה ובמהלכה"],
    [/עוגיות/, "ck", "משהו מתוק לצד הקפה"],
  ],
  en: [
    [/TV|screen|display/i, "tv", "For presentations and video calls on a big screen"],
    [/internet|wi-?fi/i, "wifi", "Fast, stable connection for everyone"],
    [/A\/C|air/i, "ac", "A comfortable temperature throughout"],
    [/fridge/i, "fr", "Cold drinks available in the room"],
    [/coffee/i, "cof", "Fresh coffee before and during the meeting"],
    [/cookie/i, "ck", "Something sweet with your coffee"],
  ],
};

export type Feature = { title: string; ic: string; sub: string };

export function roomFeatures(room: Room, lang: Lang): Feature[] {
  const items = (lang === "he" ? room.equipHe : room.equipEn).concat(lang === "he" ? room.amenitiesHe : room.amenitiesEn);
  return items.map((title) => {
    const m = FM[lang].find((z) => z[0].test(title));
    return { title, ic: IC[m ? m[1] : "ok"], sub: m ? m[2] : "" };
  });
}

export const featIntro = (room: Room, lang: Lang) =>
  lang === "he"
    ? `חדר מעוצב ומאובזר לעד ${room.capacity} משתתפים. מגיעים, מתיישבים ומתחילים.`
    : `A designed, fully equipped room for up to ${room.capacity} people. Arrive, sit down and start.`;
