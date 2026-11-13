import { Frank_Ruhl_Libre, IBM_Plex_Sans_Hebrew } from "next/font/google";

// Three weights only: anything set to 500 renders in the 400 face, which keeps one font file pair off every page.
export const plex = IBM_Plex_Sans_Hebrew({ subsets: ["hebrew", "latin"], weight: ["400", "600", "700"], variable: "--font-plex", display: "swap" });
// The logo only uses Latin letters, so the Hebrew subset is not shipped.
export const frank = Frank_Ruhl_Libre({ subsets: ["latin"], weight: "400", variable: "--font-frank", display: "swap" });
// Headlines: one medium weight of the same serif, in Hebrew and Latin. Not preloaded, so the hero photo keeps the bandwidth;
// the fallback serif is metric-adjusted, so the swap does not move the layout.
export const display = Frank_Ruhl_Libre({ subsets: ["hebrew", "latin"], weight: "500", variable: "--font-display-face", display: "swap", preload: false });
