import type { NextRequest } from "next/server";
import { redirectTo } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

/** Email-link landing (sign-up confirmation, password reset). Exchanges the code for a session, then returns the user to `next`. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const raw = searchParams.get("next") ?? "/";
  // Only follow same-site relative paths.
  // A backslash after the first slash counts as a second slash in browsers (/\\evil.com), so both are refused.
  const next = /^\/(?![\/\\])[^\u0000-\u001f]*$/.test(raw) ? raw : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(next);
  }
  const lang = next.startsWith("/en") ? "en" : "he";
  return redirectTo(`/${lang}/account?auth=failed`);
}
