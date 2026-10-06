import type { Project, Video } from "./projectTypes";

// Progress for a project, in the creator's own calendar days. Pure, so the page can compute it in
// the browser's time zone and tests can pin "today".

const DAY = 86_400_000;

/** YYYY-MM-DD for a moment, in local time. */
export function localDay(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole days from a to b (YYYY-MM-DD), b later is positive. */
export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / DAY);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

export type ProjectStats = {
  /** Videos the project aims for in total; null when open-ended. */
  target: number | null;
  made: number;
  posted: number;
  /** Day of the project, starting at 1 (0 before it starts). */
  dayNumber: number;
  daysLeft: number | null;
  /** How many videos the schedule expects by the end of today. */
  expectedByNow: number;
  /** Ahead (+) or behind (−) the schedule. */
  ahead: number;
  /** Daily projects: days in a row with a video, ending today (or yesterday, if today isn't done yet). */
  streak: number;
  madeToday: number;
  /** Videos per local day, for the calendar. */
  byDay: Record<string, number>;
  finished: boolean;
};

export function projectStats(project: Pick<Project, "perWeek" | "durationDays" | "startDate">, videos: Pick<Video, "status" | "madeAt">[], now = new Date()): ProjectStats {
  const today = localDay(now);
  const done = videos.filter((v) => v.status !== "draft" && v.madeAt);
  const byDay: Record<string, number> = {};
  for (const v of done) {
    const d = localDay(new Date(v.madeAt!));
    byDay[d] = (byDay[d] ?? 0) + 1;
  }
  const elapsed = daysBetween(project.startDate, today); // 0 on the first day
  const dayNumber = elapsed < 0 ? 0 : elapsed + 1;
  const target = project.durationDays ? Math.max(1, Math.round((project.durationDays / 7) * project.perWeek)) : null;
  const daysIn = project.durationDays ? Math.min(dayNumber, project.durationDays) : dayNumber;
  let expectedByNow = Math.floor((daysIn / 7) * project.perWeek + 1e-9);
  if (target !== null) expectedByNow = Math.min(target, expectedByNow);
  const made = done.length;

  // A day still in progress doesn't break the streak.
  let streak = 0;
  let day = byDay[today] ? today : addDays(today, -1);
  while (byDay[day] && daysBetween(project.startDate, day) >= 0) {
    streak++;
    day = addDays(day, -1);
  }

  return {
    target,
    made,
    posted: done.filter((v) => v.status === "posted").length,
    dayNumber,
    daysLeft: project.durationDays ? Math.max(0, project.durationDays - dayNumber) : null,
    expectedByNow,
    ahead: made - expectedByNow,
    streak,
    madeToday: byDay[today] ?? 0,
    byDay,
    finished: target !== null && made >= target,
  };
}

/** A friendly one-line status for the project card and header. */
export function statusLine(s: ProjectStats, perWeek: number): string {
  if (s.dayNumber === 0) return "Starts soon";
  if (s.finished) return "Goal reached";
  if (perWeek >= 7 && s.madeToday === 0) return s.ahead > 0 ? "Ahead — today’s video is a bonus" : "Today’s video is waiting";
  if (s.ahead >= 0) return s.ahead === 0 ? "On track" : `${s.ahead} ahead`;
  return `${-s.ahead} behind — catch up when you can`;
}

/** Progress for a project card, from the list's counts (no per-day detail, so no streak). */
export function summaryProgress(
  p: Pick<Project, "perWeek" | "durationDays" | "startDate"> & { made: number; posted: number; lastMadeAt: string | null },
  now = new Date(),
): ProjectStats {
  const base = projectStats(p, [], now);
  const madeToday = p.lastMadeAt && localDay(new Date(p.lastMadeAt)) === localDay(now) ? 1 : 0;
  return { ...base, made: p.made, posted: p.posted, ahead: p.made - base.expectedByNow, madeToday, finished: base.target !== null && p.made >= base.target };
}
