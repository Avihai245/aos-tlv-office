import type { Metadata, Viewport } from "next";
import { AdminGate } from "@/components/admin/gate";
import { AdminSide } from "@/components/admin/nav";
import { getViewer } from "@/lib/data";
import { frank, plex } from "@/lib/fonts";
import { createClient } from "@/lib/supabase/server";
import "@/styles/admin.css";

export const metadata: Metadata = { title: "AOS · ניהול", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

async function badges() {
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;
  const [b, t, i] = await Promise.all([
    supabase.from("bookings").select("id", head).eq("status", "pending_payment"),
    supabase.from("tickets").select("id", head).eq("status", "open"),
    supabase.from("inquiries").select("id", head).eq("status", "new"),
  ]);
  return { bookings: b.count ?? 0, tickets: t.count ?? 0, inquiries: i.count ?? 0 };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const admin = viewer?.role === "admin" ? viewer : null;
  return (
    <html lang="he" dir="rtl" className={`${plex.variable} ${frank.variable}`}>
      <body className="adm">
        {admin ? (
          <div className="adm-shell">
            <AdminSide email={admin.email} badges={await badges()} />
            <div style={{ minWidth: 0 }}>
              <main className="adm-main">{children}</main>
            </div>
          </div>
        ) : (
          <AdminGate email={viewer?.email ?? null} />
        )}
      </body>
    </html>
  );
}
