import Link from "next/link";
import { BookingDrawer } from "@/components/admin/booking-drawer";
import { BlockPanel, SlotPanel } from "@/components/admin/slot-panel";
import { Dl, Drawer, Page, Seg } from "@/components/admin/ui";
import { statusText } from "@/i18n";
import { BookingRow, bookingView } from "@/lib/admin";
import { addDays, dowOf, fmtDow, fmtLong, fmtMonth, fmtShort, hm, keyOf, localParts, nowIL, parseKey, range } from "@/lib/format";
import { fetchSlots } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const weekStart = (k: string) => addDays(k, -dowOf(k));
const addMonths = (k: string, n: number) => {
  const d = parseKey(k);
  return keyOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12)));
};

type Item = { key: string; start: number; end: number; kind: "free" | "booking" | "block"; title: string; sub: string; href: string; status?: string };

export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  const sp = await searchParams;
  const view = (["day", "week", "month"] as const).find((v) => v === one(sp.v)) ?? "week";
  const now = nowIL();
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.d)) ? one(sp.d) : now.key;
  const supabase = await createClient();

  const { data: roomRows } = await supabase.from("rooms").select("id,name_he,price,sort_order").order("sort_order");
  const rooms = roomRows ?? [];
  const room = rooms.find((r) => r.id === one(sp.r)) ?? rooms[0];
  if (!room) {
    return (
      <Page title="יומן" lead="אין חדר מוגדר.">
        <></>
      </Page>
    );
  }

  // Visible range of days.
  const monthFirst = anchor.slice(0, 8) + "01";
  const days: string[] =
    view === "day"
      ? [anchor]
      : view === "week"
        ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(anchor), i))
        : Array.from({ length: Math.ceil((dowOf(monthFirst) + new Date(Date.UTC(+anchor.slice(0, 4), +anchor.slice(5, 7), 0)).getUTCDate()) / 7) * 7 }, (_, i) => addDays(addDays(monthFirst, -dowOf(monthFirst)), i));
  const from = days[0];
  const to = addDays(days[days.length - 1], 1);

  const [hoursRes, pkgRes, bksRes, blkRes, slots] = await Promise.all([
    supabase.from("room_hours").select("dow,open_hour,close_hour").eq("room_id", room.id),
    supabase.from("packages").select("id,name_he,hours,starts").order("sort_order"),
    supabase.from("bookings").select("*").eq("room_id", room.id).in("status", ["hold", "pending_payment", "confirmed"]).gte("ends_at", `${from}T00:00:00+03:00`).lt("starts_at", `${to}T23:59:59+03:00`),
    supabase.from("blocks").select("*").eq("room_id", room.id).gte("ends_at", `${from}T00:00:00+03:00`).lt("starts_at", `${to}T23:59:59+03:00`),
    fetchSlots(supabase, room.id, from < now.key ? now.key : from, 62, "p3"),
  ]);
  const hours = new Map((hoursRes.data ?? []).map((h) => [h.dow as number, { open: Number(h.open_hour), close: Number(h.close_hour) }]));
  const packages = (pkgRes.data ?? []).map((p) => ({ id: p.id as string, name: p.name_he as string, hours: Number(p.hours), starts: (p.starts as number[]).map(Number) }));

  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { v: view, d: anchor, r: room.id, ...over };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    return `/admin/calendar?${p.toString()}`;
  };
  const closeHref = href({ slot: "", b: "", k: "" });

  // Items per day.
  const byDay = new Map<string, Item[]>();
  const push = (d: string, it: Item) => byDay.set(d, [...(byDay.get(d) ?? []), it]);
  for (const b of (bksRes.data ?? []) as BookingRow[]) {
    const v = bookingView(b);
    push(v.date, { key: b.id, start: v.start, end: v.end, kind: "booking", title: b.name || b.email, sub: statusText(b.status, "he"), href: href({ b: b.id }), status: b.status });
  }
  for (const k of blkRes.data ?? []) {
    const f = localParts(k.starts_at);
    const t = localParts(k.ends_at);
    push(f.date, { key: k.id, start: f.hour, end: t.hour, kind: "block", title: k.reason || "חסום", sub: "חסימה", href: href({ k: k.id }) });
  }
  for (const s of slots) {
    if (s.state !== "free" && s.state !== "members_only") continue;
    push(s.day, { key: `${s.day}-${s.start}`, start: s.start, end: s.end, kind: "free", title: "פנוי", sub: "הזמנה או חסימה", href: href({ slot: `${s.day}:${s.start}:${s.end}` }) });
  }
  for (const [k, list] of byDay) byDay.set(k, list.sort((a, b) => a.start - b.start));

  // Navigation.
  const step = view === "day" ? 1 : 7;
  const prev = view === "month" ? addMonths(anchor, -1) : addDays(anchor, -step);
  const next = view === "month" ? addMonths(anchor, 1) : addDays(anchor, step);
  const label = view === "month" ? fmtMonth(anchor, "he") : view === "day" ? fmtLong(anchor, "he") : `${fmtShort(days[0], "he")} – ${fmtShort(days[6], "he")}`;

  // Drawer content.
  const slotParam = one(sp.slot).split(":");
  const slotSel = slotParam.length === 3 ? { date: slotParam[0], start: Number(slotParam[1]), end: Number(slotParam[2]) } : null;
  const blockId = one(sp.k);
  const block = blockId ? (blkRes.data ?? []).find((k) => k.id === blockId) : null;
  const dayHours = slotSel ? hours.get(dowOf(slotSel.date)) : null;

  return (
    <>
      <div className="cal-bar">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href={href({ d: prev })} className="btn b-s" aria-label="הקודם">→</Link>
          <Link href={href({ d: now.key })} className="btn b-s">היום</Link>
          <Link href={href({ d: next })} className="btn b-s" aria-label="הבא">←</Link>
          <h1 style={{ marginInlineStart: 8 }}>{label}</h1>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {rooms.length > 1 && (
            <Seg items={rooms.map((r) => ({ label: r.name_he, href: href({ r: r.id }), on: r.id === room.id }))} />
          )}
          <Seg
            items={[
              ["day", "יום"],
              ["week", "שבוע"],
              ["month", "חודש"],
            ].map(([k, l]) => ({ label: l, href: href({ v: k }), on: view === k }))}
          />
        </div>
      </div>
      <p className="muted" style={{ margin: "0 0 14px" }}>
        לחיצה על בלוק פנוי פותחת יצירת הזמנה ידנית או חסימה. לחיצה על הזמנה או חסימה פותחת את הפרטים.
      </p>

      {view === "month" ? (
        <div className="cal-month">
          {["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((w) => (
            <div key={w} className="wd">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const items = byDay.get(d) ?? [];
            const nb = items.filter((i) => i.kind === "booking").length;
            const nf = items.filter((i) => i.kind === "free").length;
            const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
            const open = hours.has(dowOf(d));
            return (
              <Link key={d} href={href({ v: "day", d })} className={`cal-cell${!inMonth || !open ? " off" : ""}${d === now.key ? " today" : ""}`}>
                <b>{Number(d.slice(8))}</b>
                {open && nb > 0 && <span>{nb} הזמנות</span>}
                {open && inMonth && nf > 0 && d >= now.key && <span style={{ color: "#1b6340" }}>{nf} פנויים</span>}
                {!open && <span>סגור</span>}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="cal-cols" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(${view === "week" ? 150 : 0}px, 1fr))` }}>
          {days.map((d) => {
            const items = byDay.get(d) ?? [];
            const open = hours.has(dowOf(d));
            return (
              <div key={d} className="cal-col">
                <header>
                  <b>{fmtDow(d, "he")} {Number(d.slice(8))}</b>
                  <span>{d === now.key ? "היום" : fmtShort(d, "he")}</span>
                </header>
                <div className="body">
                  {!open && <div className="muted" style={{ fontSize: 13 }}>סגור</div>}
                  {items.map((it) => (
                    <Link key={it.key} href={it.href} scroll={false} className={`slot-card ${it.kind === "free" ? "free" : it.kind === "block" ? "block" : it.status}`}>
                      <span className="t">{range(it.start, it.end)}</span>
                      <b style={{ fontWeight: 600 }}>{it.title}</b>
                      <span className="muted">{it.sub}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {one(sp.b) && <BookingDrawer id={one(sp.b)} closeHref={closeHref} />}
      {slotSel && dayHours && (
        <Drawer closeHref={closeHref} kicker="בלוק פנוי" title={`${fmtShort(slotSel.date, "he")} · ${hm(slotSel.start)}–${hm(slotSel.end)}`}>
          <Dl rows={[["חדר", room.name_he], ["תאריך", fmtLong(slotSel.date, "he")], ["שעות", range(slotSel.start, slotSel.end)]]} />
          <SlotPanel roomId={room.id} date={slotSel.date} start={slotSel.start} end={slotSel.end} dayOpen={dayHours.open} dayClose={dayHours.close} price={Number(room.price)} packages={packages} closeHref={closeHref} />
        </Drawer>
      )}
      {block && (
        <Drawer closeHref={closeHref} kicker="חסימה" title={block.reason || "חסימת זמן"}>
          <Dl
            rows={[
              ["חדר", room.name_he],
              ["תאריך", fmtLong(localParts(block.starts_at).date, "he")],
              ["שעות", range(localParts(block.starts_at).hour, localParts(block.ends_at).hour)],
            ]}
          />
          <BlockPanel id={block.id} closeHref={closeHref} />
        </Drawer>
      )}
    </>
  );
}

