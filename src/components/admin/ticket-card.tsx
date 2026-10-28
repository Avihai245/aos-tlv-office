"use client";

import { useState } from "react";
import { TICKET_COLS } from "@/lib/admin-meta";
import { Notice, useRpc } from "./use-rpc";

export type TicketView = {
  id: string;
  title: string;
  kind: string;
  meta: string;
  status: string;
  images: string[];
  internal: string;
  thread: { who: string; at: string; text: string; staff: boolean; system: boolean }[];
};

const ORDER = ["open", "progress", "done"];
const LABEL = Object.fromEntries(TICKET_COLS.map(([k, l]) => [k, l]));

export function TicketCard({ t }: { t: TicketView }) {
  const { call, busy, err, msg } = useRpc();
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(t.internal);
  const i = ORDER.indexOf(t.status);

  return (
    <article className="k-card">
      <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
        <b>{t.title}</b>
        <span className="tag t-n">{t.kind}</span>
      </div>
      <span className="meta">{t.meta}</span>
      {t.images.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {t.images.map((g) => (
            <a key={g} href={g} target="_blank" rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g} alt="תמונה מהקריאה" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, display: "block" }} />
            </a>
          ))}
        </div>
      )}
      <div>
        <b style={{ fontSize: 14 }}>שיחה עם השוכר</b>
        <div role="log" className="thread" style={{ marginTop: 6 }}>
          {t.thread.length === 0 && <span className="muted" style={{ fontSize: 13 }}>עדיין אין הודעות.</span>}
          {t.thread.map((m, n) => (
            <div key={n} className={m.staff ? "m staff" : "m"}>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <b>{m.who}</b>
                <span className="muted">{m.at}</span>
              </div>
              {m.text}
            </div>
          ))}
        </div>
      </div>
      <div className="fld">
        <label htmlFor={`r-${t.id}`}>הודעה לשוכר (גלויה לו)</label>
        <textarea id={`r-${t.id}`} className="in" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="כתבו עדכון לשוכר" />
      </div>
      <div className="fld">
        <label htmlFor={`i-${t.id}`}>סיכום פנימי (רק לצוות)</label>
        <textarea id={`i-${t.id}`} className="in" rows={2} value={internal} onChange={(e) => setInternal(e.target.value)} />
      </div>
      <Notice err={err} msg={msg} />
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <button
          type="button"
          className="btn b-s b-sm"
          disabled={busy || (!reply.trim() && internal === t.internal)}
          onClick={() => void call("admin_update_ticket", { p_ticket: t.id, p_reply: reply, p_internal: internal === t.internal ? null : internal }, "נשמר", () => setReply(""))}
        >
          {reply.trim() ? "שליחה לשוכר" : "שמירה"}
        </button>
        <span style={{ display: "flex", gap: 6 }}>
          {i > 0 && (
            <button type="button" className="btn b-g b-sm" disabled={busy} onClick={() => void call("admin_update_ticket", { p_ticket: t.id, p_status: ORDER[i - 1] }, "הסטטוס עודכן")}>
              → {LABEL[ORDER[i - 1]]}
            </button>
          )}
          {i < ORDER.length - 1 && (
            <button type="button" className="btn b-p b-sm" disabled={busy} onClick={() => void call("admin_update_ticket", { p_ticket: t.id, p_status: ORDER[i + 1] }, "הסטטוס עודכן")}>
              {LABEL[ORDER[i + 1]]} ←
            </button>
          )}
        </span>
      </div>
    </article>
  );
}
