import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/clientIp";
import { createRateLimiter } from "@/lib/rateLimit";
import { searchStock, StockError, stockConfigured, type StockClip } from "@/lib/stock";

export const runtime = "nodejs";

const limiter = createRateLimiter({ limit: Number(process.env.STOCK_RATE_LIMIT ?? 40), windowMs: 10 * 60 * 1000 });

type Body = { results: StockClip[] } | { error: string };
const json = (body: Body, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** GET ?q=… — portrait stock clips for a shot. */
export async function GET(req: NextRequest) {
  if (!stockConfigured()) return json({ error: "Stock footage isn’t set up on this server." }, 503);
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return json({ error: "Type what you’re looking for." }, 400);
  const { ok, retryAfter } = limiter(clientIp(req));
  if (!ok) return json({ error: "Lots of searches in a short time. Try again in a few minutes." }, 429, { "Retry-After": String(retryAfter) });
  try {
    return json({ results: await searchStock(q) });
  } catch (error) {
    if (error instanceof StockError) return json({ error: error.message }, error.status);
    console.error("Unexpected stock error", error);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
}
