import "server-only";
import { createClient as createAnonClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Img, Office, Pkg, Room, Settings, Site, SiteContent, Viewer } from "./types";

const EMPTY_CONTENT: SiteContent = {
  addressHe: "", addressEn: "", hoursAHe: "", hoursAEn: "", hoursBHe: "", hoursBEn: "",
  heroAHe: "", heroAEn: "", heroBHe: "", heroBEn: "", heroSubHe: "", heroSubEn: "",
  phone: "", email: "", whatsapp: "", lat: "", lng: "",
};

const imgs = (v: unknown): Img[] => (Array.isArray(v) ? (v as Img[]).filter((x) => x && typeof x.src === "string") : []);

/** Reads the public catalogue: settings, the visible room(s) with opening hours, packages and offices. */
async function loadSite(supabase: SupabaseClient): Promise<Site> {
  const [s, r, h, p, o] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("rooms").select("*").eq("visible", true).eq("status", "active").order("sort_order"),
    supabase.from("room_hours").select("*"),
    supabase.from("packages").select("*").order("sort_order"),
    supabase.from("offices").select("*").eq("visible", true).neq("status", "unavailable").order("sort_order"),
  ]);
  const row = s.data;
  const settings: Settings = {
    content: { ...EMPTY_CONTENT, ...((row?.content as Partial<SiteContent>) ?? {}) },
    holdMinutes: row?.hold_minutes ?? 10,
    requestHours: row?.request_hours ?? 24,
    cancelHours: row?.cancel_hours ?? 24,
    windowDays: row?.window_days ?? 60,
    taxMode: (row?.tax_mode as Settings["taxMode"]) ?? "none",
    taxPct: Number(row?.tax_pct ?? 0),
    memberPrice: Number(row?.member_price ?? 120),
    memberDiscount: Number(row?.member_discount ?? 0.2),
    samedayLeadHours: Number(row?.sameday_lead_hours ?? 1),
  };
  const hours = h.data ?? [];
  const rooms: Room[] = (r.data ?? []).map((x) => ({
    id: x.id,
    slug: x.slug,
    code: x.code,
    nameHe: x.name_he,
    nameEn: x.name_en,
    descHe: x.desc_he,
    descEn: x.desc_en,
    capacity: x.capacity,
    price: Number(x.price),
    priceHalf: Number(x.price_half),
    priceDay: Number(x.price_day),
    equipHe: x.equip_he ?? [],
    equipEn: x.equip_en ?? [],
    amenitiesHe: x.amenities_he ?? [],
    amenitiesEn: x.amenities_en ?? [],
    images: imgs(x.images),
    hours: Object.fromEntries(
      hours.filter((z) => z.room_id === x.id).map((z) => [z.dow, { open: Number(z.open_hour), close: Number(z.close_hour) }]),
    ),
  }));
  const packages: Pkg[] = (p.data ?? []).map((x) => ({
    id: x.id,
    hours: Number(x.hours),
    nameHe: x.name_he,
    nameEn: x.name_en,
    starts: (x.starts ?? []).map(Number),
  }));
  const offices: Office[] = (o.data ?? []).map((x) => ({
    id: x.id,
    slug: x.slug,
    code: x.code,
    nameHe: x.name_he,
    nameEn: x.name_en,
    descHe: x.desc_he,
    descEn: x.desc_en,
    amenitiesHe: x.amenities_he ?? [],
    amenitiesEn: x.amenities_en ?? [],
    images: imgs(x.images),
    price: x.price === null ? null : Number(x.price),
    mgmtFee: x.mgmt_fee === null ? null : Number(x.mgmt_fee),
    freeHours: Number(x.free_hours ?? 0),
    status: x.status as Office["status"],
  }));
  return { settings, rooms, offices, packages };
}

/** A client without a session, for data every visitor sees (so it can be cached across requests). */
export const anonClient = () =>
  createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const cachedSite = unstable_cache(async () => loadSite(anonClient()), ["site-v2"], { revalidate: 60, tags: ["site"] });

/**
 * The public catalogue as every visitor sees it. Shared between requests for up to a minute, which removes the database round trips
 * from almost every page view; the back office clears it (tag "site") after saving.
 */
export const getSite = cache(cachedSite);

/** The same catalogue read fresh with the current session, for the back office. */
export const getSiteLive = cache(async () => loadSite(await createClient()));

/** The signed-in user (verified from the JWT) with membership and tenancy, or null. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return null;
  const [p, m, t] = await Promise.all([
    supabase.from("profiles").select("id,email,name,phone,company,role").eq("id", uid).maybeSingle(),
    supabase.from("memberships").select("status,until").eq("user_id", uid).maybeSingle(),
    supabase.from("office_tenants").select("office_id").eq("user_id", uid).maybeSingle(),
  ]);
  if (!p.data) return null;
  const mem = m.data;
  const isMember = !!mem && mem.status === "active" && (!mem.until || new Date(mem.until).getTime() > Date.now());
  return {
    id: p.data.id,
    email: p.data.email,
    name: p.data.name,
    phone: p.data.phone,
    company: p.data.company,
    role: p.data.role === "admin" ? "admin" : "customer",
    isMember,
    memberUntil: isMember ? (mem?.until ?? null) : null,
    officeId: t.data?.office_id ?? null,
  };
});
