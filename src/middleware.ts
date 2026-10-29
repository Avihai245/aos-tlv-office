import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { absoluteRedirect } from "@/lib/redirect";

const LOCALES = ["he", "en"] as const;
const DEFAULT_LOCALE = "he";

function pickLocale(request: NextRequest) {
  const saved = request.cookies.get("aos_lang")?.value;
  if (saved === "he" || saved === "en") return saved;
  return DEFAULT_LOCALE;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // /auth is the email-link callback and /admin is the Hebrew-only back office: neither takes a language prefix.
  const isAuthRoute = pathname.startsWith("/auth/") || pathname === "/admin" || pathname.startsWith("/admin/");
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  if (!hasLocale && !isAuthRoute) {
    return absoluteRedirect(request.url, `/${pickLocale(request)}${pathname === "/" ? "" : pathname}${request.nextUrl.search}`);
  }

  // Let Server Components know the requested path (used by the not-found page), and refresh the Supabase session.
  request.headers.set("x-pathname", pathname);
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|webmanifest)$).*)"],
};
