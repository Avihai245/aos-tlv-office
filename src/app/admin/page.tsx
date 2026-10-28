import Link from "next/link";
import { MemberActivate } from "@/components/admin/member-activate";
import { Tag, bookingTone } from "@/components/admin/ui";
import { BookingRow, bookingView, getRoomNames, money, nowMs, weekOccupancy } from "@/lib/admin";
import { fmtDate, fmtLong, nowIL } from "@/lib/format";
import { payText, statusText } from "@/i18n";
import { createClient } from "@/lib/supabase/server";

export default async function Overview() {
  const supabase = await createClient();
  const today = nowIL().key;
  const roomNames = await getRoomNames();
  const since = new Date(nowMs() - 2 * 864e5).toISOString();
  const head = { count: "exact", head: true } as const;

  const [bks, confirmed, pays, offices, inq, newInq, cus, mems, refunds] = await Promise.all([
    supabase.from("bookings").select("*").in("status", ["pending_payment", "confirmed"]).gte("ends_at", since).order("starts_at").limit(500),
    supabase.from("bookings").select("id", head).eq("status", "confirmed"),
    supabase.from("payments").select("amount"),
    supabase.from("offices").select("status"),
    supabase.from("inquiries").select("id,name,kind,created_at,msg").eq("status", "new").order("created_at", { ascending: false }).limit(5),
    supabase.from("inquiries").select("id", head).eq("status", "new"),
    supabase.from("customers_v").select("id,name,email,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("memberships").select("user_id,status,since,until,total"),
    supabase.from("bookings").select("id", head).eq("pay", "refund_pending"),
  ]);

  const rows = (bks.data ?? []) as BookingRow[];
  const todayList = rows.filter((b) => bookingView(b).date === today);
  const upList = rows.filter((b) => bookingView(b).date > today);
  const revenue = (pays.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const occ = await weekOccupancy(rows);
  const offs = offices.data ?? [];
  const offAvail = offs.filter((o) => o.status === "available").length;
  const offOcc = offs.filter((o) => o.status === "occupied").length;

  const memRows = mems.data ?? [];
  const ids = memRows.map((m) => m.user_id);
  const { data: memProfiles } = ids.length ? await supabase.from("profiles").select("id,name,email").in("id", ids) : { data: [] };
  const profMap = new Map((memProfiles ?? []).map((p) => [p.id, p]));
  const now = nowMs();
  const active = memRows.filter((m) => m.status === "active" && (!m.until || new Date(m.until).getTime() > now));
  const pending = memRows.filter((m) => m.status === "pending_payment");
  const memRevenue = active.reduce((s, m) => s + Number(m.total), 0);

  const [ptCount, tkCount] = await Promise.all([
    supabase.from("bookings").select("id", head).eq("status", "pending_payment"),
    supabase.from("tickets").select("id", head).eq("status", "open"),
  ]);
  const alerts = [
    { n: ptCount.count ?? 0, text: (n: number) => `${n} בקשות הזמנה ממתינות לתשלום`, href: "/admin/bookings?s=pending_payment", action: "לבדיקה" },
    { n: refunds.count ?? 0, text: (n: number) => `${n} החזרים ממתינים לטיפול`, href: "/admin/bookings", action: "להזמנות" },
    { n: pending.length, text: (n: number) => `${n} בקשות הצטרפות למנוי ממתינות להפעלה`, href: "/admin", action: "להפעלה" },
    { n: tkCount.count ?? 0, text: (n: number) => `${n} קריאות שירות פתוחות`, href: "/admin/tickets", action: "לקריאות" },
    { n: newInq.count ?? 0, text: (n: number) => `${n} פניות חדשות`, href: "/admin/inquiries", action: "לפניות" },
  ].filter((a) => a.n > 0);

  const kpis: [string, string][] = [
    ["הזמנות היום", String(todayList.length)],
    ["הזמנות קרובות", String(upList.length)],
    ["הזמנות מאושרות (סה״כ)", String(confirmed.count ?? 0)],
    ["הכנסות מתשלומים מאומתים", money(revenue)],
    ["תפוסת חדרים · 7 ימים", occ === null ? "—" : `${occ}%`],
    ["משרדים פנויים / מאוכלסים", `${offAvail} / ${offOcc}`],
    ["פניות חדשות", String(newInq.count ?? 0)],
  ];

  const bookingItem = (b: BookingRow, withDate: boolean) => {
    const v = bookingView(b);
    return (
      <Link key={b.id} href={`/admin/bookings?b=${b.id}`} scroll={false} style={{ display: "flex", gap: 14, alignItems: "center", padding: "12px 0", borderTop: "1px solid #edeeef", width: "100%" }}>
        {withDate ? (
          <span style={{ minWidth: 130, fontSize: 14 }}>
            {v.dateLabel}
            <br />
            <span className="ltr" style={{ color: "#6e5320" }}>{v.time}</span>
          </span>
        ) : (
          <span className="ltr" style={{ fontSize: 22, fontWeight: 700, color: "#6e5320", minWidth: 110 }}>{v.time}</span>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontWeight: 500 }}>{b.name || b.email}</b>
          <br />
          <span style={{ fontSize: 13 }} className="muted">
            {roomNames.get(b.room_id) ?? "—"}
            {withDate ? "" : ` · ${payText(b.pay, "he")}`}
          </span>
        </span>
        <Tag tone={bookingTone(b.status)}>{statusText(b.status, "he")}</Tag>
      </Link>
    );
  };

  return (
    <>
      <h1 style={{ fontSize: 40, fontWeight: 500, margin: "0 0 20px", lineHeight: 1 }}>סקירה · {fmtLong(today, "he")}</h1>
      <div className="kpis" style={{ marginBottom: 28 }}>
        {kpis.map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>

      <div className="card stack" style={{ marginBottom: 28 }}>
        <div className="row" style={{ alignItems: "baseline" }}>
          <h2 style={{ fontSize: 19 }}>מנויי חדר ישיבות</h2>
          <span className="muted">{money(memRevenue)} לחודש</span>
        </div>
        <div className="minis">
          {[
            ["פעילים", active.length, "#e6f2ea", "#1b6340"],
            ["ממתינים לתשלום", pending.length, "#fbf0da", "#74500f"],
            ["סה״כ נרשמו", memRows.length, "#f3f3f2", "#111214"],
          ].map(([k, v, bg, c]) => (
            <div key={String(k)} style={{ background: String(bg) }}>
              <span>{k}</span>
              <b style={{ color: String(c) }}>{v}</b>
            </div>
          ))}
        </div>
        {memRows.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>אין עדיין מנויים. בקשות הצטרפות מופיעות כאן וגם בלשונית ״פניות״.</p>}
        <ul className="list">
          {memRows.map((m) => {
            const p = profMap.get(m.user_id);
            const isActive = active.includes(m);
            return (
              <li key={m.user_id}>
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: "block", fontWeight: 600 }}>{p?.name || p?.email}</b>
                  <span className="muted ltr">{p?.email}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Tag tone={isActive ? "ok" : m.status === "pending_payment" ? "warn" : "n"}>{isActive ? "פעיל" : m.status === "pending_payment" ? "ממתין לתשלום" : "בוטל"}</Tag>
                  {m.until && <span className="muted">עד {fmtDate(m.until, "he", { day: "numeric", month: "short" })}</span>}
                  {m.status === "pending_payment" && <MemberActivate userId={m.user_id} />}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {alerts.length > 0 && (
        <div className="alerts" style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.2em", color: "#6e5320", fontWeight: 600 }}>התראות תפעוליות</div>
          {alerts.map((a) => (
            <div key={a.href + a.n}>
              <span>
                <i />
                {a.text(a.n)}
              </span>
              <Link href={a.href} className="btn b-g b-sm">
                {a.action}
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2" style={{ gap: 28 }}>
        <section>
          <h2 style={{ fontSize: 26, fontWeight: 500, margin: "0 0 10px" }}>הזמנות היום</h2>
          {todayList.length === 0 && <p className="muted" style={{ margin: 0, padding: "14px 0", borderTop: "1px solid #e4e5e7" }}>אין הזמנות להיום.</p>}
          {todayList.map((b) => bookingItem(b, false))}
        </section>
        <section>
          <h2 style={{ fontSize: 26, fontWeight: 500, margin: "0 0 10px" }}>הזמנות קרובות</h2>
          {upList.length === 0 && <p className="muted" style={{ margin: 0, padding: "14px 0", borderTop: "1px solid #e4e5e7" }}>אין הזמנות קרובות.</p>}
          {upList.slice(0, 6).map((b) => bookingItem(b, true))}
        </section>
        <section>
          <h2 style={{ fontSize: 26, fontWeight: 500, margin: "0 0 10px" }}>פניות חדשות</h2>
          {(inq.data ?? []).length === 0 && <p className="muted" style={{ margin: 0, padding: "14px 0", borderTop: "1px solid #e4e5e7" }}>אין פניות חדשות.</p>}
          {(inq.data ?? []).map((q) => (
            <div key={q.id} className="row" style={{ padding: "12px 0", borderTop: "1px solid #edeeef", flexWrap: "nowrap" }}>
              <span>
                <b style={{ fontWeight: 500 }}>{q.name}</b>
                <br />
                <span className="muted" style={{ fontSize: 13 }}>{q.msg ? q.msg.slice(0, 60) : q.kind}</span>
              </span>
              <span className="muted" style={{ fontSize: 13 }}>{fmtDate(q.created_at, "he", { day: "numeric", month: "short" })}</span>
            </div>
          ))}
        </section>
        <section>
          <h2 style={{ fontSize: 26, fontWeight: 500, margin: "0 0 10px" }}>לקוחות אחרונים</h2>
          {(cus.data ?? []).length === 0 && <p className="muted" style={{ margin: 0, padding: "14px 0", borderTop: "1px solid #e4e5e7" }}>אין לקוחות עדיין.</p>}
          {(cus.data ?? []).map((u) => (
            <Link key={u.id} href={`/admin/customers?c=${u.id}`} scroll={false} className="row" style={{ padding: "12px 0", borderTop: "1px solid #edeeef", flexWrap: "nowrap", width: "100%" }}>
              <span>
                <b style={{ fontWeight: 500 }}>{u.name || u.email}</b>
                <br />
                <span className="muted ltr" style={{ fontSize: 13 }}>{u.email}</span>
              </span>
              <span className="muted" style={{ fontSize: 13 }}>{u.created_at ? fmtDate(u.created_at, "he", { day: "numeric", month: "short" }) : ""}</span>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
