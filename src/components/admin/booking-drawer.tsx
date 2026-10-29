import { payText, statusText } from "@/i18n";
import { bookingView, getRoomNames, money, type BookingRow } from "@/lib/admin";
import { sourceLabel } from "@/lib/admin-meta";
import { fmtDateTime, fmtLong } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { BookingActions } from "./booking-actions";
import { Dl, Drawer, Tag, bookingTone } from "./ui";

/** Booking details, status history and the staff actions, for the `?b=` search parameter. */
export async function BookingDrawer({ id, closeHref }: { id: string; closeHref: string }) {
  const supabase = await createClient();
  const [{ data }, { data: events }, rooms] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", id).maybeSingle(),
    supabase.from("booking_events").select("*").eq("booking_id", id).order("at"),
    getRoomNames(),
  ]);
  const b = data as BookingRow | null;
  if (!b) {
    return (
      <Drawer closeHref={closeHref} kicker="הזמנה" title="לא נמצאה">
        <p className="muted">ההזמנה לא קיימת.</p>
      </Drawer>
    );
  }
  const v = bookingView(b);
  return (
    <Drawer closeHref={closeHref} kicker={`הזמנה · ${b.ref}`} title={b.name || b.email || "לקוח"}>
      <Dl
        rows={[
          ["מספר הזמנה", <span key="r" className="ltr">{b.ref}</span>],
          ["לקוח", b.name || "—"],
          ["אימייל", <span key="e" className="ltr">{b.email || "—"}</span>],
          ["טלפון", <span key="p" className="ltr">{b.phone || "—"}</span>],
          ["חדר", rooms.get(b.room_id) ?? "—"],
          ["מועד", `${fmtLong(v.date, "he")} · ${v.time}`],
          ["סכום", <span key="t" className="ltr">{money(b.total)}</span>],
          ["סטטוס", <Tag key="s" tone={bookingTone(b.status)}>{statusText(b.status, "he")}</Tag>],
          ["תשלום", payText(b.pay, "he")],
          ["מקור", b.tenant ? "שוכר משרד" : sourceLabel(b.source)],
          ...(b.note ? ([["הערה", b.note]] as [string, string][]) : []),
          ...(b.expires_at && ["hold", "pending_payment"].includes(b.status) ? ([["בתוקף עד", fmtDateTime(b.expires_at, "he")]] as [string, string][]) : []),
        ]}
      />
      <BookingActions b={{ id: b.id, status: b.status, pay: b.pay, total: Number(b.total), userId: b.user_id }} />
      <div className="sect hist">
        <h3>היסטוריית סטטוסים</h3>
        {(events ?? []).map((e) => (
          <div key={e.id}>
            <span>{fmtDateTime(e.at, "he")}</span> · <b>{statusText(e.status, "he")}</b> · <span>{e.by}</span> <span>{e.note}</span>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
