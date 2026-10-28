"use client";

import { useState } from "react";
import { Notice, useRpc } from "./use-rpc";

export function CustomerForm({ id, notes, type }: { id: string; notes: string; type: string }) {
  const { call, busy, err, msg } = useRpc();
  const [n, setN] = useState(notes);
  const [t, setT] = useState(type);
  return (
    <div className="sect">
      <Notice err={err} msg={msg} />
      <div className="fld">
        <label htmlFor="cus-type">סוג לקוח</label>
        <select id="cus-type" className="in" value={t} onChange={(e) => setT(e.target.value)}>
          <option value="meeting">לקוח חדר ישיבות</option>
          <option value="tenant">דייר משרד</option>
        </select>
      </div>
      <div className="fld">
        <label htmlFor="cus-notes">הערות פנימיות</label>
        <textarea id="cus-notes" className="in" rows={3} value={n} onChange={(e) => setN(e.target.value)} />
      </div>
      <div>
        <button type="button" className="btn b-s" disabled={busy} onClick={() => void call("admin_update_customer", { p_user: id, p_type: t, p_notes: n }, "הפרטים נשמרו")}>
          שמירה
        </button>
      </div>
    </div>
  );
}
