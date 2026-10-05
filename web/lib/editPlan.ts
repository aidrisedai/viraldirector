import { z } from "zod";
import type { Segment, TimedWord } from "./edit";

// ---------- Extra content the creator adds ----------

export type Extra = {
  id: string;
  kind: "image" | "video";
  name: string;
  url: string;
  blob: Blob;
  /** Video length in seconds; null for images. */
  seconds: number | null;
  /** What it is or how to use it, in the creator's words. */
  note: string;
};

export const EXTRAS_MAX = 6;
export const NOTES_MAX = 1000;

// ---------- The Director's edit decision list ----------

const CutawaySchema = z.object({
  /** "extra:<id>" for added content, or "shot:<n>" to lay a planned B-roll shot over the voice. */
  source: z.string().max(60),
  /** Timeline segment (0-based) it plays over. */
  segment: z.number().int().min(0),
  /** Seconds into that segment (as trimmed). */
  at: z.number().min(0),
  seconds: z.number().positive(),
  /** full: replaces the picture; pip: a card over the speaker. */
  style: z.enum(["full", "pip"]),
});

const CalloutSchema = z.object({
  segment: z.number().int().min(0),
  at: z.number().min(0),
  seconds: z.number().positive(),
  text: z.string().min(1).max(48),
  /** stat: a big number or fact; label: a short tag or heading. */
  style: z.enum(["stat", "label"]),
});

export const EditPlanSchema = z.object({
  cutaways: z.array(CutawaySchema).max(16),
  callouts: z.array(CalloutSchema).max(10),
  /** Words to emphasise in the captions, per segment. */
  emphasis: z.array(z.object({ segment: z.number().int().min(0), word: z.string().min(1).max(40) })).max(20),
  /** Call to action on the end card. */
  endCta: z.string().max(60),
  /** One or two sentences on what the Director did, shown to the creator. */
  summary: z.string().max(500),
});
export type EditPlan = z.infer<typeof EditPlanSchema>;
export type Cutaway = z.infer<typeof CutawaySchema>;
export type Callout = z.infer<typeof CalloutSchema>;

export const DEFAULT_CTA = "Follow for more";

const ms = (n: number) => Math.round(n * 1000) / 1000;
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const segLength = (s: Segment) => s.to - s.from;
// Shortest overlay worth showing (with a little slack for floating-point arithmetic).
const MIN_LEN = 0.8 - 1e-6;
const NON_SPEECH_COVER = new Set(["b-roll", "insert", "screen"]);

/** Clamps a plan (the Director's or the built-in one) to what the footage can actually support. */
export function normalizePlan(plan: EditPlan, timeline: Segment[], extras: Pick<Extra, "id" | "kind" | "seconds">[]): EditPlan {
  const extraById = new Map(extras.map((e) => [e.id, e]));
  const usedShots = new Set<number>();
  const busy = new Map<number, [number, number][]>(); // segment → covered windows

  const fits = (segment: number, a: number, b: number) =>
    !(busy.get(segment) ?? []).some(([x, y]) => a < y && b > x);
  const take = (segment: number, a: number, b: number) => busy.set(segment, [...(busy.get(segment) ?? []), [a, b]]);

  const cutaways: Cutaway[] = [];
  for (const c of [...plan.cutaways].sort((x, y) => x.segment - y.segment || x.at - y.at)) {
    const seg = timeline[c.segment];
    if (!seg) continue;
    let maxLen = 6;
    if (c.source.startsWith("extra:")) {
      const extra = extraById.get(c.source.slice(6));
      if (!extra) continue;
      if (extra.kind === "video" && extra.seconds) maxLen = Math.min(maxLen, extra.seconds);
    } else if (c.source.startsWith("shot:")) {
      const shot = Number(c.source.slice(5));
      const src = timeline.find((s) => s.shot === shot);
      if (!src || src === seg || src.speech || usedShots.has(shot) || !seg.speech) continue;
      maxLen = Math.min(maxLen, segLength(src));
    } else continue;
    const len = segLength(seg);
    const at = Math.min(Math.max(0, c.at), Math.max(0, len - 0.8));
    const seconds = Math.min(c.seconds, maxLen, len - at);
    if (seconds < MIN_LEN || !fits(c.segment, at, at + seconds)) continue;
    take(c.segment, at, at + seconds);
    if (c.source.startsWith("shot:")) usedShots.add(Number(c.source.slice(5)));
    cutaways.push({ ...c, at: ms(at), seconds: ms(seconds) });
  }

  const perSegment = new Map<number, [number, number][]>();
  const callouts: Callout[] = [];
  for (const c of [...plan.callouts].sort((x, y) => x.segment - y.segment || x.at - y.at)) {
    const seg = timeline[c.segment];
    const text = c.text.trim();
    if (!seg || !text) continue;
    const len = segLength(seg);
    const at = Math.min(Math.max(0, c.at), Math.max(0, len - 1));
    const seconds = Math.min(Math.max(1, c.seconds), 4, len - at);
    const windows = perSegment.get(c.segment) ?? [];
    if (seconds < MIN_LEN || windows.length >= 2 || windows.some(([x, y]) => at < y && at + seconds > x)) continue;
    perSegment.set(c.segment, [...windows, [at, at + seconds]]);
    callouts.push({ ...c, text, at: ms(at), seconds: ms(seconds) });
  }

  const emphasis = plan.emphasis.filter((e) => timeline[e.segment]?.words.some((w) => norm(w.word) === norm(e.word)));

  return { cutaways, callouts, emphasis, endCta: plan.endCta.trim() || DEFAULT_CTA, summary: plan.summary.trim() };
}

/**
 * The built-in edit when the Director isn't connected (or the creator skips it): lay B-roll over
 * the voice just before it, and show added pictures and clips during the longest talking parts.
 */
export function fallbackPlan(timeline: Segment[], extras: Pick<Extra, "id" | "kind" | "seconds">[]): EditPlan {
  const cutaways: Cutaway[] = [];
  const covered = new Set<number>();

  timeline.forEach((seg, i) => {
    const prev = timeline[i - 1];
    if (seg.speech || !NON_SPEECH_COVER.has(seg.kind) || !prev?.speech) return;
    const len = segLength(prev);
    const seconds = Math.min(segLength(seg), len * 0.6);
    if (seconds < 0.8) return;
    cutaways.push({ source: `shot:${seg.shot}`, segment: i - 1, at: Math.max(0, len - seconds - 0.2), seconds, style: "full" });
    covered.add(i - 1);
  });

  const talking = timeline
    .map((s, i) => ({ i, len: segLength(s), speech: s.speech }))
    .filter((s) => s.speech && s.len >= 2.5)
    .sort((a, b) => b.len - a.len);
  let slot = 0;
  for (const e of extras) {
    const target = talking.filter((t) => !covered.has(t.i))[0] ?? talking[slot++ % Math.max(1, talking.length)];
    if (!target) break;
    covered.add(target.i);
    const seconds = e.kind === "video" ? Math.min(e.seconds ?? 3, 3, target.len - 1) : Math.min(2.5, target.len - 1);
    cutaways.push({ source: `extra:${e.id}`, segment: target.i, at: 0.8, seconds, style: e.kind === "image" ? "pip" : "full" });
  }

  const parts = [
    cutaways.some((c) => c.source.startsWith("shot:")) && "laid your B-roll over your voice",
    extras.length > 0 && `placed ${extras.length} added ${extras.length === 1 ? "item" : "items"} over the talking parts`,
  ].filter(Boolean);
  return {
    cutaways,
    callouts: [],
    emphasis: [],
    endCta: DEFAULT_CTA,
    summary: parts.length ? `Built-in edit: ${parts.join(" and ")}.` : "Built-in edit: your takes in order.",
  };
}

// ---------- What the renderer draws ----------

export type Overlay = Cutaway & { kind: "extra"; extraId: string } | Cutaway & { kind: "segment"; from: Segment };

export type ComposedSegment = Segment & {
  overlays: Overlay[];
  callouts: Callout[];
  /** Indexes into `words` to emphasise. */
  emphasis: Set<number>;
};

export type ComposedEdit = { sequence: ComposedSegment[]; endCta: string };

/** Applies a (normalised) plan: B-roll used as cutaways leaves the sequence; overlays attach to segments. */
export function composeEdit(timeline: Segment[], plan: EditPlan): ComposedEdit {
  const usedShots = new Set(plan.cutaways.filter((c) => c.source.startsWith("shot:")).map((c) => Number(c.source.slice(5))));
  const sequence: ComposedSegment[] = [];
  timeline.forEach((seg, i) => {
    if (usedShots.has(seg.shot) && !seg.speech) return;
    const overlays: Overlay[] = plan.cutaways
      .filter((c) => c.segment === i)
      .flatMap((c): Overlay[] => {
        if (c.source.startsWith("extra:")) return [{ ...c, kind: "extra", extraId: c.source.slice(6) }];
        const from = timeline.find((s) => s.shot === Number(c.source.slice(5)));
        return from ? [{ ...c, kind: "segment", from }] : [];
      });
    const wanted = new Set(plan.emphasis.filter((e) => e.segment === i).map((e) => norm(e.word)));
    const emphasis = new Set(seg.words.flatMap((w: TimedWord, k) => (wanted.has(norm(w.word)) ? [k] : [])));
    sequence.push({ ...seg, overlays, callouts: plan.callouts.filter((c) => c.segment === i), emphasis });
  });
  return { sequence, endCta: plan.endCta || DEFAULT_CTA };
}

// ---------- Request to the Director ----------

const THUMB_B64_MAX = 300_000;

export const EditRequestSchema = z.object({
  timeline: z
    .array(
      z.object({
        segment: z.number().int().min(0),
        shot: z.number().int().min(0),
        title: z.string().max(80),
        kind: z.string().max(20),
        seconds: z.number().min(0).max(120),
        speech: z.boolean(),
        /** Caption words with times relative to the start of the segment. */
        words: z.array(z.object({ word: z.string().max(40), start: z.number(), end: z.number() })).max(300),
      }),
    )
    .min(1)
    .max(12),
  extras: z
    .array(
      z.object({
        id: z.string().max(40),
        kind: z.enum(["image", "video"]),
        seconds: z.number().nullable(),
        note: z.string().max(300),
        thumb: z.string().max(THUMB_B64_MAX).regex(/^[A-Za-z0-9+/=]+$/).nullable(),
      }),
    )
    .max(EXTRAS_MAX),
  notes: z.string().max(NOTES_MAX),
  brand: z.boolean(),
  concept: z.string().max(280),
  platform: z.string().max(40),
  audience: z.string().max(40),
  hook: z.string().max(200),
});
export type EditRequest = z.infer<typeof EditRequestSchema>;
export type EditResponse = { plan: EditPlan } | { error: string };

/** The timeline as the Director sees it: segment-relative word times, rounded. */
export function timelineForDirector(timeline: Segment[], titles: string[]): EditRequest["timeline"] {
  const r = (n: number) => Math.round(n * 100) / 100;
  return timeline.map((s, i) => ({
    segment: i,
    shot: s.shot,
    title: titles[s.shot] ?? `Shot ${s.shot + 1}`,
    kind: s.kind,
    seconds: r(s.to - s.from),
    speech: s.speech,
    words: s.words.map((w) => ({ word: w.word, start: r(Math.max(0, w.start - s.from)), end: r(Math.max(0, w.end - s.from)) })),
  }));
}
