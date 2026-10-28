import { InquiryCard, type InquiryView } from "@/components/admin/inquiry-card";
import { INQUIRY_COLS } from "@/lib/admin-meta";
import { Page } from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const KIND: Record<string, string> = { contact: "יצירת קשר", office: "משרד", membership: "מנוי", tour: "סיור" };

export default async function Inquiries() {
  const supabase = await createClient();
  const [{ data }, { data: offices }] = await Promise.all([
    supabase.from("inquiries").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("offices").select("id,name_he"),
  ]);
  const officeName = new Map((offices ?? []).map((o) => [o.id, o.name_he as string]));
  const cards: InquiryView[] = (data ?? []).map((q) => ({
    id: q.id,
    title: q.name,
    kind: KIND[q.kind] ?? q.kind,
    meta: [q.office_id ? officeName.get(q.office_id) : null, q.phone, q.email, fmtDateTime(q.created_at, "he")].filter(Boolean).join(" · "),
    msg: q.msg,
    notes: q.notes,
    status: q.status,
  }));

  return (
    <Page title="פניות מהאתר" lead="פניות שהגיעו מטפסי האתר. העבירו כל פנייה בין השלבים בכפתורים וכתבו סיכום פנימי.">
      <div className="kanban">
        {INQUIRY_COLS.map(([key, label, color]) => {
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
                <InquiryCard key={c.id + c.status} q={c} />
              ))}
            </section>
          );
        })}
      </div>
    </Page>
  );
}
