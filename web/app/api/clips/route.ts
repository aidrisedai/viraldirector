import { NextResponse, type NextRequest } from "next/server";
import { cleanAssign, directClips } from "@/lib/clipDirector";
import { ClipsRequestSchema, matchLocally, planLocally, type ClipsResponse } from "@/lib/clipImport";
import { clientIp } from "@/lib/clientIp";
import { DirectorError, directorConfigured } from "@/lib/director";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;

const limiter = createRateLimiter({ limit: Number(process.env.PLAN_RATE_LIMIT ?? 10), windowMs: 10 * 60 * 1000 });
// Frames for 20 clips, two each, plus transcripts.
const MAX_BYTES = 9 * 1024 * 1024;

const json = (body: ClipsResponse, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** POST: plan a video around the creator's clips, or file them under an existing plan's shots. */
export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return json({ error: "Too many clips at once — try fewer." }, 413);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const parsed = ClipsRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Those clips couldn’t be read. Try again." }, 400);
  const r = parsed.data;

  // Built in: by what's said and in order.
  const local = (note: string): ClipsResponse => {
    if (r.mode === "plan") return { ...planLocally(r.brief, r.clips), note, sample: true };
    const assign = matchLocally(r.plan, r.clips, r.filled);
    return { assign: cleanAssign(Object.entries(assign).map(([clip, shot]) => ({ clip, shot })), new Set(r.clips.map((c) => c.id)), r.plan.shots.length, r.filled), note, sample: true };
  };
  if (!directorConfigured()) {
    return json(local(r.mode === "plan" ? "Built-in plan: one shot per clip, in the order you picked them." : "Filed by what you say in each clip, then in order."));
  }
  const { ok, retryAfter } = limiter(clientIp(req));
  if (!ok) return json({ error: "Lots of requests in a short time. Try again in a few minutes." }, 429, { "Retry-After": String(retryAfter) });
  try {
    return json({ ...(await directClips(r)), sample: false });
  } catch (error) {
    if (!(error instanceof DirectorError)) console.error("Unexpected clip import error", error);
    // The clips still go somewhere sensible.
    return json(local(`${error instanceof DirectorError ? error.message : "The Director couldn’t look at your clips."} Used the built-in ${r.mode === "plan" ? "plan" : "matching"} instead.`));
  }
}
