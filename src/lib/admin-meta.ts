/** Board columns for the back office: [status, label, colour]. Plain data, so server pages and client cards can both import it. */
export const INQUIRY_COLS: [string, string, string][] = [
  ["new", "חדשות", "#c3a46a"],
  ["contacted", "נוצר קשר", "#5e6268"],
  ["progress", "בטיפול", "#74500f"],
  ["closed", "נסגרו", "#1b6340"],
];

export const TICKET_COLS: [string, string, string][] = [
  ["open", "חדשות", "#c3a46a"],
  ["progress", "בטיפול", "#74500f"],
  ["done", "טופלו", "#1b6340"],
];

/** Where an inquiry or booking came from, as the back office shows it. */
const SOURCES: Record<string, string> = {
  "lp-office": "דף נחיתה · משרדים",
  "lp-room": "דף נחיתה · חדר ישיבות",
  home: "האתר · עמוד הבית",
  office: "האתר · עמוד משרד",
  membership: "האתר · מנוי",
  web: "האתר",
};
export const sourceLabel = (s: string | null | undefined) => (s ? SOURCES[s] ?? s : "לא ידוע");
export const isLandingSource = (s: string | null | undefined) => !!s && s.startsWith("lp-");
