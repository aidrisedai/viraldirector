import type { Segment } from "./edit";
import { clipBounds, composeEdit, MIN_CLIP, type Callout, type Cutaway, type EditPlan } from "./editPlan";

// The editor's view of an edit: clips laid end to end in video time, and the pieces on top of them.
// The plan stores overlays relative to a segment ("segment 2, 1.5 s in"); the editor works in video
// time ("at 0:07"). These helpers convert between the two and make the hand edits.

export type LaidClip = { segment: number; shot: number; start: number; end: number; speech: boolean };
export type Layout = { clips: LaidClip[]; seconds: number };

/** Where each kept segment sits in the video, after drops and B-roll used as cutaways leave. */
export function layout(timeline: Segment[], plan: EditPlan): Layout {
  const clips: LaidClip[] = [];
  let t = 0;
  for (const seg of composeEdit(timeline, plan).sequence) {
    const segment = timeline.findIndex((s) => s.shot === seg.shot);
    const len = seg.to - seg.from;
    clips.push({ segment, shot: seg.shot, start: t, end: t + len, speech: seg.speech });
    t += len;
  }
  return { clips, seconds: t };
}

/** Video time of a point inside a segment, or null when that segment isn't in the video. */
export function toVideoTime(lay: Layout, segment: number, at: number): number | null {
  const c = lay.clips.find((x) => x.segment === segment);
  return c ? c.start + at : null;
}

/**
 * The segment under video time `t`, and the offset into it. With `seconds`, the start is pulled back so
 * the item fits before the clip ends; `speechOnly` skips clips without speech (B-roll can't cover B-roll).
 */
export function fromVideoTime(lay: Layout, t: number, seconds = 0, speechOnly = false): { segment: number; at: number } | null {
  const pool = speechOnly ? lay.clips.filter((c) => c.speech) : lay.clips;
  if (!pool.length) return null;
  const clamped = Math.max(0, Math.min(t, lay.seconds - 0.01));
  const c = pool.find((x) => clamped >= x.start && clamped < x.end) ?? pool.reduce((best, x) => (Math.abs(x.start - clamped) < Math.abs(best.start - clamped) ? x : best));
  const len = c.end - c.start;
  const at = Math.max(0, Math.min(clamped - c.start, len - Math.min(len, Math.max(0.8, seconds))));
  return { segment: c.segment, at: Math.round(at * 1000) / 1000 };
}

/** How long an item starting at video time t can run before its clip ends. */
export function roomAt(lay: Layout, segment: number, at: number): number {
  const c = lay.clips.find((x) => x.segment === segment);
  return c ? Math.max(0, c.end - c.start - at) : 0;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function addCutaway(plan: EditPlan, lay: Layout, source: string, t: number, seconds: number, style: Cutaway["style"]): EditPlan {
  const pos = fromVideoTime(lay, t, seconds, source.startsWith("shot:"));
  if (!pos) return plan;
  const fit = Math.min(seconds, roomAt(lay, pos.segment, pos.at));
  return { ...plan, cutaways: [...plan.cutaways, { source, segment: pos.segment, at: pos.at, seconds: round(fit), style }] };
}

export function moveCutaway(plan: EditPlan, lay: Layout, index: number, t: number): EditPlan {
  const c = plan.cutaways[index];
  const pos = c && fromVideoTime(lay, t, c.seconds, c.source.startsWith("shot:"));
  if (!pos) return plan;
  const seconds = round(Math.min(c.seconds, roomAt(lay, pos.segment, pos.at)));
  return { ...plan, cutaways: plan.cutaways.map((x, i) => (i === index ? { ...x, ...pos, seconds } : x)) };
}

export function updateCutaway(plan: EditPlan, index: number, patch: Partial<Cutaway>): EditPlan {
  return { ...plan, cutaways: plan.cutaways.map((x, i) => (i === index ? { ...x, ...patch } : x)) };
}

export function removeCutaway(plan: EditPlan, index: number): EditPlan {
  return { ...plan, cutaways: plan.cutaways.filter((_, i) => i !== index) };
}

export function addCallout(plan: EditPlan, lay: Layout, text: string, t: number, style: Callout["style"], seconds = 2.2): EditPlan {
  const pos = fromVideoTime(lay, t, seconds);
  if (!pos) return plan;
  const fit = round(Math.min(seconds, roomAt(lay, pos.segment, pos.at)));
  return { ...plan, callouts: [...plan.callouts, { segment: pos.segment, at: pos.at, seconds: fit, text, style }] };
}

export function moveCallout(plan: EditPlan, lay: Layout, index: number, t: number): EditPlan {
  const c = plan.callouts[index];
  const pos = c && fromVideoTime(lay, t, c.seconds);
  if (!pos) return plan;
  const seconds = round(Math.min(c.seconds, roomAt(lay, pos.segment, pos.at)));
  return { ...plan, callouts: plan.callouts.map((x, i) => (i === index ? { ...x, ...pos, seconds } : x)) };
}

export function updateCallout(plan: EditPlan, index: number, patch: Partial<Callout>): EditPlan {
  return { ...plan, callouts: plan.callouts.map((x, i) => (i === index ? { ...x, ...patch } : x)) };
}

export function removeCallout(plan: EditPlan, index: number): EditPlan {
  return { ...plan, callouts: plan.callouts.filter((_, i) => i !== index) };
}

/** Takes a clip out of the video, or puts it back. Overlays on it go with it. */
export function toggleDrop(plan: EditPlan, segment: number): EditPlan {
  const drop = plan.drop.includes(segment) ? plan.drop.filter((d) => d !== segment) : [...plan.drop, segment];
  return { ...plan, drop };
}

/** The clip's current in and out points (the creator's trim, else the automatic one). */
export function clipWindow(plan: EditPlan, timeline: Segment[], segment: number): { from: number; to: number } {
  const t = plan.trims.find((x) => x.segment === segment);
  const seg = timeline[segment];
  return t ? { from: t.from, to: t.to } : { from: seg.from, to: seg.to };
}

/** Sets a clip's in and out points, kept inside the recorded take and at least MIN_CLIP long. */
export function setTrim(plan: EditPlan, timeline: Segment[], segment: number, from: number, to: number): EditPlan {
  const seg = timeline[segment];
  if (!seg) return plan;
  const { max } = clipBounds(seg);
  const f = Math.round(Math.min(Math.max(0, from), max - MIN_CLIP) * 100) / 100;
  const t = Math.round(Math.min(max, Math.max(to, f + MIN_CLIP)) * 100) / 100;
  return { ...plan, trims: [...plan.trims.filter((x) => x.segment !== segment), { segment, from: f, to: t }] };
}

/** Back to the automatic trim (dead air removed). */
export function resetTrim(plan: EditPlan, segment: number): EditPlan {
  return { ...plan, trims: plan.trims.filter((x) => x.segment !== segment) };
}
