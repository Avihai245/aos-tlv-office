import Link from "next/link";
import { Page, Tag } from "@/components/admin/ui";
import { bookingView } from "@/lib/admin";
import { fmtMonth, money, nowIL, parseKey } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const shift = (month: string, n: number) => {
  const d = parseKey(`${month}-01`);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default async function Tenants({ searchParams }: PageProps<"/admin/tenants">) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(one(sp.m)) ? one(sp.m) : nowIL().key.slice(0, 7);
  const supabase = await createClient();
  const [{ data: offices }, { data: links }, { data: adm }, { data: bks }] = await Promise.all([
    supabase.from("offices").select("id,name_he,free_hours,hour_rate,status").order("sort_order"),
    supabase.from("office_tenants").select("office_id"),
    supabase.from("office_admin").select("office_id,tenant_name,tenant_email"),
    supabase
      .from("bookings")
      .select("id,office_id,starts_at,ends_at,free_hours,paid_hours,total,status")
      .eq("tenant", true)
      .in("status", ["pending_payment", "confirmed"])
      .gte("starts_at", new Date(Date.parse(`${month}-01T00:00:00Z`) - 864e5).toISOString())
      .lt("starts_at", new Date(Date.parse(`${shift(month, 1)}-01T00:00:00Z`) + 864e5).toISOString())
      .order("starts_at"),
  ]);
  const linked = new Set((links ?? []).map((l) => l.office_id));
  const info = new Map((adm ?? []).map((a) => [a.office_id, a]));
  const inMonth = (bks ?? []).filter((b) => bookingView(b).date.startsWith(month));
  const names = new Map((offices ?? []).map((o) => [o.id, o.name_he as string]));

  const rows = (offices ?? [])
    .filter((o) => linked.has(o.id) || info.get(o.id)?.tenant_name)
    .map((o) => {
      const mine = inMonth.filter((b) => b.office_id === o.id);
      const used = mine.reduce((s, b) => s + Number(b.free_hours), 0);
      const paid = mine.reduce((s, b) => s + Number(b.paid_hours), 0);
      const due = mine.reduce((s, b) => s + Number(b.total), 0);
      const free = Number(o.free_hours);
      return { o, tenant: info.get(o.id), free, used, left: Math.max(0, free - used), hours: used + paid, paid, due };
    });

  return (
    <Page
      title="שוכרי משרדים"
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={`/admin/tenants?m=${shift(month, -1)}`} className="btn b-s" aria-label="חודש קודם">›</Link>
          <b>{fmtMonth(`${month}-01`, "he")}</b>
          <Link href={`/admin/tenants?m=${shift(month, 1)}`} className="btn b-s" aria-label="חודש הבא">‹</Link>
        </div>
      }
      lead={`שעות החינם והמחיר לשעה נקבעים לכל משרד בלשונית ״משרדים״. דייר מתחבר לאזור השוכרים באתר עם החשבון שמשויך למשרד.`}
    >
      <div className="tbl-wrap" style={{ marginBottom: 20 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>משרד</th>
              <th>שוכר</th>
              <th>שעות חינם</th>
              <th>נוצלו</th>
              <th>נותרו</th>
              <th>סה״כ שעות</th>
              <th>שעות בתשלום</th>
              <th>לחיוב</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.o.id}>
                <td><b>{r.o.name_he}</b></td>
                <td>
                  {r.tenant?.tenant_name || "—"}
                  <br />
                  <span className="muted ltr" style={{ fontSize: 13 }}>{r.tenant?.tenant_email}</span>
                </td>
                <td>{r.free}</td>
                <td>{r.used}</td>
                <td><Tag tone={r.left > 0 ? "ok" : "warn"}>{r.left}</Tag></td>
                <td>{r.hours}</td>
                <td>{r.paid}</td>
                <td><b className="ltr">{money(r.due)}</b></td>
                <td><Link href={`/admin/offices?o=${r.o.id}`} className="btn b-g b-sm">הגדרות</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty">אין עדיין משרדים עם שוכרים. אפשר לשייך דיירים בלשונית ״משרדים״.</p>}
      </div>

      <div className="grid-2">
        <div className="card stack">
          <h2 style={{ fontSize: 19 }}>כל השריונים של השוכרים · {fmtMonth(`${month}-01`, "he")}</h2>
          {inMonth.length === 0 && <p className="muted" style={{ margin: 0 }}>אין שריונים בחודש הזה.</p>}
          <ul className="list">
            {inMonth.map((b) => {
              const v = bookingView(b);
              return (
                <li key={b.id}>
                  <span>
                    <b>{names.get(b.office_id ?? "") ?? "—"}</b> · {v.dateLabel} · <span className="muted">{v.time}</span>
                  </span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {Number(b.free_hours) > 0 ? `${b.free_hours} שעות חינם` : ""}
                    {Number(b.paid_hours) > 0 ? ` ${b.paid_hours} בתשלום · ${money(b.total)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card stack">
          <h2 style={{ fontSize: 19 }}>קריאות שירות</h2>
          <p className="muted" style={{ margin: 0 }}>הקריאות מנוהלות בלוח נפרד.</p>
          <div>
            <Link href="/admin/tickets" className="btn b-p">ללוח הקריאות</Link>
          </div>
        </div>
      </div>
    </Page>
  );
}
