import Link from "next/link";
import { AvailabilitySwitch, OfficeEditor, type OfficeData } from "@/components/admin/office-editor";
import { Page } from "@/components/admin/ui";
import { money } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Img } from "@/lib/types";

const LIBRARY: Img[] = [{ src: "uploads/931cc9ac-0ab6-4c0b-9206-25caa380dab7.JPG", he: "משרד פרטי במתחם", en: "A private office at AOS" }];
const STATUS: Record<string, string> = { unset: "זמינות בבירור", available: "פנוי", reserved: "שמור", occupied: "מאוכלס", unavailable: "לא זמין" };

export default async function OfficesAdmin({ searchParams }: PageProps<"/admin/offices">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: offices } = await supabase.from("offices").select("*").order("sort_order");
  const list = offices ?? [];
  const want = Array.isArray(sp.o) ? sp.o[0] : sp.o;
  const x = list.find((o) => o.id === want) ?? list[0];

  let data: OfficeData | null = null;
  let users: { id: string; name: string; email: string }[] = [];
  if (x) {
    const [{ data: adm }, { data: links }] = await Promise.all([
      supabase.from("office_admin").select("*").eq("office_id", x.id).maybeSingle(),
      supabase.from("office_tenants").select("user_id").eq("office_id", x.id),
    ]);
    const ids = (links ?? []).map((l) => l.user_id);
    const { data: profs } = ids.length ? await supabase.from("profiles").select("id,name,email").in("id", ids) : { data: [] };
    users = (profs ?? []).map((p) => ({ id: p.id, name: p.name || p.email, email: p.email }));
    data = {
      id: x.id,
      code: x.code,
      nameHe: x.name_he,
      nameEn: x.name_en,
      descHe: x.desc_he,
      descEn: x.desc_en,
      amenitiesHe: x.amenities_he ?? [],
      amenitiesEn: x.amenities_en ?? [],
      images: Array.isArray(x.images) ? (x.images as unknown as Img[]) : [],
      price: Number(x.price ?? 0),
      mgmtFee: Number(x.mgmt_fee ?? 0),
      freeHours: Number(x.free_hours ?? 0),
      hourRate: Number(x.hour_rate ?? 0),
      status: x.status,
      visible: x.visible,
      tenant: { name: adm?.tenant_name ?? "", email: adm?.tenant_email ?? "", phone: adm?.tenant_phone ?? "", since: adm?.tenant_since ?? "", notes: adm?.notes ?? "" },
    };
  }

  return (
    <Page title={`משרדים · ${list.length}`} lead="המתג ליד כל משרד קובע אם הוא זמין: משרד זמין מוצג באתר ופתוח לפניות, משרד לא זמין מוסתר מהאתר.">
      <div className="split">
        <div className="stack" style={{ gap: 8 }}>
          {list.map((o) => (
            <div key={o.id} className={`office-row${x && o.id === x.id ? " on" : ""}`}>
              <Link href={`/admin/offices?o=${o.id}`}>
                <b>{o.name_he}</b>
                <span>
                  {STATUS[o.status] ?? o.status}
                  {o.price ? ` · ${money(o.price)}` : ""}
                </span>
              </Link>
              <AvailabilitySwitch id={o.id} on={o.status === "available"} label={o.status === "available" ? "זמין" : "לא זמין"} />
            </div>
          ))}
        </div>
        {data && (
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 22 }}>{data.nameHe}</h2>
              <span className="muted ltr">{data.code}</span>
            </div>
            <OfficeEditor key={x.updated_at + users.length} office={data} users={users} library={LIBRARY} />
          </div>
        )}
      </div>
    </Page>
  );
}
