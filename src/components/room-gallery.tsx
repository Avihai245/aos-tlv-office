"use client";

import Image from "next/image";
import { useState } from "react";
import { Lightbox, type GalleryItem } from "./gallery";

/** Photo mosaic for the room page: the first photo large, up to two more beside it; all open in the lightbox. */
export function RoomGallery({ items, labels, rtl, openLabel }: { items: GalleryItem[]; labels: { prev: string; next: string; close: string }; rtl: boolean; openLabel: string }) {
  const [open, setOpen] = useState(-1);
  const shown = items.slice(0, 3);
  return (
    <>
      <div role="list" className={shown.length > 1 ? "mosaic" : "mosaic one"}>
        {shown.map((g, i) => (
          <button key={g.src} role="listitem" type="button" className="tile" onClick={() => setOpen(i)} aria-label={`${openLabel}: ${g.alt}`}>
            <Image src={g.src} alt="" fill priority={i === 0} sizes={i === 0 ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 30vw, 50vw"} />
            <span className="cap">{g.alt}</span>
          </button>
        ))}
      </div>
      {open >= 0 && <Lightbox items={items} index={open} onChange={setOpen} labels={labels} rtl={rtl} />}
    </>
  );
}
