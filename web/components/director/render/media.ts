"use client";

import type { Extra } from "@/lib/editPlan";

const THUMB = 512;

/** Reads an added image or video into an Extra (videos get their length). */
export async function extraFromFile(file: File): Promise<Extra> {
  const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
  if (!kind) throw new Error("Add a picture or a video.");
  const url = URL.createObjectURL(file);
  let seconds: number | null = null;
  if (kind === "video") {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        v.onloadedmetadata = () => resolve();
        v.onerror = () => reject(new Error("That video can’t be played in this browser."));
      });
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
    seconds = Number.isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : null;
  } else {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("That picture can’t be opened in this browser.");
    }
  }
  return { id: crypto.randomUUID().slice(0, 8), kind, name: file.name, url, blob: file, seconds, note: "" };
}

/** A small JPEG of an extra (a frame for videos) so the Director can see it. Base64, no prefix. */
export async function extraThumb(extra: Extra): Promise<string | null> {
  try {
    let source: CanvasImageSource, w: number, h: number;
    if (extra.kind === "image") {
      const img = new Image();
      img.src = extra.url;
      await img.decode();
      source = img;
      w = img.naturalWidth;
      h = img.naturalHeight;
    } else {
      const v = document.createElement("video");
      v.muted = true;
      v.preload = "auto";
      v.src = extra.url;
      await new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => resolve();
        v.onerror = () => reject(new Error("unreadable"));
      });
      v.currentTime = Math.min(1, (extra.seconds ?? 2) / 2);
      await new Promise<void>((resolve) => {
        v.onseeked = () => resolve();
        setTimeout(resolve, 3000);
      });
      source = v;
      w = v.videoWidth;
      h = v.videoHeight;
    }
    const s = Math.min(1, THUMB / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * s));
    canvas.height = Math.max(1, Math.round(h * s));
    canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
  } catch {
    return null;
  }
}
