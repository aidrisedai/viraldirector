import "server-only";

// Stock footage from Pexels (free to use, no attribution required — we credit the videographer anyway).
// The key stays on the server; clips are fetched through our own route so the browser can draw them into
// the video (cross-origin video would taint the canvas).

export type StockClip = {
  id: number;
  /** Still image to show in the results. */
  thumb: string;
  seconds: number;
  width: number;
  height: number;
  /** The video file to download (an https://*.pexels.com URL). */
  file: string;
  author: string;
  /** The clip's page on Pexels. */
  page: string;
};

export const stockConfigured = () => Boolean(process.env.PEXELS_API_KEY);

export class StockError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type PexelsFile = { file_type: string; width: number | null; height: number | null; link: string };
type PexelsVideo = { id: number; width: number; height: number; url: string; image: string; duration: number; user: { name: string }; video_files: PexelsFile[] };

/** The best file for a 1080 × 1920 video: MP4, as close to 1080 wide as possible without going far over. */
export function pickFile(files: PexelsFile[]): PexelsFile | null {
  const mp4 = files.filter((f) => f.file_type === "video/mp4" && f.width && f.height && isPexels(f.link));
  if (!mp4.length) return null;
  const score = (f: PexelsFile) => {
    const short = Math.min(f.width!, f.height!);
    return short > 1100 ? short - 1080 + 400 : 1080 - short; // prefer ~1080; very large files are slow to fetch
  };
  return [...mp4].sort((a, b) => score(a) - score(b))[0];
}

export function toClips(videos: PexelsVideo[]): StockClip[] {
  return videos.flatMap((v) => {
    const f = pickFile(v.video_files ?? []);
    if (!f || !v.image) return [];
    return [{ id: v.id, thumb: v.image, seconds: v.duration, width: f.width!, height: f.height!, file: f.link, author: v.user?.name ?? "Pexels", page: v.url }];
  });
}

/** Only Pexels' own https hosts may be fetched through the file route. */
export function isPexels(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "pexels.com" || u.hostname.endsWith(".pexels.com"));
  } catch {
    return false;
  }
}

export async function searchStock(query: string): Promise<StockClip[]> {
  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "portrait");
  url.searchParams.set("per_page", "15");
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY! }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new StockError("Couldn’t reach the stock library. Try again.", 502);
  }
  if (res.status === 429) throw new StockError("The stock library is busy. Try again in a minute.", 503);
  if (!res.ok) {
    console.error("Pexels search failed", res.status);
    throw new StockError("The stock library didn’t answer. Try again.", 502);
  }
  const data = (await res.json()) as { videos?: PexelsVideo[] };
  return toClips(data.videos ?? []);
}
