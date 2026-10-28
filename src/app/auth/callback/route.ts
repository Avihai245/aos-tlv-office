import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Email-link landing (sign-up confirmation, password reset). Exchanges the code for a session, then returns the user to `next`. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const raw = searchParams.get("next") ?? "/";
  // Only follow same-site relative paths.
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  const lang = next.startsWith("/en") ? "en" : "he";
  return NextResponse.redirect(`${origin}/${lang}/account?auth=failed`);
}
