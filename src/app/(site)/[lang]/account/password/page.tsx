import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PasswordForm } from "@/components/password-form";
import { getT, isLang } from "@/i18n";
import { x } from "@/i18n/extra";
import { getViewer } from "@/lib/data";

export const metadata: Metadata = { robots: { index: false } };

/** Landing page of the password-reset email: the callback has already signed the user in. */
export default async function PasswordPage({ params }: PageProps<"/[lang]/account/password">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  const viewer = await getViewer();
  return (
    <section aria-labelledby="pw-h" className="doc" style={{ maxWidth: 560 }}>
      <h1 id="pw-h">{x("resetTitle", lang)}</h1>
      {viewer ? (
        <PasswordForm lang={lang} t={t} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
          <p style={{ margin: 0 }}>{x("resetSent", lang)}</p>
          <Link href={`/${lang}/account`} className="btn btn-dark" style={{ height: 52, padding: "0 24px", borderRadius: 12 }}>
            {t.signInL}
          </Link>
        </div>
      )}
    </section>
  );
}
