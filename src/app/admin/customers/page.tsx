import Link from "next/link";
import { CustomerForm } from "@/components/admin/customer-form";
import { Dl, Drawer, Page, Seg, Tag, bookingTone } from "@/components/admin/ui";
import { payText, statusText } from "@/i18n";
import { bookingView, getRoomNames, money, type BookingRow } from "@/lib/admin";
import { fmtDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const KIND: Record<string, [string, "ok" | "warn" | "n"]> = {
  tenant: ["דייר", "warn"],
  member: ["מנוי", "ok"],
  onetime: ["חד־פעמי", "n"],
  registered: ["רשום", "n"],
};
const FILTERS: [string, string][] = [
  ["all", "הכל"],
  ["member", "מנויים"],
  ["onetime", "חד־פעמיים"],
  ["registered", "רשומים"],
  ["tenant", "דיירים"],
];

export default async function Customers({ searchParams }: PageProps<"/admin/customers">) {
  const sp = await searchParams;
  const k = one(sp.k) || "all";
  const q = one(sp.q).trim().toLowerCase();
  const open = one(sp.c);
  const supabase = await createClient();

  const [cus, bks, pays] = await Promise.all([
    supabase.from("customers_v").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("bookings").select("user_id,status").in("status", ["pending_payment", "confirmed"]),
    supabase.from("payments").select("user_id,amount"),
  ]);
  const count = new Map<string, number>();
  for (const b of bks.data ?? []) if (b.user_id) count.set(b.user_id, (count.get(b.user_id) ?? 0) + 1);
  const spend = new Map<string, number>();
  for (const p of pays.data ?? []) if (p.user_id) spend.set(p.user_id, (spend.get(p.user_id) ?? 0) + Number(p.amount));

  const rows = (cus.data ?? []).filter(
    (u) => (k === "all" || u.kind === k) && (!q || [u.name, u.email, u.phone, u.company].some((x) => (x ?? "").toLowerCase().includes(q))),
  );
  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { k, q: one(sp.q), ...over };
    for (const [a, b] of Object.entries(cur)) if (b && !(a === "k" && b === "all")) p.set(a, b);
    const str = p.toString();
    return `/admin/customers${str ? `?${str}` : ""}`;
  };

  return (
    <>
      <Page title="לקוחות חדר הישיבות">
        <div className="filters">
          <form action="/admin/customers" method="get">
            <input className="in" name="q" defaultValue={one(sp.q)} placeholder="חיפוש לפי שם, אימייל, טלפון או חברה" aria-label="חיפוש" />
            {k !== "all" && <input type="hidden" name="k" value={k} />}
            <button type="submit" className="btn b-s">חיפוש</button>
          </form>
          <Seg items={FILTERS.map(([v, label]) => ({ label, href: href({ k: v, c: "" }), on: k === v }))} />
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>לקוח</th>
                <th>אימייל</th>
                <th>טלפון</th>
                <th>סוג</th>
                <th>הזמנות</th>
                <th>תשלומים</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const [label, tone] = KIND[u.kind ?? "registered"] ?? KIND.registered;
                return (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name || "—"}</b>
                      <br />
                      <span className="muted" style={{ fontSize: 13 }}>{u.company}</span>
                    </td>
                    <td className="ltr">{u.email}</td>
                    <td className="ltr">{u.phone}</td>
                    <td><Tag tone={tone}>{label}</Tag></td>
                    <td>{count.get(u.id as string) ?? 0}</td>
                    <td className="ltr">{money(spend.get(u.id as string) ?? 0)}</td>
                    <td>
                      <Link href={href({ c: u.id as string })} scroll={false} className="btn b-s b-sm">פרופיל</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="empty">אין לקוחות להצגה. לקוח נוצר כשמישהו פותח חשבון באתר או כשנרשמת הזמנה ידנית.</p>}
        </div>
      </Page>
      {open && <CustomerDrawer id={open} closeHref={href({ c: "" })} />}
    </>
  );
}

async function CustomerDrawer({ id, closeHref }: { id: string; closeHref: string }) {
  const supabase = await createClient();
  const [{ data: u }, { data: bks }, { data: pays }, { data: inq }, rooms] = await Promise.all([
    supabase.from("customers_v").select("*").eq("id", id).maybeSingle(),
    supabase.from("bookings").select("*").eq("user_id", id).order("starts_at", { ascending: false }).limit(50),
    supabase.from("payments").select("*").eq("user_id", id).order("at", { ascending: false }),
    supabase.from("inquiries").select("id,kind,msg,status,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    getRoomNames(),
  ]);
  if (!u) {
    return (
      <Drawer closeHref={closeHref} kicker="לקוח" title="לא נמצא">
        <p className="muted">הלקוח לא קיים.</p>
      </Drawer>
    );
  }
  const [label, tone] = KIND[u.kind ?? "registered"] ?? KIND.registered;
  const total = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
  return (
    <Drawer closeHref={closeHref} kicker="לקוח" title={u.name || u.email || "לקוח"}>
      <Dl
        rows={[
          ["אימייל", <span key="e" className="ltr">{u.email}</span>],
          ["טלפון", <span key="p" className="ltr">{u.phone || "—"}</span>],
          ["חברה", u.company || "—"],
          ["סוג", <Tag key="k" tone={tone}>{label}</Tag>],
          ["נרשם", u.created_at ? fmtDate(u.created_at, "he", { day: "numeric", month: "long", year: "numeric" }) : "—"],
          ["כניסה אחרונה", u.last_login_at ? fmtDate(u.last_login_at, "he", { day: "numeric", month: "long", year: "numeric" }) : "—"],
        ]}
      />
      <CustomerForm id={id} notes={u.notes ?? ""} type={u.type ?? "meeting"} />
      <div className="sect">
        <div className="row">
          <h3>תשלומים וקבלות</h3>
          <span className="muted ltr">{money(total)}</span>
        </div>
        {(pays ?? []).length === 0 && <p className="muted" style={{ margin: 0 }}>אין עדיין תשלומים ללקוח הזה.</p>}
        <ul className="list">
          {(pays ?? []).map((p) => (
            <li key={p.id}>
              <span>
                <b className="ltr">{p.ref}</b>
                <br />
                <span className="muted" style={{ fontSize: 13 }}>{fmtDate(p.at, "he", { day: "numeric", month: "short", year: "numeric" })} · {p.status === "refund" ? "החזר" : "תשלום"}</span>
              </span>
              <b className="ltr">{money(p.amount)}</b>
            </li>
          ))}
        </ul>
      </div>
      <div className="sect">
        <h3>הזמנות</h3>
        {(bks ?? []).length === 0 && <p className="muted" style={{ margin: 0 }}>אין הזמנות.</p>}
        <div className="list">
          {((bks ?? []) as BookingRow[]).map((b) => {
            const v = bookingView(b);
            return (
              <Link key={b.id} href={`/admin/bookings?b=${b.id}`}>
                <span>
                  {v.dateLabel} · <span className="muted">{v.time}</span>
                  <br />
                  <span className="muted" style={{ fontSize: 13 }}>{rooms.get(b.room_id) ?? "—"}</span>
                </span>
                <span style={{ textAlign: "end" }}>
                  <Tag tone={bookingTone(b.status)}>{statusText(b.status, "he")}</Tag>
                  <br />
                  <span className="muted" style={{ fontSize: 13 }}>{payText(b.pay, "he")}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="sect">
        <h3>פניות</h3>
        {(inq ?? []).length === 0 && <p className="muted" style={{ margin: 0 }}>אין פניות.</p>}
        {(inq ?? []).map((q) => (
          <div key={q.id} style={{ fontSize: 14 }}>
            {q.msg ? q.msg.slice(0, 70) : q.kind} · {fmtDate(q.created_at, "he", { day: "numeric", month: "short" })} · {q.status}
          </div>
        ))}
      </div>
    </Drawer>
  );
}
