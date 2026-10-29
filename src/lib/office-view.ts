import type { Dict, Lang } from "@/i18n";
import { officeStatusText } from "@/i18n";
import type { OfficeView } from "@/components/office-explorer";
import { imgSrc, money } from "./format";
import type { Office } from "./types";
import { officePath } from "./urls";

export const officeOpen = (o: Office) => o.status === "available" || o.status === "unset";

export function officeView(o: Office, lang: Lang, t: Dict): OfficeView {
  const he = lang === "he";
  const img = o.images[0];
  const pill = o.status === "available" ? "available" : o.status === "reserved" ? "reserved" : "other";
  const amen = he ? o.amenitiesHe : o.amenitiesEn;
  const priced = (o.price ?? 0) > 0;
  const fee = (o.mgmtFee ?? 0) > 0;
  return {
    id: o.id,
    idx: String(parseInt(o.code.replace(/\D/g, ""), 10) || 0).padStart(2, "0"),
    name: he ? o.nameHe : o.nameEn,
    amen: amen.slice(0, 3).join(" · "),
    amenList: amen,
    rent: priced ? `${money(o.price)} ${t.monthly}` : t.priceReq,
    feeLine: priced && fee ? (he ? `+ ${money(o.mgmtFee)} דמי ניהול` : `+ ${money(o.mgmtFee)} management fee`) : "",
    vatL: priced ? (he ? "+ מע״מ" : "+ VAT") : "",
    status: officeStatusText(o.status, lang),
    pill,
    img: img ? imgSrc(img.src) : "",
    alt: img ? (he ? img.he : img.en) || (he ? o.nameHe : o.nameEn) : "",
    href: officePath(lang, o),
    cta: officeOpen(o) ? t.getDetails : t.viewOff2,
  };
}
