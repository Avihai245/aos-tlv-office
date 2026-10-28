import type { Lang } from "./index";

/** Strings that only exist in the production app (the prototype had no email verification or password reset). */
const X = {
  checkEmail: {
    he: "שלחנו קישור אימות לכתובת האימייל שלכם. לחצו עליו כדי להשלים את ההרשמה ולהמשיך להזמנה.",
    en: "We sent a verification link to your email. Click it to finish signing up and continue to your booking.",
  },
  notConfirmed: {
    he: "יש לאמת את כתובת האימייל לפני הכניסה. חפשו את הקישור בתיבת הדואר.",
    en: "Please verify your email address before signing in. Look for the link in your inbox.",
  },
  forgot: { he: "שכחתי סיסמה", en: "Forgot password" },
  resetSent: {
    he: "אם קיים חשבון עם האימייל הזה, נשלח אליו קישור לאיפוס הסיסמה.",
    en: "If an account exists for this email, we sent it a link to reset the password.",
  },
  resetTitle: { he: "איפוס סיסמה", en: "Reset password" },
  resetSend: { he: "שליחת קישור איפוס", en: "Send reset link" },
  newPw: { he: "סיסמה חדשה", en: "New password" },
  resetSave: { he: "שמירת סיסמה", en: "Save password" },
  resetDone: { he: "הסיסמה עודכנה.", en: "Your password was updated." },
  backToSignIn: { he: "חזרה לכניסה", en: "Back to sign in" },
  membersOnly: { he: "למנויים", en: "Members" },
  free: { he: "פנוי", en: "Open" },
  blocksFree: { he: "בלוקים פנויים ביום זה", en: "open blocks this day" },
  blockFree: { he: "בלוק פנוי ביום זה", en: "open block this day" },
  noneFree: { he: "אין בלוקים פנויים ביום זה", en: "No open blocks this day" },
  authFail: { he: "הכניסה לא הושלמה. נסו שוב.", en: "Sign-in could not be completed. Please try again." },
  morning: { he: "בוקר", en: "Morning" },
  midday: { he: "צהריים", en: "Midday" },
  afternoon: { he: "אחר הצהריים", en: "Afternoon" },
  evening: { he: "ערב", en: "Evening" },
  signOut: { he: "יציאה", en: "Sign out" },
  pkgPrice: { he: "מחיר החבילה", en: "Package price" },
  hours: { he: "שעות", en: "hours" },
} as const;

export type ExtraKey = keyof typeof X;
export const x = (key: ExtraKey, lang: Lang): string => X[key][lang];
