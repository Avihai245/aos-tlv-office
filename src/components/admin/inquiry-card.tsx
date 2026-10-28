"use client";

import { useState } from "react";
import { INQUIRY_COLS } from "@/lib/admin-meta";
import { Notice, useRpc } from "./use-rpc";

export type InquiryView = {
  id: string;
  title: string;
  kind: string;
  meta: string;
  msg: string;
  notes: string;
  status: string;
};

const ORDER = ["new", "contacted", "progress", "closed"];
const LABEL = Object.fromEntries(INQUIRY_COLS.map(([k, l]) => [k, l]));

export function InquiryCard({ q }: { q: InquiryView }) {
  const { run, supabase, busy, err, msg } = useRpc();
  const [notes, setNotes] = useState(q.notes);
  const i = ORDER.indexOf(q.status);
  const save = (status: string) => void run(() => supabase.from("inquiries").update({ status, notes }).eq("id", q.id), "הפנייה עודכנה");

  return (
    <article className="k-card">
      <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
        <b>{q.title}</b>
        <span className="tag t-n">{q.kind}</span>
      </div>
      <span className="meta">{q.meta}</span>
      {q.msg && <p className="msg">{q.msg}</p>}
      <div className="fld">
        <label htmlFor={`n-${q.id}`}>סיכום פנימי (רק לצוות)</label>
        <textarea id={`n-${q.id}`} className="in" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Notice err={err} msg={msg} />
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <button type="button" className="btn b-s b-sm" disabled={busy || notes === q.notes} onClick={() => save(q.status)}>
          שמירת הסיכום
        </button>
        <span style={{ display: "flex", gap: 6 }}>
          {i > 0 && (
            <button type="button" className="btn b-g b-sm" disabled={busy} onClick={() => save(ORDER[i - 1])} title={LABEL[ORDER[i - 1]]}>
              → {LABEL[ORDER[i - 1]]}
            </button>
          )}
          {i < ORDER.length - 1 && (
            <button type="button" className="btn b-p b-sm" disabled={busy} onClick={() => save(ORDER[i + 1])} title={LABEL[ORDER[i + 1]]}>
              {LABEL[ORDER[i + 1]]} ←
            </button>
          )}
        </span>
      </div>
    </article>
  );
}
