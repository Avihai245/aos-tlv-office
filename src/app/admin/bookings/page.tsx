import Link from "next/link";
import { BookingDrawer } from "@/components/admin/booking-drawer";
import { Page, Seg, Tag, bookingTone } from "@/components/admin/ui";
import { BOOKING_STATUS_FILTERS, bookingView, getRoomNames, money, type BookingRow } from "@/lib/admin";
import { payText, statusText } from "@/i18n";
import { createClient } from "@/lib/supabase/server";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Bookings({ searchParams }: PageProps<"/admin/bookings">) {
  const sp = await searchParams;
  const s = one(sp.s) || "all";
  const q = one(sp.q).trim().toLowerCase();
  const open = one(sp.b);

  const supabase = await createClient();
  let query = supabase.from("bookings").select("*").order("starts_at", { ascending: false }).limit(400);
  if (s !== "all") query = query.eq("status", s);
  const [{ data }, rooms] = await Promise.all([query, getRoomNames()]);
  const rows = ((data ?? []) as BookingRow[]).filter(
    (b) => !q || [b.name, b.email, b.phone, b.ref].some((x) => (x ?? "").toLowerCase().includes(q)),
  );

  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { s, q: one(sp.q), ...over };
    for (const [k, v] of Object.entries(cur)) if (v && !(k === "s" && v === "all")) p.set(k, v);
    const str = p.toString();
    return `/admin/bookings${str ? `?${str}` : ""}`;
  };

  return (
    <>
      <Page
        title="הזמנות"
        actions={
          <Link href="/admin/calendar" className="btn b-p">
            + הזמנה ידנית ביומן
          </Link>
        }
      >
        <div className="filters">
          <form action="/admin/bookings" method="get">
            <input className="in" name="q" defaultValue={one(sp.q)} placeholder="חיפוש לפי שם, אימייל, טלפון או מספר הזמנה" aria-label="חיפוש" />
            {s !== "all" && <input type="hidden" name="s" value={s} />}
            <button type="submit" className="btn b-s">
              חיפוש
            </button>
          </form>
          <Seg items={BOOKING_STATUS_FILTERS.map(([k, label]) => ({ label, href: href({ s: k, b: "" }), on: s === k }))} />
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>מספר</th>
                <th>לקוח</th>
                <th>חדר</th>
                <th>מועד</th>
                <th>סכום</th>
                <th>סטטוס</th>
                <th>תשלום</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const v = bookingView(b);
                return (
                  <tr key={b.id}>
                    <td className="ltr">{b.ref}</td>
                    <td>
                      <b>{b.name || "—"}</b>
                      <br />
                      <span className="muted ltr" style={{ fontSize: 13 }}>{b.email}</span>
                    </td>
                    <td>{rooms.get(b.room_id) ?? "—"}</td>
                    <td>
                      {v.dateLabel}
                      <br />
                      <span className="muted" style={{ fontSize: 13 }}>{v.time}</span>
                    </td>
                    <td className="ltr">{money(b.total)}</td>
                    <td>
                      <Tag tone={bookingTone(b.status)}>{statusText(b.status, "he")}</Tag>
                    </td>
                    <td>{payText(b.pay, "he")}</td>
                    <td>
                      <Link href={href({ b: b.id })} scroll={false} className="btn b-s b-sm">
                        פרטים
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="empty">אין הזמנות להצגה.</p>}
        </div>
      </Page>
      {open && <BookingDrawer id={open} closeHref={href({ b: "" })} />}
    </>
  );
}
