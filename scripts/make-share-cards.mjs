// Renders the link-preview cards (1200x630) used by WhatsApp, Facebook, LinkedIn and X:
// public/uploads/og-{home,room}-{he,en}.jpg, from the plain photos og-home.jpg and og-room.jpg.
// Needs Google Chrome (set CHROME_PATH if it is not in the default macOS location) and network access for the web fonts.
// Run: node scripts/make-share-cards.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UPLOADS = resolve("public/uploads");
const work = mkdtempSync(join(tmpdir(), "aos-cards-"));

// Keep the wording free of prices and counts so the cards do not go stale when the catalogue changes.
const cards = {
  home: {
    he: { a: "משרדים וחדר ישיבות", b: "בלב תל אביב", sub: "משרדים פרטיים מרוהטים וחדר ישיבות להזמנה אונליין", addr: "מנחם בגין 150, תל אביב" },
    en: { a: "Private offices and a", b: "meeting room in Tel Aviv", sub: "Furnished private offices and a meeting room you book online", addr: "Menachem Begin 150, Tel Aviv" },
  },
  room: {
    he: { a: "חדר ישיבות", b: "בלב תל אביב", sub: "להזמנה אונליין: 3 שעות, חצי יום או יום מלא", addr: "מנחם בגין 150, תל אביב" },
    en: { a: "A meeting room", b: "in central Tel Aviv", sub: "Book online: 3 hours, half a day or a full day", addr: "Menachem Begin 150, Tel Aviv" },
  },
};

const html = (kind, lang, c) => {
  const rtl = lang === "he";
  const side = rtl ? "right" : "left";
  const grad = rtl ? "to left" : "to right";
  return `<!doctype html><html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400&family=IBM+Plex+Sans+Hebrew:wght@400;600;700&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:630px;overflow:hidden;background:#111214}
body{position:relative;font-family:"IBM Plex Sans Hebrew",system-ui,sans-serif;color:#fff}
.bg{position:absolute;inset:0;background:url(file://${UPLOADS}/og-${kind}.jpg) center/cover no-repeat}
.shade{position:absolute;inset:0;background:linear-gradient(${grad},rgba(17,18,20,.97) 0%,rgba(17,18,20,.93) 34%,rgba(17,18,20,.68) 56%,rgba(17,18,20,.12) 82%,rgba(17,18,20,0) 100%)}
.edge{position:absolute;top:0;bottom:0;${side}:0;width:8px;background:linear-gradient(#e9d29a,#c3a46a 55%,#9c7a3c)}
.panel{position:absolute;top:0;bottom:0;${side}:8px;width:780px;padding:58px 66px 54px;display:flex;flex-direction:column;justify-content:space-between}
.logo{direction:ltr;display:inline-grid;justify-items:center;row-gap:13px;align-self:flex-start}
.mark{font-family:"Frank Ruhl Libre",serif;font-size:92px;line-height:1;letter-spacing:.3em;margin-right:-.3em;background:linear-gradient(110deg,#c3a46a 0%,#f4e3b4 48%,#c3a46a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.subl{font-size:15px;font-weight:600;letter-spacing:.36em;margin-right:-.36em;color:#e6e7e9;white-space:nowrap}
h1{font-size:${rtl ? 60 : 50}px;line-height:1.08;font-weight:700;letter-spacing:${rtl ? "-.02em" : "-.025em"}}
h1 span{display:block}
h1 .g{color:#c3a46a}
.sub{margin-top:22px;font-size:24px;line-height:1.45;color:#e6e7e9;max-width:600px;text-wrap:balance}
.addr{display:flex;align-items:center;gap:14px;font-size:22px;font-weight:600;color:#c3a46a}
.addr i{display:block;width:44px;height:2px;background:#c3a46a}
</style></head><body>
<div class="bg"></div><div class="shade"></div><div class="edge"></div>
<div class="panel">
  <div class="logo"><div class="mark">AOS</div><div class="subl">OFFICES · MEETINGS</div></div>
  <div><h1><span>${c.a}</span><span class="g">${c.b}</span></h1><p class="sub">${c.sub}</p></div>
  <div class="addr"><i></i><span>${c.addr}</span></div>
</div></body></html>`;
};

for (const [kind, langs] of Object.entries(cards)) {
  for (const [lang, c] of Object.entries(langs)) {
    const page = join(work, `${kind}-${lang}.html`);
    const png = join(work, `${kind}-${lang}.png`);
    writeFileSync(page, html(kind, lang, c));
    execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--allow-file-access-from-files", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1200,630", "--virtual-time-budget=15000", `--screenshot=${png}`, `file://${page}`], { stdio: "ignore", timeout: 90_000 });
    // WhatsApp skips preview images much above 300 KB, so aim well under that.
    let q = 82;
    let buf;
    do {
      buf = await sharp(png).resize(1200, 630).jpeg({ quality: q, mozjpeg: true, progressive: true }).toBuffer();
      q -= 6;
    } while (buf.length > 190 * 1024 && q > 50);
    writeFileSync(join(UPLOADS, `og-${kind}-${lang}.jpg`), buf);
    console.log(`og-${kind}-${lang}.jpg  ${Math.round(buf.length / 1024)} KB`);
  }
}
