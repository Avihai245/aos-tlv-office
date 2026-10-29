import { ExportBackup, SettingsForm } from "@/components/admin/settings-form";
import { getSiteLive } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { settings } = await getSiteLive();
  const supabase = await createClient();
  const { data: audit } = await supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(40);
  return (
    <>
      <SettingsForm
        content={settings.content}
        rules={{
          holdMinutes: settings.holdMinutes,
          requestHours: settings.requestHours,
          cancelHours: settings.cancelHours,
          windowDays: settings.windowDays,
          samedayLeadHours: settings.samedayLeadHours,
          memberPrice: settings.memberPrice,
          memberPct: Math.round(settings.memberDiscount * 100),
          taxPct: settings.taxPct,
          taxMode: settings.taxMode,
        }}
      />
      <section className="card stack" style={{ marginTop: 20 }}>
        <div className="row">
          <h2 style={{ fontSize: 19 }}>נתונים ויומן פעולות</h2>
          <ExportBackup />
        </div>
        <div className="list">
          {(audit ?? []).map((a) => (
            <div key={a.id} style={{ display: "flex", gap: 16, padding: "10px 0", borderTop: "1px solid #edeeef", fontSize: 14, flexWrap: "wrap" }}>
              <span className="muted" style={{ minWidth: 150 }}>{fmtDateTime(a.at, "he")}</span>
              <span>
                <b>{a.action}</b> · <span className="muted ltr">{a.actor_email}</span> <span className="muted ltr">{a.ref}</span>
              </span>
            </div>
          ))}
          {(audit ?? []).length === 0 && <p className="muted" style={{ margin: 0 }}>אין עדיין פעולות ביומן.</p>}
        </div>
      </section>
    </>
  );
}
