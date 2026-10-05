import { NextResponse, type NextRequest } from "next/server";
import { ChatRequestSchema, REQUEST_BYTES_MAX, type ChatResponse } from "@/lib/chat";
import { clientIp } from "@/lib/clientIp";
import { DirectorError, directorConfigured } from "@/lib/director";
import { askDirector } from "@/lib/directorChat";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;

const limiter = createRateLimiter({
  limit: Number(process.env.CHAT_RATE_LIMIT ?? 40),
  windowMs: 10 * 60 * 1000,
});

const json = (body: ChatResponse, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > REQUEST_BYTES_MAX) return json({ error: "That request is too large." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request." }, 400);

  if (!directorConfigured()) {
    return json({ error: "The Director isn’t connected yet, so it can’t answer questions. Word definitions still work." }, 503);
  }

  const { ok, retryAfter } = limiter(clientIp(req));
  if (!ok) {
    return json({ error: "You’ve asked the Director a lot in a short time. Try again in a few minutes." }, 429, {
      "Retry-After": String(retryAfter),
    });
  }

  try {
    return json(await askDirector(parsed.data));
  } catch (error) {
    if (error instanceof DirectorError) return json({ error: error.message }, error.status);
    console.error("Unexpected error answering", error);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
}
