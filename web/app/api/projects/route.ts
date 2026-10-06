import type { NextRequest } from "next/server";
import { json, readJson } from "@/lib/apiJson";
import { requireUser } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/projects";
import { ProjectInputSchema } from "@/lib/projectTypes";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return json({ projects: await listProjects(auth.userId) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = ProjectInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid project." }, 400);
  return json({ project: await createProject(auth.userId, parsed.data) }, 201);
}
