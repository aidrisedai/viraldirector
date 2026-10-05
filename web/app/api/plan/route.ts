import { NextResponse, type NextRequest } from "next/server";
import { DirectorError, directorConfigured, generatePlan } from "@/lib/director";
import { BriefSchema, SAMPLE_PLAN, type PlanResponse } from "@/lib/plan";
import { clientIp } from "@/lib/clientIp";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;

const limiter = createRateLimiter({
  limit: Number(process.env.PLAN_RATE_LIMIT ?? 10),
  windowMs: 10 * 60 * 1000,
});

const json = (body: PlanResponse, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

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
