"use client";

/** Calls one of our JSON APIs; throws an Error with the server's message when it fails. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("Couldn’t reach the server. Check your connection.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

/** A small JPEG still from a finished video (about a second in), for the project history. */
export async function thumbFromVideo(blob: Blob): Promise<string | null> {
  const url = URL.createObjectURL(blob);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => reject(new Error("unreadable"));
      setTimeout(() => reject(new Error("timeout")), 8000);
    });
    v.currentTime = Math.min(1.2, Number.isFinite(v.duration) ? v.duration / 3 : 1.2);
    await new Promise<void>((resolve) => {
      v.onseeked = () => resolve();
      setTimeout(resolve, 3000);
    });
    const c = document.createElement("canvas");
    const s = 360 / Math.max(v.videoWidth || 1, v.videoHeight || 1);
    c.width = Math.round((v.videoWidth || 9) * s);
    c.height = Math.round((v.videoHeight || 16) * s);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
