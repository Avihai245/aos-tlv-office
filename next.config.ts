import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Page titles, descriptions and canonical links come from the database, so Next would otherwise stream them into the
  // body for browsers. Search and AI crawlers (and Lighthouse) read the <head>, so every client gets them there.
  htmlLimitedBots: /.*/,
  // The stylesheet is small; inlining it removes a render-blocking round trip on mobile connections.
  experimental: { inlineCss: true },
  images: {
    formats: ["image/avif", "image/webp"],
    // Optimized variants are kept for a month; the source photos rarely change.
    minimumCacheTTL: 2_678_400,
    // Photos uploaded from the admin live in the project's public Storage bucket.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      // Nothing may frame the site, inject a <base>, load plugins or post a form to another site.
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
    ];
    return [
      { source: "/:path*", headers: security },
      // Site photos, icons and the hero loop: cached for a month, revalidated in the background for another day.
      { source: "/uploads/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }] },
      // The back office and the email-link callback must never be indexed.
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/auth/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
