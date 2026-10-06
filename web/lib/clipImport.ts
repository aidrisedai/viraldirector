import { z } from "zod";
import { BriefSchema, PlanSchema, type Brief, type Plan, type Shot } from "./plan";

// Bringing clips the creator already has: the Director either builds a plan around them ("plan") or files them
// under the shots of an existing plan ("match"). Clips that don't fit become extra content for the edit.
// The built-in versions here run when the Director isn't connected (or fails).

export const CLIPS_MAX = 20;
export const CLIP_FRAMES = 2;
const FRAME_B64_MAX = 200_000;

export const ClipInfoSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(120),
  seconds: z.number().min(0).max(600),
  /** Whether the clip has speech in it. */
  speech: z.boolean(),
  /** What's said, when it could be transcribed. */
  transcript: z.string().max(3000).nullable(),
  /** JPEG frames (base64), center-cropped to 9:16. */
  frames: z.array(z.string().max(FRAME_B64_MAX).regex(/^[A-Za-z0-9+/=]+$/)).max(CLIP_FRAMES),
});
export type ClipInfo = z.infer<typeof ClipInfoSchema>;

export const ClipsRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("plan"), brief: BriefSchema, clips: z.array(ClipInfoSchema).min(1).max(CLIPS_MAX) }),
  z.object({
    mode: z.literal("match"),
    brief: BriefSchema,
    plan: PlanSchema,
    /** Shots that already have a kept take (left alone). */
    filled: z.array(z.number().int().min(0)).max(12),
    clips: z.array(ClipInfoSchema).min(1).max(CLIPS_MAX),
  }),
]);
export type ClipsRequest = z.infer<typeof ClipsRequestSchema>;

/** Which clip goes under which shot; clip ids not in `assign` become extra content. */
export type Assignment = Record<string, number>;
export type ClipsResponse =
  | { plan?: Plan; assign: Assignment; note: string; sample: boolean }
  | { error: string };

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const words = (s: string) => new Set(s.split(/\s+/).map(norm).filter((w) => w.length > 2));

/** How well a transcript matches a scripted line, 0–1 (share of the line's words that were said). */
export function lineMatch(transcript: string, line: string): number {
  const said = words(transcript), want = words(line);
  if (!want.size || !said.size) return 0;
  let hit = 0;
  for (const w of want) if (said.has(w)) hit++;
  return hit / want.size;
}

const SPEAKING = new Set<Shot["type"]>(["hook", "a-roll"]);

/**
 * Built-in matching: speaking clips go to speaking shots — by how well what's said matches the line, else in
 * order — and silent clips go to B-roll, inserts, screen recordings and reactions in order. Filled shots are skipped.
 */
export function matchLocally(plan: Plan, clips: ClipInfo[], filled: number[]): Assignment {
  const assign: Assignment = {};
  const open = new Set(plan.shots.map((_, i) => i).filter((i) => !filled.includes(i)));
  const speaking = clips.filter((c) => c.speech);
  // Best line matches first.
  const pairs = speaking
    .flatMap((c) => plan.shots.map((s, i) => ({ c, i, score: c.transcript && SPEAKING.has(s.type) ? lineMatch(c.transcript, s.line) : 0 })))
    .filter((p) => p.score >= 0.3)
    .sort((a, b) => b.score - a.score);
  for (const { c, i } of pairs) {
    if (assign[c.id] !== undefined || !open.has(i)) continue;
    assign[c.id] = i;
    open.delete(i);
  }
  const fill = (list: ClipInfo[], fits: (s: Shot) => boolean) => {
    for (const c of list) {
      if (assign[c.id] !== undefined) continue;
      const i = [...open].sort((a, b) => a - b).find((k) => fits(plan.shots[k]));
      if (i === undefined) continue;
      assign[c.id] = i;
      open.delete(i);
    }
  };
  fill(speaking, (s) => SPEAKING.has(s.type));
  fill(clips.filter((c) => !c.speech), (s) => !SPEAKING.has(s.type));
  return assign;
}

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const titleFrom = (c: ClipInfo, n: number) => {
  if (c.transcript?.trim()) {
    const w = c.transcript.trim().split(/\s+/);
    return w.slice(0, 5).join(" ").replace(/[.,!?;:]$/, "") + (w.length > 5 ? "…" : "");
  }
  const name = c.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return name && !/^(img|vid|mov|pxl|video)\s?\d+$/i.test(name) ? name.slice(0, 60) : `Clip ${n}`;
};

/**
 * Built-in plan from clips: one shot per clip in the order given (speaking clips as talking shots, the first one
 * as the hook), hooks from the first things said, and beats that follow the clips. Short sets get an optional
 * hook and call-to-action shot to record.
 */
export function planLocally(brief: Pick<Brief, "concept">, clips: ClipInfo[]): { plan: Plan; assign: Assignment } {
  const list = clips.slice(0, 12);
  let hookUsed = false;
  const shots: Shot[] = list.map((c, i) => {
    const speaking = c.speech;
    const type: Shot["type"] = speaking ? (hookUsed ? "a-roll" : ((hookUsed = true), "hook")) : "b-roll";
    return {
      location: "Your footage",
      title: titleFrom(c, i + 1),
      type,
      size: "as filmed",
      framing: "Already filmed — used as it is.",
      lighting: "As filmed.",
      delivery: speaking ? "Already filmed." : "No line — it plays under your voice.",
      // Only words actually heard; a speaking clip that couldn't be transcribed gets its captions later.
      line: (c.transcript ?? "").trim().slice(0, 400),
      seconds: clamp(Math.round(c.seconds), 1, 30),
      required: true,
    };
  });
  const assign: Assignment = Object.fromEntries(list.map((c, i) => [c.id, i]));
  const said = list.flatMap((c) => (c.transcript ? sentences(c.transcript) : []));
  const concept = brief.concept.trim();
  // Nothing said yet to open with: a hook to record.
  if (!hookUsed) {
    shots.unshift({
      location: "Anywhere", title: "Say your hook", type: "hook", size: "chest-up", framing: "Chest-up, eyes on the lens.",
      lighting: "Face a window.", delivery: "Energy 4/5 — straight into it.", line: (said[0] ?? concept).slice(0, 200), seconds: 3, required: true,
    });
    for (const id of Object.keys(assign)) assign[id] += 1;
  }
  // Very short sets: optional shots to round the video off.
  const pads: Shot[] = [
    { location: "Anywhere", title: "Your call to action", type: "a-roll", size: "chest-up", framing: "Chest-up, eyes on the lens.",
      lighting: "Face a window.", delivery: "Energy 3/5 — warm and direct.", line: "Follow for more.", seconds: 3, required: false },
    { location: "Anywhere", title: "A close-up detail", type: "insert", size: "close-up", framing: "Fill the frame with one object from the story.",
      lighting: "Soft side light.", delivery: "No line.", line: "", seconds: 2, required: false },
  ];
  for (const pad of pads) if (shots.length < 3) shots.push(pad);

  const hookLines = [...said, concept, "Here’s what happened."].filter(Boolean).slice(0, 3);
  const hooks = hookLines.map((line, i) => ({
    kind: i < said.length ? "From your clips" : "Your idea",
    line: `“${line.slice(0, 196).replace(/^[“"]|[”"]$/g, "")}”`,
    why: i < said.length ? "Something you actually said on camera — it opens on your own words." : "Your idea, stated plainly.",
  }));
  while (hooks.length < 3) hooks.push({ kind: "Your idea", line: `“${concept || "Watch this."}”`, why: "Your idea, stated plainly." });

  const total = shots.reduce((t, s) => t + s.seconds, 0);
  const hookSecs = Math.min(3, shots[0].seconds);
  const rest = Math.max(3, total - hookSecs);
  const firstLine = (s: Shot[]) => s.find((x) => x.line)?.line ?? concept;
  const beats = [
    { label: "Hook", line: firstLine(shots.slice(0, 1)) || concept || "Opening", seconds: hookSecs },
    { label: "Story", line: firstLine(shots.slice(1, -1)) || concept || "The story", seconds: Math.max(1, Math.round(rest * 0.7)) },
    { label: "Payoff", line: firstLine(shots.slice(-1)) || concept || "The ending", seconds: Math.max(1, Math.round(rest * 0.3)) },
  ];
  const plan = PlanSchema.parse({ hooks, beats, shots });
  return { plan, assign };
}
