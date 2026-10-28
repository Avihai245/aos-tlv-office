import { AddAdmin, ChangePassword, RemoveAdmin } from "@/components/admin/team-forms";
import { Page } from "@/components/admin/ui";
import { getViewer } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Team() {
  const me = await getViewer();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id,name,email,created_at").eq("role", "admin").order("created_at");
  return (
    <Page title="צוות ניהול" lead="משתמשים עם הרשאת כניסה לממשק הניהול. מנהלים חדשים נוספים מכאן בלבד.">
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>שם</th>
                <th>אימייל</th>
                <th>נוסף</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.name || "—"} {m.id === me?.id && <span className="muted">(את/ה)</span>}
                  </td>
                  <td className="ltr">{m.email}</td>
                  <td>{fmtDate(m.created_at, "he", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td>{m.id !== me?.id && <RemoveAdmin id={m.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="stack" style={{ gap: 20 }}>
          <AddAdmin />
          {me && <ChangePassword email={me.email} />}
        </div>
      </div>
    </Page>
  );
}
