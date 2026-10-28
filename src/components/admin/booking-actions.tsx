"use client";

import Link from "next/link";
import { useState } from "react";
import { money } from "@/lib/format";
import { Notice, useRpc } from "./use-rpc";

export type ActionBooking = { id: string; status: string; pay: string; total: number; userId: string | null };

export function BookingActions({ b }: { b: ActionBooking }) {
  const { call, busy, err, msg } = useRpc();
  const [ref, setRef] = useState("");
  const [reason, setReason] = useState("");
  const live = b.status === "pending_payment" || b.status === "confirmed";
  const canPay = live && ["awaiting", "unpaid", "none"].includes(b.pay);
  const canConfirm = b.status === "pending_payment";
  const canRefund = b.pay === "refund_pending";

  return (
    <>
      <Notice err={err} msg={msg} />
      {canPay && (
        <div className="sect">
          <h3>רישום תשלום שהתקבל</h3>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>לתשלום שהתקבל מחוץ לאתר. רישום התשלום מאשר את ההזמנה.</p>
          <div className="fld">
            <label htmlFor="pay-ref">אסמכתה (אופציונלי)</label>
            <input id="pay-ref" className="in" dir="ltr" value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <button type="button" className="btn b-p" disabled={busy} onClick={() => void call("record_payment", { p_booking: b.id, p_amount: b.total, p_method: "offline", p_ref: ref || null }, "התשלום נרשם וההזמנה אושרה")}>
            רישום תשלום · <span className="ltr">{money(b.total)}</span>
          </button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canConfirm && (
          <button type="button" className="btn b-s" disabled={busy} onClick={() => void call("confirm_unpaid", { p_booking: b.id }, "ההזמנה אושרה ללא תשלום")}>
            אישור ללא תשלום
          </button>
        )}
        {canRefund && (
          <button type="button" className="btn b-s" disabled={busy} onClick={() => void call("mark_refunded", { p_booking: b.id, p_ref: null }, "ההחזר סומן כבוצע")}>
            סימון ההחזר כבוצע
          </button>
        )}
        {b.userId && (
          <Link href={`/admin/customers?c=${b.userId}`} scroll={false} className="btn b-g">
            פרופיל הלקוח
          </Link>
        )}
      </div>
      {live && (
        <div className="sect">
          <h3>ביטול הזמנה</h3>
          <div className="fld">
            <label htmlFor="cn-reason">סיבה</label>
            <input id="cn-reason" className="in" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {b.pay === "paid" ? "ההזמנה שולמה: הביטול יסמן אותה לטיפול בהחזר." : "הבלוק ישוחרר ויחזור להיות פנוי."}
          </p>
          <div>
            <button type="button" className="btn b-danger" disabled={busy} onClick={() => window.confirm("לבטל את ההזמנה?") && void call("cancel_booking", { p_booking: b.id, p_reason: reason || "admin" }, "ההזמנה בוטלה")}>
              ביטול ההזמנה ושחרור הבלוק
            </button>
          </div>
        </div>
      )}
    </>
  );
}
