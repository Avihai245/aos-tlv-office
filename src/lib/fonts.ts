import { Frank_Ruhl_Libre, IBM_Plex_Sans_Hebrew } from "next/font/google";

export const plex = IBM_Plex_Sans_Hebrew({ subsets: ["hebrew", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });
// The logo only uses Latin letters, so the Hebrew subset is not shipped.
export const frank = Frank_Ruhl_Libre({ subsets: ["latin"], weight: "400", variable: "--font-frank", display: "swap" });
