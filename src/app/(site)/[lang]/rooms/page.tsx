import { notFound, redirect } from "next/navigation";
import { isLang } from "@/i18n";
import { getSite } from "@/lib/data";
import { roomPath } from "@/lib/urls";

export default async function Rooms({ params }: PageProps<"/[lang]/rooms">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const { rooms } = await getSite();
  if (!rooms.length) notFound();
  redirect(roomPath(lang, rooms[0]));
}
