import "server-only";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient } from "./data";
import { fetchSlots } from "./slots";
import type { Slot } from "./types";

const shared = unstable_cache(
  async (roomId: string, from: string, days: number, pkg: string): Promise<Slot[]> => fetchSlots(anonClient(), roomId, from, days, pkg),
  ["slots-v1"],
  { revalidate: 15, tags: ["slots"] },
);

/**
 * Availability for a visitor who is not signed in: identical for everyone, so it is shared between requests for a few seconds.
 * Signed-in visitors (members can book same-day) always read live. The database stays the authority when a hold is created.
 */
export function availability(client: SupabaseClient, signedIn: boolean, roomId: string, from: string, days: number, pkg: string) {
  return signedIn ? fetchSlots(client, roomId, from, days, pkg) : shared(roomId, from, days, pkg);
}
