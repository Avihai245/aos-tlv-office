import { notFound, redirect } from "next/navigation";
import { isLang } from "@/i18n";
import { getSite } from "@/lib/data";

export default async function Rooms({ params }: PageProps<"/[lang]/rooms">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const { rooms } = await getSite();
  if (!rooms.length) notFound();
  redirect(`/${lang}/room/${rooms[0].id}`);
}
