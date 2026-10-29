import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AOS · משרדים וחדר ישיבות בתל אביב",
    short_name: "AOS",
    description: "Private offices and a meeting room in Tel Aviv",
    start_url: "/he",
    scope: "/",
    display: "standalone",
    lang: "he",
    dir: "rtl",
    background_color: "#ffffff",
    theme_color: "#111214",
    icons: [
      { src: "/uploads/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/uploads/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
