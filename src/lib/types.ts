import type { Lang } from "@/i18n";

export type Img = { src: string; he: string; en: string };

export type Room = {
  id: string;
  code: string;
  nameHe: string;
  nameEn: string;
  descHe: string;
  descEn: string;
  capacity: number;
  price: number;
  priceHalf: number;
  priceDay: number;
  equipHe: string[];
  equipEn: string[];
  amenitiesHe: string[];
  amenitiesEn: string[];
  images: Img[];
  /** open weekdays (0 = Sunday) → opening hours */
  hours: Record<number, { open: number; close: number }>;
};

export type Office = {
  id: string;
  code: string;
  nameHe: string;
  nameEn: string;
  descHe: string;
  descEn: string;
  amenitiesHe: string[];
  amenitiesEn: string[];
  images: Img[];
  price: number | null;
  mgmtFee: number | null;
  status: "unset" | "available" | "occupied" | "reserved" | "unavailable";
};

export type Pkg = { id: string; hours: number; nameHe: string; nameEn: string; starts: number[] };

export type SiteContent = {
  addressHe: string;
  addressEn: string;
  hoursAHe: string;
  hoursAEn: string;
  hoursBHe: string;
  hoursBEn: string;
  heroAHe: string;
  heroAEn: string;
  heroBHe: string;
  heroBEn: string;
  heroSubHe: string;
  heroSubEn: string;
  phone: string;
  email: string;
  whatsapp: string;
};

export type Settings = {
  content: SiteContent;
  holdMinutes: number;
  requestHours: number;
  cancelHours: number;
  windowDays: number;
  taxMode: "none" | "included" | "added";
  taxPct: number;
  memberPrice: number;
  memberDiscount: number;
  samedayLeadHours: number;
};

export type Site = { settings: Settings; rooms: Room[]; offices: Office[]; packages: Pkg[] };

export type SlotState = "free" | "held" | "booked" | "blocked" | "past" | "members_only";
export type Slot = { day: string; start: number; end: number; pkg: string; state: SlotState; price: number; total: number };

export type Viewer = {
  id: string;
  email: string;
  name: string;
  phone: string;
  company: string;
  role: "customer" | "admin";
  isMember: boolean;
  memberUntil: string | null;
  officeId: string | null;
};

export type Quote = {
  base: number;
  unit: number;
  disc: number;
  sub: number;
  tax: number;
  taxMode: "none" | "included" | "added";
  taxPct: number;
  total: number;
  hours: number;
  pkg: string;
  member: boolean;
};

export type BookingStatus = "hold" | "pending_payment" | "confirmed" | "cancelled" | "expired" | "released";

export type Booking = {
  id: string;
  ref: string;
  room_id: string;
  user_id: string | null;
  status: BookingStatus;
  pay: string;
  total: number;
  quote: Quote;
  expires_at: string | null;
  starts_at: string;
  ends_at: string;
  package: string | null;
  date: string;
  start: number;
  end: number;
};

export type Bi = { he: string; en: string };
export const pickLang = <T,>(lang: Lang, he: T, en: T): T => (lang === "he" ? he : en);
