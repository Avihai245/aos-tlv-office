"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Badges = { bookings: number; tickets: number; inquiries: number };

const ITEMS: { href: string; label: string; sub?: boolean; group?: string; badge?: keyof Badges }[] = [
  { href: "/admin", label: "סקירה" },
  { href: "", label: "חדר הישיבות", group: "grp" },
  { href: "/admin/room", label: "פרטי החדר ותמחור", sub: true },
  { href: "/admin/calendar", label: "יומן", sub: true },
  { href: "/admin/bookings", label: "הזמנות", sub: true, badge: "bookings" },
  { href: "/admin/customers", label: "לקוחות החדר", sub: true },
  { href: "/admin/offices", label: "משרדים" },
  { href: "/admin/tenants", label: "שוכרים" },
  { href: "/admin/tickets", label: "קריאות שירות", sub: true, badge: "tickets" },
  { href: "/admin/inquiries", label: "פניות", badge: "inquiries" },
  { href: "/admin/team", label: "צוות ניהול" },
  { href: "/admin/settings", label: "תוכן והגדרות" },
];

const current = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));

export function AdminSide({ email, badges }: { email: string; badges: Badges }) {
  const path = usePathname();
  const router = useRouter();
  const out = async () => {
    await createClient().auth.signOut();
    router.refresh();
  };
  return (
    <>
      <aside className="adm-side" aria-label="ניווט ניהול">
        <div className="adm-brand">
          <span className="adm-logo">AOS</span>
          <span className="adm-chip">ADMIN</span>
        </div>
        <nav className="adm-nav">
          {ITEMS.map((i) =>
            i.group ? (
              <div key={i.label} className="grp">
                {i.label}
              </div>
            ) : (
              <Link key={i.href} href={i.href} className={i.sub ? "sub" : undefined} aria-current={current(path, i.href) ? "page" : undefined}>
                {i.label}
                {i.badge && badges[i.badge] > 0 && <span className="badge">{badges[i.badge]}</span>}
              </Link>
            ),
          )}
        </nav>
        <div className="me">
          <span>{email}</span>
          <div>
            <a href="/he" target="_blank" rel="noopener">
              לאתר ↗
            </a>
            <button type="button" onClick={out}>
              יציאה
            </button>
          </div>
        </div>
      </aside>
      <header className="adm-top">
        <div className="adm-topbar">
          <span className="adm-logo" style={{ fontSize: 22, letterSpacing: "0.3em" }}>
            AOS
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a href="/he" target="_blank" rel="noopener" style={{ color: "#fff", fontSize: 14 }}>
              לאתר ↗
            </a>
            <button type="button" onClick={out} style={{ height: 36, padding: "0 12px", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, background: "transparent", color: "#fff", cursor: "pointer" }}>
              יציאה
            </button>
          </div>
        </div>
        <nav aria-label="ניווט ניהול" className="adm-topnav">
          {ITEMS.filter((i) => !i.group).map((i) => (
            <Link key={i.href} href={i.href} aria-current={current(path, i.href) ? "page" : undefined}>
              {i.label}
              {i.badge && badges[i.badge] > 0 && <span className="badge" style={{ background: "#c3a46a", color: "#111214", borderRadius: 999, padding: "0 6px", fontSize: 11, fontWeight: 700 }}>{badges[i.badge]}</span>}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
