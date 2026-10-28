import { Page } from "@/components/admin/ui";
import { RoomEditor, type HoursData, type RoomData, type RuleData } from "@/components/admin/room-editor";
import type { Img } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

/** Photos already on the site, offered for quick re-use. */
const LIBRARY: Img[] = [
  { src: "uploads/assets-1792344398884-f06p.png", he: "דלת הכניסה למתחם AOS עם הלוגו", en: "AOS entrance door with logo" },
  { src: "uploads/corridor-2026.jpg", he: "מסדרון המשרדים עם מחיצות זכוכית", en: "Office corridor with glass partitions" },
  { src: "uploads/assets-1792344398893-10qe.jpg", he: "המטבחון המשותף", en: "The shared kitchenette" },
];

export default async function RoomAdmin({ searchParams }: PageProps<"/admin/room">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: rooms } = await supabase.from("rooms").select("*").order("sort_order");
  const want = Array.isArray(sp.r) ? sp.r[0] : sp.r;
  const x = (rooms ?? []).find((r) => r.id === want) ?? (rooms ?? [])[0];
  if (!x) {
    return (
      <Page title="חדר הישיבות" lead="אין עדיין חדר. החדר נוצר בבסיס הנתונים.">
        <></>
      </Page>
    );
  }

  const [{ data: hoursRows }, { data: ruleRows }, { data: settings }] = await Promise.all([
    supabase.from("room_hours").select("dow,open_hour,close_hour").eq("room_id", x.id),
    supabase.from("price_rules").select("*").eq("room_id", x.id).order("created_at"),
    supabase.from("settings").select("member_discount,tax_mode,tax_pct").eq("id", 1).maybeSingle(),
  ]);
  const room: RoomData = {
    id: x.id,
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
    images: Array.isArray(x.images) ? (x.images as unknown as Img[]) : [],
    active: x.status === "active",
    visible: x.visible,
  };
  const hours: HoursData = Object.fromEntries((hoursRows ?? []).map((h) => [h.dow, { open: Number(h.open_hour), close: Number(h.close_hour) }]));
  const rules = (ruleRows ?? []).map((r) => ({ ...r, price: r.price === null ? null : Number(r.price), start_hour: r.start_hour === null ? null : Number(r.start_hour), end_hour: r.end_hour === null ? null : Number(r.end_hour), pct: r.pct === null ? null : Number(r.pct) })) as RuleData[];

  return (
    <Page title="חדר הישיבות">
      <div className="row" style={{ margin: "-8px 0 18px" }}>
        <span className="muted ltr">{room.code}</span>
      </div>
      <RoomEditor key={x.updated_at} room={room} hours={hours} rules={rules} member={Number(settings?.member_discount ?? 0.2)} tax={{ mode: settings?.tax_mode ?? "none", pct: Number(settings?.tax_pct ?? 0) }} library={LIBRARY} />
    </Page>
  );
}
