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
