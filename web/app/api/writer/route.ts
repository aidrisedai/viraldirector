import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/clientIp";
import { DirectorError, directorConfigured } from "@/lib/director";
import { createRateLimiter } from "@/lib/rateLimit";
import { WriterRequestSchema, type WriterResponse } from "@/lib/story";
import { askWriter } from "@/lib/writer";

export const runtime = "nodejs";
export const maxDuration = 120;

const REQUEST_BYTES_MAX = 40_000;

const limiter = createRateLimiter({
  limit: Number(process.env.WRITER_RATE_LIMIT ?? 20),
  windowMs: 10 * 60 * 1000,
});

const json = (body: WriterResponse, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > REQUEST_BYTES_MAX) return json({ error: "That story is too long. Shorten it and try again." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const parsed = WriterRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);

  if (!directorConfigured()) {
    return json({ error: "The writers aren’t connected yet. Use a quick idea instead, or add the API key." }, 503);
  }

  const { ok, retryAfter } = limiter(clientIp(req));
  if (!ok) {
    return json({ error: "You’ve asked the writer a lot in a short time. Try again in a few minutes." }, 429, {
      "Retry-After": String(retryAfter),
    });
  }

  try {
    return json(await askWriter(parsed.data));
  } catch (error) {
    if (error instanceof DirectorError) return json({ error: error.message }, error.status);
    console.error("Unexpected error from the writer", error);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
}
