import { NextResponse } from "next/server";

/**
 * Redirects that survive Amplify's CloudFront and Lambda hosting, where the host name a request carries inside the function
 * can differ from the public one.
 *
 * Route handlers answer with a relative Location header, which the browser resolves against the address it asked for.
 */
export const redirectTo = (path: string, status: 307 | 308 = 307) => new NextResponse(null, { status, headers: { Location: path } });

/**
 * Middleware must return an absolute URL. In production this is built from NEXT_PUBLIC_SITE_URL when it is set;
 * otherwise (local development, previews) from the request itself.
 */
export function absoluteRedirect(requestUrl: string, path: string) {
  const site = process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_SITE_URL : undefined;
  return NextResponse.redirect(new URL(path, site || requestUrl));
}
