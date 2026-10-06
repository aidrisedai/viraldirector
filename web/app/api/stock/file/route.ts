import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/clientIp";
import { createRateLimiter } from "@/lib/rateLimit";
import { isPexels, stockConfigured } from "@/lib/stock";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 200 * 1024 * 1024;
const limiter = createRateLimiter({ limit: Number(process.env.STOCK_RATE_LIMIT ?? 40), windowMs: 10 * 60 * 1000 });
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

/** GET ?u=<Pexels video file URL> — streams the clip from Pexels, so the browser can use it in the video. */
export async function GET(req: NextRequest) {
  if (!stockConfigured()) return error("Stock footage isn’t set up on this server.", 503);
  const u = req.nextUrl.searchParams.get("u") ?? "";
  if (!isPexels(u)) return error("Only Pexels clips can be fetched.", 400);
  const { ok, retryAfter } = limiter(clientIp(req));
  if (!ok) return NextResponse.json({ error: "Lots of downloads in a short time. Try again in a few minutes." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

  let res: Response;
  try {
    // Redirects are followed only within Pexels' own hosts.
    res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(90_000) });
    for (let hops = 0; res.status >= 300 && res.status < 400 && hops < 3; hops++) {
      const next = new URL(res.headers.get("location") ?? "", u).toString();
      if (!isPexels(next)) return error("That clip isn’t available.", 502);
      res = await fetch(next, { redirect: "manual", signal: AbortSignal.timeout(90_000) });
    }
  } catch {
    return error("Couldn’t download that clip. Try again.", 502);
  }
  const type = res.headers.get("content-type") ?? "";
  const length = Number(res.headers.get("content-length") ?? 0);
  if (!res.ok || !res.body || !type.startsWith("video/")) return error("That clip isn’t available.", 502);
  if (length > MAX_BYTES) return error("That clip is too large.", 413);
  return new NextResponse(res.body, {
    headers: { "Content-Type": type, ...(length ? { "Content-Length": String(length) } : {}), "Cache-Control": "private, max-age=3600" },
  });
}
