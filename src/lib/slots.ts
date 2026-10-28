import type { SupabaseClient } from "@supabase/supabase-js";
import type { Quote, Slot, SlotState } from "./types";

type Row = { day: string; start_hour: number; end_hour: number; pkg: string; state: string; price: number; total: number };

/** Availability for one room and one package over `days` days, as computed by the database. */
export async function fetchSlots(
  supabase: SupabaseClient,
  roomId: string,
  from: string,
  days: number,
  pkg: string,
): Promise<Slot[]> {
  const { data, error } = await supabase.rpc("get_day_slots", { p_room: roomId, p_from: from, p_days: days, p_pkg: pkg });
  if (error || !Array.isArray(data)) return [];
  return (data as Row[]).map((r) => ({
    day: r.day,
    start: Number(r.start_hour),
    end: Number(r.end_hour),
    pkg: r.pkg,
    state: r.state as SlotState,
    price: Number(r.price),
    total: Number(r.total),
  }));
}

/** The database allows at most 62 days per call; windows are fetched in chunks. */
export async function fetchWindow(supabase: SupabaseClient, roomId: string, from: string, days: number, pkg: string) {
  return fetchSlots(supabase, roomId, from, Math.min(days, 62), pkg);
}

export async function fetchQuote(
  supabase: SupabaseClient,
  roomId: string,
  date: string,
  start: number,
  end: number,
): Promise<Quote | null> {
  const { data, error } = await supabase.rpc("quote_booking", { p_room: roomId, p_date: date, p_start: start, p_end: end });
  if (error || !data || (data as { err?: string }).err) return null;
  return data as Quote;
}
