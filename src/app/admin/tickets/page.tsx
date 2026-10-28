import { Page } from "@/components/admin/ui";
import { TicketCard, type TicketView } from "@/components/admin/ticket-card";
import { TICKET_COLS } from "@/lib/admin-meta";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Tickets() {
  const supabase = await createClient();
  const { data: tickets } = await supabase.from("tickets").select("*").order("updated_at", { ascending: false }).limit(300);
  const ids = (tickets ?? []).map((t) => t.id);
  const [{ data: msgs }, { data: internal }, { data: offices }, { data: users }] = await Promise.all([
    ids.length ? supabase.from("ticket_messages").select("*").in("ticket_id", ids).order("at") : { data: [] },
    ids.length ? supabase.from("ticket_internal").select("*").in("ticket_id", ids) : { data: [] },
    supabase.from("offices").select("id,name_he"),
    supabase.from("profiles").select("id,name,email"),
  ]);
  const officeName = new Map((offices ?? []).map((o) => [o.id, o.name_he as string]));
  const userName = new Map((users ?? []).map((u) => [u.id, (u.name || u.email) as string]));
  const note = new Map((internal ?? []).map((n) => [n.ticket_id, n.note as string]));

  const cards: TicketView[] = (tickets ?? []).map((t) => ({
    id: t.id,
    title: t.subject,
    kind: t.kind === "fault" ? "תקלה" : "בקשה",
    meta: [officeName.get(t.office_id), t.user_id ? userName.get(t.user_id) : null, fmtDateTime(t.created_at, "he")].filter(Boolean).join(" · "),
    status: t.status,
    images: t.images ?? [],
    internal: note.get(t.id) ?? "",
    thread: (msgs ?? [])
      .filter((m) => m.ticket_id === t.id)
      .map((m) => ({
        who: m.by === "system" ? "מערכת" : m.name || (m.by === "staff" ? "צוות" : "שוכר"),
        at: fmtDateTime(m.at, "he"),
        text: m.by === "system" ? `הסטטוס שונה ל־${m.status === "open" ? "חדשה" : m.status === "progress" ? "בטיפול" : "טופלה"}` : m.text,
        staff: m.by === "staff",
        system: m.by === "system",
      })),
  }));

  return (
    <Page title="קריאות שירות" lead="קריאות שהשוכרים פתחו באזור שלהם. המענה מוצג לשוכר, הסיכום הפנימי נשאר אצל הצוות.">
      <div className="kanban">
        {TICKET_COLS.map(([key, label, color]) => {
          const list = cards.filter((c) => c.status === key);
          return (
            <section key={key} className="k-col">
              <header>
                <b>
                  <i style={{ background: color }} />
                  {label}
                </b>
                <span className="tag t-n">{list.length}</span>
              </header>
              {list.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14, padding: "6px 4px" }}>אין כרטיסים</p>}
              {list.map((c) => (
                <TicketCard key={c.id + c.status + c.thread.length} t={c} />
              ))}
            </section>
          );
        })}
      </div>
    </Page>
  );
}
