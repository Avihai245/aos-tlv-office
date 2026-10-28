import "server-only";
import { cache } from "react";
import { getSite } from "@/lib/data";
import { addDays, dowOf, fmtShort, localParts, money, nowIL, range } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type BookingRow = {
  id: string;
  ref: string;
  name: string;
  email: string;
  phone: string;
  user_id: string | null;
  room_id: string;
  status: string;
  pay: string;
  total: number;
  starts_at: string;
  ends_at: string;
  expires_at: string | null;
  note: string;
  source: string;
  tenant: boolean;
  office_id: string | null;
  quote: Record<string, unknown>;
  created_at: string;
};

export const bookingView = (b: Pick<BookingRow, "starts_at" | "ends_at">) => {
  const from = localParts(b.starts_at);
  const to = localParts(b.ends_at);
  return { date: from.date, start: from.hour, end: to.hour, time: range(from.hour, to.hour), dateLabel: fmtShort(from.date, "he") };
};

/** Name lookup for rooms, including rooms hidden from the public site. */
export const getRoomNames = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("rooms").select("id,name_he");
  return new Map((data ?? []).map((r) => [r.id, r.name_he as string]));
});

export const BOOKING_STATUS_FILTERS: [string, string][] = [
  ["all", "הכל"],
  ["pending_payment", "ממתינות"],
  ["confirmed", "מאושרות"],
  ["hold", "בתהליך"],
  ["cancelled", "בוטלו"],
  ["expired", "פג תוקף"],
];

/** Share of the room's open hours that are booked over the next seven days, as a percentage. */
export async function weekOccupancy(rows: Pick<BookingRow, "starts_at" | "ends_at" | "status" | "room_id">[]) {
  const { rooms } = await getSite();
  const today = nowIL().key;
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const dow = dowOf(addDays(today, i));
    for (const r of rooms) {
      const h = r.hours[dow];
      if (h) total += h.close - h.open;
    }
  }
  let used = 0;
  for (const b of rows) {
    if (!["pending_payment", "confirmed"].includes(b.status)) continue;
    const v = bookingView(b);
    if (v.date >= today && v.date < addDays(today, 7)) used += v.end - v.start;
  }
  return total ? Math.round((used / total) * 100) : null;
}

/** Wall clock for server pages (kept out of render bodies so the purity lint stays meaningful). */
export const nowMs = () => Date.now();

export { money };
