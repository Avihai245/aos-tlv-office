"use client";

import { useState } from "react";
import { imgSrc } from "@/lib/format";
import type { Img } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const MAX = 5 * 1024 * 1024;

/** Editable photo list: alt texts in both languages, order, removal, and upload to the public `site-images` bucket. */
export function ImageList({ images, onChange, folder, library }: { images: Img[]; onChange: (next: Img[]) => void; folder: string; library: Img[] }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (i: number, p: Partial<Img>) => onChange(images.map((g, n) => (n === i ? { ...g, ...p } : g)));
  const spare = library.filter((l) => !images.some((g) => g.src === l.src));

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setErr("אפשר להעלות JPG, PNG או WebP בלבד");
    if (file.size > MAX) return setErr("הקובץ גדול מ־5MB");
    setBusy(true);
    setErr("");
    const supabase = createClient();
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("site-images").upload(path, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (error) return setErr("ההעלאה נכשלה. נסו שוב.");
    const { data } = supabase.storage.from("site-images").getPublicUrl(path);
    onChange([...images, { src: data.publicUrl, he: "", en: "" }]);
  }

  return (
    <div className="stack">
      {images.length === 0 && <p className="muted" style={{ margin: 0 }}>אין עדיין תמונות.</p>}
      <div className="imgs">
        {images.map((g, i) => (
          <div key={g.src} className="im">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc(g.src)} alt={g.he} />
            <div>
              <input className="in" placeholder="טקסט חלופי (עברית)" value={g.he} onChange={(e) => set(i, { he: e.target.value })} />
              <input className="in" dir="ltr" placeholder="Alt text (English)" value={g.en} onChange={(e) => set(i, { en: e.target.value })} />
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn b-s b-sm" disabled={i === 0} onClick={() => onChange([g, ...images.filter((_, n) => n !== i)])}>
                  {i === 0 ? "תמונה ראשית" : "הגדרה כראשית"}
                </button>
                <button type="button" className="btn b-danger b-sm" onClick={() => onChange(images.filter((_, n) => n !== i))}>
                  הסרה
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label className="btn b-s" style={{ cursor: busy ? "wait" : "pointer" }}>
          {busy ? "מעלה…" : "העלאת תמונה"}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy} style={{ display: "none" }} />
        </label>
        {spare.map((l) => (
          <button key={l.src} type="button" className="btn b-g" onClick={() => onChange([...images, l])}>
            + {l.he || l.src}
          </button>
        ))}
      </div>
      {err && (
        <div role="alert" className="flash err" style={{ margin: 0 }}>
          {err}
        </div>
      )}
    </div>
  );
}
