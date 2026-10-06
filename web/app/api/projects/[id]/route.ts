import type { NextRequest } from "next/server";
import { json, readJson } from "@/lib/apiJson";
import { requireUser } from "@/lib/auth";
import { deleteProject, getProjectDetail, updateProject } from "@/lib/projects";
import { ProjectPatchSchema } from "@/lib/projectTypes";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const detail = await getProjectDetail(auth.userId, (await params).id);
  return detail ? json(detail) : json({ error: "Project not found." }, 404);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = ProjectPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid change." }, 400);
  const project = await updateProject(auth.userId, (await params).id, parsed.data);
  return project ? json({ project }) : json({ error: "Project not found." }, 404);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return (await deleteProject(auth.userId, (await params).id)) ? json({ ok: true }) : json({ error: "Project not found." }, 404);
}
