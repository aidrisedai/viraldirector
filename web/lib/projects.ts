import "server-only";
import { newId, query } from "./db";
import type { Idea, Project, ProjectDetail, ProjectInput, ProjectSummary, Video, VideoPatch } from "./projectTypes";

// Every function takes the signed-in user's id and only ever touches that user's rows.

type ProjectRow = {
  id: string; name: string; goal: string; per_week: number; duration_days: number | null; start_date: string | Date;
  defaults: Project["defaults"]; archived: boolean; created_at: Date;
};
type IdeaRow = { id: string; project_id: string; title: string; concept: string; angle: string; status: Idea["status"]; position: number; created_at: Date };
type VideoRow = {
  id: string; project_id: string | null; idea_id: string | null; title: string; concept: string; hook: string; caption: string;
  seconds: number | null; format: string | null; thumb: string | null; status: Video["status"]; brief?: unknown; plan?: unknown;
  made_at: Date | null; posted_at: Date | null; posted_url: string | null; created_at: Date;
};

const day = (d: string | Date) => (typeof d === "string" ? d.slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);

const toProject = (r: ProjectRow): Project => ({
  id: r.id, name: r.name, goal: r.goal, perWeek: r.per_week, durationDays: r.duration_days, startDate: day(r.start_date),
  defaults: r.defaults, archived: r.archived, createdAt: r.created_at.toISOString(),
});
const toIdea = (r: IdeaRow): Idea => ({
  id: r.id, projectId: r.project_id, title: r.title, concept: r.concept, angle: r.angle, status: r.status, position: r.position,
  createdAt: r.created_at.toISOString(),
});
const toVideo = (r: VideoRow, full = false): Video => ({
  id: r.id, projectId: r.project_id, ideaId: r.idea_id, title: r.title, concept: r.concept, hook: r.hook, caption: r.caption,
  seconds: r.seconds, format: r.format, thumb: r.thumb, status: r.status, madeAt: r.made_at?.toISOString() ?? null,
  postedAt: r.posted_at?.toISOString() ?? null, postedUrl: r.posted_url, createdAt: r.created_at.toISOString(),
  ...(full ? { brief: r.brief ?? null, plan: r.plan ?? null } : {}),
});

const VIDEO_LIST_COLS = "id, project_id, idea_id, title, concept, hook, caption, seconds, format, thumb, status, made_at, posted_at, posted_url, created_at";

// ---------- projects ----------

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const rows = await query<ProjectRow & { made: string; posted: string; last_made_at: Date | null; open_ideas: string; latest_thumb: string | null }>(
    `select p.*,
       (select count(*) from videos v where v.project_id = p.id and v.status <> 'draft') as made,
       (select count(*) from videos v where v.project_id = p.id and v.status = 'posted') as posted,
       (select max(made_at) from videos v where v.project_id = p.id) as last_made_at,
       (select count(*) from ideas i where i.project_id = p.id and i.status = 'open') as open_ideas,
       (select thumb from videos v where v.project_id = p.id and v.thumb is not null order by made_at desc nulls last limit 1) as latest_thumb
     from projects p where p.user_id = $1 and not p.archived order by p.created_at desc`,
    [userId],
  );
  return rows.map((r) => ({
    ...toProject(r), made: Number(r.made), posted: Number(r.posted), lastMadeAt: r.last_made_at?.toISOString() ?? null,
    openIdeas: Number(r.open_ideas), latestThumb: r.latest_thumb,
  }));
}

export async function createProject(userId: string, input: ProjectInput): Promise<Project> {
  const [row] = await query<ProjectRow>(
    `insert into projects (id, user_id, name, goal, per_week, duration_days, start_date, defaults)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [newId(), userId, input.name, input.goal, input.perWeek, input.durationDays, input.startDate, JSON.stringify(input.defaults)],
  );
  return toProject(row);
}

export async function getProject(userId: string, id: string): Promise<Project | null> {
  const [row] = await query<ProjectRow>("select * from projects where id = $1 and user_id = $2", [id, userId]);
  return row ? toProject(row) : null;
}

export async function getProjectDetail(userId: string, id: string): Promise<ProjectDetail | null> {
  const project = await getProject(userId, id);
  if (!project) return null;
  const [ideas, videos] = await Promise.all([
    query<IdeaRow>("select * from ideas where project_id = $1 and user_id = $2 order by status = 'open' desc, position, created_at", [id, userId]),
    query<VideoRow>(`select ${VIDEO_LIST_COLS} from videos where project_id = $1 and user_id = $2 order by coalesce(made_at, created_at) desc`, [id, userId]),
  ]);
  return { project, ideas: ideas.map(toIdea), videos: videos.map((v) => toVideo(v)) };
}

export async function updateProject(userId: string, id: string, patch: Partial<ProjectInput> & { archived?: boolean }): Promise<Project | null> {
  const cols: Record<string, unknown> = {
    name: patch.name, goal: patch.goal, per_week: patch.perWeek, duration_days: patch.durationDays, start_date: patch.startDate,
    defaults: patch.defaults && JSON.stringify(patch.defaults), archived: patch.archived,
  };
  const sets = Object.entries(cols).filter(([, v]) => v !== undefined);
  if (!sets.length) return getProject(userId, id);
  const [row] = await query<ProjectRow>(
    `update projects set ${sets.map(([k], i) => `${k} = $${i + 3}`).join(", ")}, updated_at = now() where id = $1 and user_id = $2 returning *`,
    [id, userId, ...sets.map(([, v]) => v)],
  );
  return row ? toProject(row) : null;
}

export async function deleteProject(userId: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>("delete from projects where id = $1 and user_id = $2 returning id", [id, userId]);
  return rows.length > 0;
}

// ---------- ideas ----------

export async function addIdeas(userId: string, projectId: string, ideas: { title: string; concept: string; angle: string }[]): Promise<Idea[]> {
  if (!ideas.length) return [];
  const [{ max }] = await query<{ max: number | null }>("select max(position) as max from ideas where project_id = $1 and user_id = $2", [projectId, userId]);
  const start = (max ?? 0) + 1;
  const values: unknown[] = [];
  const rows = ideas.map((x, i) => {
    values.push(newId(), projectId, userId, x.title, x.concept, x.angle, start + i);
    const o = i * 7;
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7})`;
  });
  const inserted = await query<IdeaRow>(`insert into ideas (id, project_id, user_id, title, concept, angle, position) values ${rows.join(", ")} returning *`, values);
  return inserted.map(toIdea);
}

export async function updateIdea(userId: string, id: string, patch: Partial<Pick<Idea, "title" | "concept" | "angle" | "status" | "position">>): Promise<Idea | null> {
  const sets = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (!sets.length) {
    const [row] = await query<IdeaRow>("select * from ideas where id = $1 and user_id = $2", [id, userId]);
    return row ? toIdea(row) : null;
  }
  const [row] = await query<IdeaRow>(
    `update ideas set ${sets.map(([k], i) => `${k} = $${i + 3}`).join(", ")} where id = $1 and user_id = $2 returning *`,
    [id, userId, ...sets.map(([, v]) => v)],
  );
  return row ? toIdea(row) : null;
}

export async function deleteIdea(userId: string, id: string): Promise<boolean> {
  return (await query<{ id: string }>("delete from ideas where id = $1 and user_id = $2 returning id", [id, userId])).length > 0;
}

// ---------- videos ----------

export async function createVideo(
  userId: string,
  input: { projectId: string | null; ideaId: string | null; title: string; concept: string; brief: unknown; plan: unknown },
): Promise<Video | null> {
  if (input.projectId && !(await getProject(userId, input.projectId))) return null;
  const [row] = await query<VideoRow>(
    `insert into videos (id, user_id, project_id, idea_id, title, concept, brief, plan) values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [newId(), userId, input.projectId, input.ideaId, input.title, input.concept, JSON.stringify(input.brief ?? null), JSON.stringify(input.plan ?? null)],
  );
  return toVideo(row, true);
}

export async function getVideo(userId: string, id: string): Promise<Video | null> {
  const [row] = await query<VideoRow>("select * from videos where id = $1 and user_id = $2", [id, userId]);
  return row ? toVideo(row, true) : null;
}

export async function listVideos(userId: string, projectId: string | null): Promise<Video[]> {
  const rows = await query<VideoRow>(
    `select ${VIDEO_LIST_COLS} from videos where user_id = $1 and ${projectId ? "project_id = $2" : "project_id is null"} order by created_at desc limit 100`,
    projectId ? [userId, projectId] : [userId],
  );
  return rows.map((r) => toVideo(r));
}

export async function updateVideo(userId: string, id: string, patch: VideoPatch): Promise<Video | null> {
  const cols: Record<string, unknown> = {
    title: patch.title, hook: patch.hook, caption: patch.caption, seconds: patch.seconds, format: patch.format, thumb: patch.thumb,
    status: patch.status, posted_url: patch.postedUrl,
    brief: patch.brief === undefined ? undefined : JSON.stringify(patch.brief),
    plan: patch.plan === undefined ? undefined : JSON.stringify(patch.plan),
  };
  const sets = Object.entries(cols).filter(([, v]) => v !== undefined);
  // Status changes stamp their moment once.
  const stamps = [
    patch.status && patch.status !== "draft" ? "made_at = coalesce(made_at, now())" : null,
    patch.status === "posted" ? "posted_at = coalesce(posted_at, now())" : null,
    patch.status === "made" ? "posted_at = null" : null,
  ].filter(Boolean);
  const [row] = await query<VideoRow>(
    `update videos set ${[...sets.map(([k], i) => `${k} = $${i + 3}`), ...stamps, "updated_at = now()"].join(", ")}
     where id = $1 and user_id = $2 returning *`,
    [id, userId, ...sets.map(([, v]) => v)],
  );
  if (!row) return null;
  // Making a video from an idea uses the idea up.
  if (patch.status && patch.status !== "draft" && row.idea_id) {
    await query("update ideas set status = 'used' where id = $1 and user_id = $2", [row.idea_id, userId]);
  }
  return toVideo(row, true);
}

export async function deleteVideo(userId: string, id: string): Promise<boolean> {
  return (await query<{ id: string }>("delete from videos where id = $1 and user_id = $2 returning id", [id, userId])).length > 0;
}
