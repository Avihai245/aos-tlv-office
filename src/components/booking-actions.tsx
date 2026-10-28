"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errText, type Dict, type Lang } from "@/i18n";
import { pad } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

/** Downloads an .ics file so the booking can be added to any calendar app. */
export function AddToCalendar({
  id,
  date,
  start,
  end,
  title,
  location,
  label,
}: {
  id: string;
  date: string;
  start: number;
  end: number;
  title: string;
  location: string;
  label: string;
}) {
  const download = () => {
    const d = date.replace(/-/g, "");
    const f = (h: number) => pad(Math.floor(h)) + pad(Math.round((h % 1) * 60)) + "00";
    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AOS//Bookings//EN",
      "BEGIN:VEVENT",
      `UID:${id}@aos`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;TZID=Asia/Jerusalem:${d}T${f(start)}`,
      `DTEND;TZID=Asia/Jerusalem:${d}T${f(end)}`,
      `SUMMARY:AOS – ${title}`,
      `LOCATION:${location}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    a.download = `${id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  return (
    <button type="button" className="btn btn-gold" style={{ height: 52, padding: "0 22px", fontSize: 16, borderRadius: 12 }} onClick={download}>
      {label}
    </button>
  );
}

export function CancelBooking({ id, lang, t, cancelHours }: { id: string; lang: Lang; t: Dict; cancelHours: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function cancel() {
    if (!window.confirm(t.confirmCancel)) return;
    setBusy(true);
    const { data, error } = await createClient().rpc("cancel_booking", { p_booking: id, p_reason: "customer" });
    setBusy(false);
    const code = error ? "gen" : (data as { err?: string } | null)?.err;
    if (code) window.alert(errText(code, lang, cancelHours));
    router.refresh();
  }
  return (
    <button type="button" disabled={busy} onClick={cancel} style={{ minHeight: 40, border: 0, background: "none", color: "var(--err)", fontSize: 15, fontWeight: 500, cursor: "pointer", padding: 0 }}>
      {t.cancel}
    </button>
  );
}

export function SignOutButton({ lang, label, className }: { lang: Lang; label: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await createClient().auth.signOut();
        router.push(`/${lang}`);
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
