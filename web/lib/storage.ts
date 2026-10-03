import { BriefSchema, PlanSchema, type Brief, type Plan } from "./plan";

// The plan survives a refresh; recorded takes are in-memory blobs and don't.
const KEY = "viraldirector:project:v1";

export type SavedProject = { brief: Brief; plan: Plan | null; sample: boolean; hook: number; shot: number };

export function loadProject(): SavedProject | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const brief = BriefSchema.safeParse(data.brief);
    if (!brief.success) return null;
    const plan = data.plan ? PlanSchema.safeParse(data.plan) : null;
    if (plan && !plan.success) return null;
    const p = plan?.data ?? null;
    const clamp = (n: unknown, max: number) => (Number.isInteger(n) && (n as number) >= 0 && (n as number) < max ? (n as number) : 0);
    return {
      brief: brief.data,
      plan: p,
      sample: Boolean(data.sample),
      hook: p ? clamp(data.hook, p.hooks.length) : 0,
      shot: p ? clamp(data.shot, p.shots.length) : 0,
    };
  } catch {
    return null;
  }
}

export function saveProject(project: SavedProject) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    // Storage full or blocked (private mode) — the session still works, it just won't persist.
  }
}

export function clearProject() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
