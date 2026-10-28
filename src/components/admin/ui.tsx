import Link from "next/link";

export type TagTone = "ok" | "warn" | "n" | "bad";

export function Tag({ tone = "n", children }: { tone?: TagTone; children: React.ReactNode }) {
  return <span className={`tag t-${tone}`}>{children}</span>;
}

export const bookingTone = (s: string): TagTone => (s === "confirmed" ? "ok" : s === "pending_payment" ? "warn" : s === "cancelled" || s === "expired" ? "n" : "n");

/** Side panel opened by a search parameter; the scrim is a link that removes it again. */
export function Drawer({ closeHref, kicker, title, children }: { closeHref: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <>
      <Link href={closeHref} scroll={false} className="scrim" aria-label="סגירה" />
      <aside role="dialog" aria-modal="true" aria-labelledby="dr-h" className="drawer">
        <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
          <div>
            <div className="kick">{kicker}</div>
            <h2 id="dr-h" style={{ fontSize: 22, marginTop: 2 }}>
              {title}
            </h2>
          </div>
          <Link href={closeHref} scroll={false} className="btn b-g" aria-label="סגירה">
            ✕
          </Link>
        </div>
        {children}
      </aside>
    </>
  );
}

export function Dl({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="dl">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Seg({ items }: { items: { label: string; href: string; on: boolean }[] }) {
  return (
    <div role="group" className="seg">
      {items.map((i) => (
        <Link key={i.label} href={i.href} aria-current={i.on ? "true" : undefined} scroll={false}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function Page({ title, lead, actions, children }: { title: string; lead?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div className="row" style={{ marginBottom: lead ? 0 : 20 }}>
        <h1>{title}</h1>
        {actions}
      </div>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </>
  );
}
