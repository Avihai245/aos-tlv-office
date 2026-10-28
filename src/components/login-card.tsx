"use client";

import { useRouter } from "next/navigation";
import type { Dict, Lang } from "@/i18n";
import { AuthPanel } from "./auth-panel";

export function LoginCard({ lang, t, next, bare }: { lang: Lang; t: Dict; next: string; bare?: boolean }) {
  const router = useRouter();
  return (
    <div className={bare ? undefined : "login-card"}>
      <AuthPanel lang={lang} t={t} idp="ac" next={next} onSuccess={() => router.refresh()} />
    </div>
  );
}
