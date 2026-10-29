import Link from "next/link";
import { Page } from "@/components/admin/ui";
import { money, nowMs } from "@/lib/admin";
import { sourceLabel } from "@/lib/admin-meta";
import { addDays, fmtDate, localParts, nowIL } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const RANGES = [7, 30, 90];
const none = "—";
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 1000) / 10}%` : none);

type Bucket = { ov: number; rv: number; leads: number; reqs: number; value: number };
const empty = (): Bucket => ({ ov: 0, rv: 0, leads: 0, reqs: 0, value: 0 });

export default async function Marketing({ searchParams }: PageProps<"/admin/marketing">) {
  const sp = await searchParams;
  const d = RANGES.includes(Number(sp.d)) ? Number(sp.d) : 30;
  const today = nowIL().key;
  const from = addDays(today, -(d - 1));
  const fromIso = new Date(nowMs() - d * 864e5).toISOString();

  const supabase = await createClient();
  const [views, inq, bks, allInq, allBks] = await Promise.all([
    supabase.from("lp_views").select("lp,day,utm,total").gte("day", from).limit(5000),
    supabase.from("inquiries").select("source,utm,created_at").like("source", "lp-%").gte("created_at", fromIso).limit(5000),
    supabase.from("bookings").select("source,utm,total,created_at").eq("source", "lp-room").not("status", "in", "(hold,released)").gte("created_at", fromIso).limit(5000),
    supabase.from("inquiries").select("source").gte("created_at", fromIso).limit(5000),
    supabase.from("bookings").select("source").not("status", "in", "(hold,released)").gte("created_at", fromIso).limit(5000),
  ]);

  const norm = (u: string | null | undefined) => (u && u.trim()) || none;
  const total = empty();
  const byUtm = new Map<string, Bucket>();
  const byDay = new Map<string, Bucket>();
  const slot = (m: Map<string, Bucket>, k: string) => {
    let b = m.get(k);
    if (!b) m.set(k, (b = empty()));
    return b;
  };
  for (const v of views.data ?? []) {
    const n = Number(v.total) || 0;
    for (const b of [total, slot(byUtm, norm(v.utm)), slot(byDay, v.day)]) {
      if (v.lp === "offices") b.ov += n;
      else if (v.lp === "room") b.rv += n;
    }
  }
  for (const q of inq.data ?? []) {
    if (q.source !== "lp-office") continue;
    for (const b of [total, slot(byUtm, norm(q.utm)), slot(byDay, localParts(q.created_at).date)]) b.leads += 1;
  }
  for (const r of bks.data ?? []) {
    for (const b of [total, slot(byUtm, norm(r.utm)), slot(byDay, localParts(r.created_at).date)]) {
      b.reqs += 1;
      b.value += Number(r.total) || 0;
    }
  }

  const campaigns = [...byUtm.entries()].sort((a, b) => b[1].ov + b[1].rv - (a[1].ov + a[1].rv) || b[1].leads + b[1].reqs - (a[1].leads + a[1].reqs));
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 31);

  const count = (rows: { source: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.source ?? "", (m.get(r.source ?? "") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const inqBySource = count(allInq.data);
  const bksBySource = count(allBks.data);

  const kpis: [string, string][] = [
    ["צפיות · דף משרדים", String(total.ov)],
    ["בקשות סיור", String(total.leads)],
    ["המרה · משרדים", pct(total.leads, total.ov)],
    ["צפיות · דף חדר ישיבות", String(total.rv)],
    ["בקשות הזמנה", String(total.reqs)],
    ["המרה · חדר ישיבות", pct(total.reqs, total.rv)],
    ["ערך בקשות ההזמנה", money(total.value)],
  ];
  const range = (
    <div className="seg" role="group" aria-label="טווח זמן">
      {RANGES.map((r) => (
        <Link key={r} href={`/admin/marketing?d=${r}`} aria-current={r === d ? "true" : undefined} scroll={false}>
          {r} ימים
        </Link>
      ))}
    </div>
  );

  return (
    <Page
      title="שיווק ודפי נחיתה"
      lead={`הנתונים של ${d} הימים האחרונים (מ־${fmtDate(from, "he", { day: "numeric", month: "long" })}). צפיות נספרות פעם לכל כניסה לדף, בלי פרטים אישיים. פנייה או בקשת הזמנה נרשמות על הקמפיין שממנו הגיע הגולש.`}
      actions={range}
    >
      <div className="kpis" style={{ marginBottom: 28 }}>
        {kpis.map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 500, margin: "0 0 10px" }}>לפי קמפיין</h2>
        <p className="muted" style={{ margin: "0 0 10px", fontSize: 14 }}>
          הקמפיין נקרא מהכתובת (utm_source / utm_medium / utm_campaign). כניסה בלי פרמטרים מופיעה כ־״{none}״.
        </p>
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>קמפיין</th>
                <th>צפיות · משרדים</th>
                <th>בקשות סיור</th>
                <th>צפיות · חדר</th>
                <th>בקשות הזמנה</th>
                <th>ערך הבקשות</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    אין עדיין נתונים. כניסות לדפי הנחיתה יופיעו כאן.
                  </td>
                </tr>
              )}
              {campaigns.map(([u, b]) => (
                <tr key={u}>
                  <td className="ltr" style={{ textAlign: "start" }}>
                    {u}
                  </td>
                  <td>{b.ov}</td>
                  <td>
                    {b.leads}
                    {b.ov > 0 && <span className="muted"> · {pct(b.leads, b.ov)}</span>}
                  </td>
                  <td>{b.rv}</td>
                  <td>
                    {b.reqs}
                    {b.rv > 0 && <span className="muted"> · {pct(b.reqs, b.rv)}</span>}
                  </td>
                  <td>{money(b.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2" style={{ gap: 28, alignItems: "start" }}>
        <section>
          <h2 style={{ fontSize: 24, fontWeight: 500, margin: "0 0 10px" }}>לפי יום</h2>
          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 420 }}>
              <thead>
                <tr>
                  <th>יום</th>
                  <th>משרדים</th>
                  <th>סיורים</th>
                  <th>חדר</th>
                  <th>הזמנות</th>
                </tr>
              </thead>
              <tbody>
                {days.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      אין נתונים בטווח הזה.
                    </td>
                  </tr>
                )}
                {days.map(([day, b]) => (
                  <tr key={day}>
                    <td>{fmtDate(day, "he", { day: "numeric", month: "short" })}</td>
                    <td>{b.ov}</td>
                    <td>{b.leads}</td>
                    <td>{b.rv}</td>
                    <td>{b.reqs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 24, fontWeight: 500, margin: "0 0 10px" }}>פניות והזמנות לפי מקור</h2>
          <div className="card stack">
            <div>
              <b style={{ display: "block", marginBottom: 6 }}>פניות ({inqBySource.reduce((s, [, n]) => s + n, 0)})</b>
              <ul className="list">
                {inqBySource.length === 0 && <li className="muted">אין פניות בטווח.</li>}
                {inqBySource.map(([s, n]) => (
                  <li key={s || "none"}>
                    <span>{sourceLabel(s)}</span>
                    <b>{n}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <b style={{ display: "block", marginBottom: 6 }}>בקשות הזמנה והזמנות ({bksBySource.reduce((s, [, n]) => s + n, 0)})</b>
              <ul className="list">
                {bksBySource.length === 0 && <li className="muted">אין הזמנות בטווח.</li>}
                {bksBySource.map(([s, n]) => (
                  <li key={s || "none"}>
                    <span>{sourceLabel(s)}</span>
                    <b>{n}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <section className="card stack" style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 19 }}>קישורים לקמפיינים</h2>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          הוסיפו לכתובת את הפרמטרים של הקמפיין, למשל <span className="ltr">?utm_source=google&amp;utm_medium=cpc&amp;utm_campaign=offices-tlv</span>. דפי הנחיתה אינם מופיעים בגוגל בכוונה, והם מיועדים לפרסום ממומן.
        </p>
        <ul className="list">
          {[
            ["משרדים · עברית", "/he/lp/offices"],
            ["משרדים · אנגלית", "/en/lp/offices"],
            ["חדר ישיבות · עברית", "/he/lp/meeting-room"],
            ["חדר ישיבות · אנגלית", "/en/lp/meeting-room"],
          ].map(([l, h]) => (
            <li key={h}>
              <span>{l}</span>
              <a href={h} target="_blank" rel="noopener" className="ltr">
                {h} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
