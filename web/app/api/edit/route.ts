import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/clientIp";
import { DirectorError, directorConfigured } from "@/lib/director";
import { planEdit } from "@/lib/directorEdit";
import { EditRequestSchema, type EditResponse } from "@/lib/editPlan";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;

const REQUEST_BYTES_MAX = 3_000_000;

const limiter = createRateLimiter({
  limit: Number(process.env.EDIT_RATE_LIMIT ?? 10),
  windowMs: 10 * 60 * 1000,
});

const json = (body: EditResponse, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > REQUEST_BYTES_MAX) return json({ error: "That’s too much to send at once. Remove an item and try again." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const parsed = EditRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request." }, 400);

  if (!directorConfigured()) {
    return json({ error: "The Director isn’t connected yet, so the built-in edit is used." }, 503);
  }

  const { ok, retryAfter } = limiter(clientIp(req));
  if (!ok) {
    return json({ error: "You’ve asked for a lot of edits in a short time. Try again in a few minutes." }, 429, {
      "Retry-After": String(retryAfter),
    });
  }

  try {
    return json(await planEdit(parsed.data));
  } catch (error) {
    if (error instanceof DirectorError) return json({ error: error.message }, error.status);
    console.error("Unexpected error planning the edit", error);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
}
