import { useEffect, useState } from "react";

const cache = new Map<string, string>();

/** A still from a video (phones don't paint a <video> frame until it plays), cached by URL. */
export function useThumb(url: string, kind: "image" | "video"): string | null {
  const [thumb, setThumb] = useState<string | null>(kind === "image" ? url : (cache.get(url) ?? null));
  useEffect(() => {
    if (kind === "image" || cache.has(url)) return;
    let live = true;
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    const grab = (final: boolean) => {
      if (!v.videoWidth) return;
      try {
        const c = document.createElement("canvas");
        const s = 240 / Math.max(v.videoWidth || 1, v.videoHeight || 1);
        c.width = Math.max(1, Math.round((v.videoWidth || 1) * s));
        c.height = Math.max(1, Math.round((v.videoHeight || 1) * s));
        c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
        const data = c.toDataURL("image/jpeg", 0.7);
        cache.set(url, data);
        if (live) setThumb(data);
      } catch {}
      if (final) {
        v.removeAttribute("src");
        v.load();
      }
    };
    // First frame straight away; a slightly later, more representative frame once seeking finishes.
    v.addEventListener("loadeddata", () => {
      grab(false);
      const d = Number.isFinite(v.duration) ? v.duration : 1;
      v.currentTime = Math.min(0.5, d / 2);
    }, { once: true });
    v.addEventListener("seeked", () => grab(true), { once: true });
    return () => {
      live = false;
    };
  }, [url, kind]);
  return thumb;
}
