"use client";

import { Notice, useRpc } from "./use-rpc";

export function MemberActivate({ userId }: { userId: string }) {
  const { call, busy, err, msg } = useRpc();
  return (
    <>
      <button type="button" className="btn b-p b-sm" disabled={busy} onClick={() => void call("admin_set_membership", { p_user: userId, p_status: "active" }, "המנוי הופעל")}>
        הפעלה
      </button>
      {(err || msg) && <Notice err={err} msg={msg} />}
    </>
  );
}
