import type { NextRequest } from "next/server";
import { json, readJson } from "@/lib/apiJson";
import { requireUser } from "@/lib/auth";
import { deleteIdea, updateIdea } from "@/lib/projects";
import { IdeaPatchSchema } from "@/lib/projectTypes";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = IdeaPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid change." }, 400);
  const idea = await updateIdea(auth.userId, (await params).id, parsed.data);
  return idea ? json({ idea }) : json({ error: "Idea not found." }, 404);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return (await deleteIdea(auth.userId, (await params).id)) ? json({ ok: true }) : json({ error: "Idea not found." }, 404);
}
