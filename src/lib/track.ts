const KEY = "aos_utm";

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

/**
 * Campaign tags from the address (utm_source, utm_medium, utm_campaign), kept for the rest of the visit as "source / medium / campaign".
 * They are written onto the inquiry or booking request the visitor makes, so the back office can tell which campaign brought it.
 */
export function getUtm(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search);
  const fresh = ["utm_source", "utm_medium", "utm_campaign"].map((k) => q.get(k)).filter(Boolean).join(" / ");
  try {
    if (fresh) {
      sessionStorage.setItem(KEY, fresh);
      return fresh;
    }
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return fresh;
  }
}

/**
 * Pushes an event to window.dataLayer, where a tag manager can pick it up. Nothing is loaded or sent from here: without a tag manager
 * on the page this only fills an in-memory list.
 */
export function track(event: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as DataLayerWindow;
    (w.dataLayer = w.dataLayer || []).push({ event, ...params, device: window.innerWidth < 768 ? "mobile" : "desktop", utm: getUtm() || undefined });
  } catch {
    // Tracking must never break the page.
  }
}
