"use client";

import { FRAMES_MAX } from "@/lib/chat";
import type { Take } from "@/lib/takes";

const WIDTH = 360; // 9:16 at 360×640 is plenty for judging framing, light and expression
const HEIGHT = 640;

function seek(v: HTMLVideoElement, t: number) {
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      v.removeEventListener("seeked", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      v.removeEventListener("seeked", done);
      reject(new Error("seek timed out"));
    }, 4000);
    v.addEventListener("seeked", done);
    v.currentTime = t;
  });
}

/**
 * Grabs evenly spaced JPEG frames from a take, center-cropped to 9:16 the way the vertical
 * video will be seen. Returns base64 strings without the data: prefix.
 */
export async function takeFrames(take: Take, count = FRAMES_MAX): Promise<string[]> {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = take.url;
  await new Promise<void>((resolve, reject) => {
    v.onloadeddata = () => resolve();
    v.onerror = () => reject(new Error("Couldn’t read the take."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  // Recorded WebM may report an infinite duration; the measured length is reliable.
  const length = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : take.seconds;
  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.min(length * ((i + 0.5) / count), Math.max(0, length - 0.05));
    try {
      await seek(v, t);
    } catch {
      continue;
    }
    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) continue;
    // Center crop to 9:16.
    const cropW = Math.min(vw, (vh * 9) / 16);
    const cropH = Math.min(vh, (vw * 16) / 9);
    ctx.drawImage(v, (vw - cropW) / 2, (vh - cropH) / 2, cropW, cropH, 0, 0, WIDTH, HEIGHT);
    frames.push(canvas.toDataURL("image/jpeg", 0.72).split(",")[1]);
  }
  v.removeAttribute("src");
  v.load();
  return frames;
}
