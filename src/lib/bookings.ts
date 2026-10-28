import "server-only";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  ref: string;
  room_id: string;
  status: string;
  pay: string;
  total: number;
  starts_at: string;
  ends_at: string;
};

/** The signed-in customer's bookings, split into upcoming (or in progress) and past, newest history first. */
export async function getMyBookings(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id,ref,room_id,status,pay,total,starts_at,ends_at")
    .eq("user_id", userId)
    .not("status", "in", "(hold,released)")
    .order("starts_at", { ascending: false });
  const now = Date.now();
  const all = (data ?? []) as Row[];
  const isUp = (b: Row) => ["pending_payment", "confirmed"].includes(b.status) && new Date(b.starts_at).getTime() + 3 * 3600_000 > now;
  return {
    now,
    up: all.filter(isUp).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    past: all.filter((b) => !isUp(b)),
  };
}
