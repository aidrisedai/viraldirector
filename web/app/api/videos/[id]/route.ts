import type { NextRequest } from "next/server";
import { json, readJson } from "@/lib/apiJson";
import { requireUser } from "@/lib/auth";
import { deleteVideo, getVideo, updateVideo } from "@/lib/projects";
import { VideoPatchSchema } from "@/lib/projectTypes";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const video = await getVideo(auth.userId, (await params).id);
  return video ? json({ video }) : json({ error: "Video not found." }, 404);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = VideoPatchSchema.safeParse(await readJson(req, 600_000));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid change." }, 400);
  const video = await updateVideo(auth.userId, (await params).id, parsed.data);
  return video ? json({ video }) : json({ error: "Video not found." }, 404);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return (await deleteVideo(auth.userId, (await params).id)) ? json({ ok: true }) : json({ error: "Video not found." }, 404);
}
