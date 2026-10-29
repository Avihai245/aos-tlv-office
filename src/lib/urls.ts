import type { Lang } from "@/i18n";
import type { Office, Room } from "./types";

/** Public addresses use readable English slugs (/he/room/meeting-room), never database ids. */
export const roomPath = (lang: Lang, room: Pick<Room, "slug">) => `/${lang}/room/${room.slug}`;
export const officePath = (lang: Lang, office: Pick<Office, "slug">) => `/${lang}/office/${office.slug}`;
export const bookingPath = (lang: Lang, ref: string) => `/${lang}/booking/${ref}`;

/** Links shared before the slugs existed carry a UUID; those are redirected to the slug address. */
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Query string of a request, to keep the visitor's selection (date, package, campaign tags) across a redirect. */
export function queryOf(sp: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, x);
  const s = q.toString();
  return s ? `?${s}` : "";
}
