import type { NextRequest } from "next/server";
import { json, readJson } from "@/lib/apiJson";
import { requireUser } from "@/lib/auth";
import { createVideo, listVideos } from "@/lib/projects";
import { VideoInputSchema } from "@/lib/projectTypes";

export const runtime = "nodejs";

/** GET ?project=<id> for a project's videos; without it, single videos. */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return json({ videos: await listVideos(auth.userId, req.nextUrl.searchParams.get("project")) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = VideoInputSchema.safeParse(await readJson(req, 400_000));
  if (!parsed.success) return json({ error: "Invalid video." }, 400);
  const video = await createVideo(auth.userId, parsed.data);
  return video ? json({ video }, 201) : json({ error: "Project not found." }, 404);
}
