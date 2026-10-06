import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, readJson } from "@/lib/apiJson";
import { requireUser } from "@/lib/auth";
import { clientIp } from "@/lib/clientIp";
import { DirectorError, directorConfigured } from "@/lib/director";
import { generateIdeas } from "@/lib/projectIdeas";
import { addIdeas, getProjectDetail } from "@/lib/projects";
import { IdeaInputSchema } from "@/lib/projectTypes";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 90;
type Ctx = { params: Promise<{ id: string }> };

const limiter = createRateLimiter({ limit: Number(process.env.IDEAS_RATE_LIMIT ?? 12), windowMs: 10 * 60 * 1000 });

const BodySchema = z.union([
  z.object({ mode: z.literal("add"), idea: IdeaInputSchema }),
  z.object({ mode: z.literal("generate"), count: z.number().int().min(1).max(15).default(8), steer: z.string().trim().max(400).default("") }),
]);

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = BodySchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Invalid request." }, 400);
  const detail = await getProjectDetail(auth.userId, (await params).id);
  if (!detail) return json({ error: "Project not found." }, 404);
  const body = parsed.data;

  if (body.mode === "add") return json({ ideas: await addIdeas(auth.userId, detail.project.id, [body.idea]) }, 201);

  if (!directorConfigured()) return json({ error: "The Director isn’t connected yet, so it can’t suggest ideas. Add your own below." }, 503);
  const { ok, retryAfter } = limiter(`${auth.userId}:${clientIp(req)}`);
  if (!ok) return json({ error: "Lots of ideas in a short time. Try again in a few minutes." }, 429, { "Retry-After": String(retryAfter) });
  try {
    const ideas = await generateIdeas(detail.project, detail.videos, detail.ideas, body.count, body.steer);
    return json({ ideas: await addIdeas(auth.userId, detail.project.id, ideas) }, 201);
  } catch (error) {
    if (error instanceof DirectorError) return json({ error: error.message }, error.status);
    console.error("Idea generation failed", error);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
}
