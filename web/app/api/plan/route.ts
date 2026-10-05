import { NextResponse, type NextRequest } from "next/server";
import { DirectorError, directorConfigured, generatePlan } from "@/lib/director";
import { BriefSchema, SAMPLE_PLAN, type PlanResponse } from "@/lib/plan";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;

const limiter = createRateLimiter({
  limit: Number(process.env.PLAN_RATE_LIMIT ?? 10),
  windowMs: 10 * 60 * 1000,
});

const json = (body: PlanResponse, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/**
 * The edge proxy (Railway, or any single reverse proxy) sets X-Real-IP and appends the address it
 * saw to X-Forwarded-For. Earlier X-Forwarded-For entries come from the client and can be forged,
 * so never key the rate limit on them.
 */
function clientIp(req: NextRequest) {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded?.at(-1) ?? "unknown";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const brief = BriefSchema.safeParse(body);
  if (!brief.success) {
    return json({ error: brief.error.issues[0]?.message ?? "Invalid brief." }, 400);
  }

  if (!directorConfigured()) {
    return json({ plan: SAMPLE_PLAN, sample: true });
  }

  const { ok, retryAfter } = limiter(ip);
  if (!ok) {
    return json({ error: "You’ve planned a lot of videos in a short time. Try again in a few minutes." }, 429, {
      "Retry-After": String(retryAfter),
    });
  }

  try {
    const plan = await generatePlan(brief.data);
    return json({ plan, sample: false });
  } catch (error) {
    if (error instanceof DirectorError) return json({ error: error.message }, error.status);
    console.error("Unexpected error generating plan", error);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
}
