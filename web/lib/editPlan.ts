import { z } from "zod";
import type { Segment, TimedWord } from "./edit";
import { isArt } from "./art";
import { fitText } from "./plan";

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
export const FEEDBACK_MAX = 1000;

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

/**
 * stat: a big number or fact; label: a short tag or heading. The Editorial look adds card: an illustrated
 * paper card that replaces the picture while the voice continues; takeaway: one huge headline over dimmed,
 * blurred footage; sticker: a small paper-cutout illustration beside the speaker.
 */
export const CALLOUT_STYLES = ["stat", "label", "card", "takeaway", "sticker"] as const;
export type CalloutStyle = (typeof CALLOUT_STYLES)[number];
/** Callouts that take over the whole picture (captions step aside while they're up). */
export const FULL_FRAME: ReadonlySet<CalloutStyle> = new Set(["card", "takeaway"]);

const CalloutSchema = z.object({
  segment: z.number().int().min(0),
  at: z.number().min(0),
  seconds: z.number().positive(),
  /** The text; for a card, its headline. */
  text: fitText(48),
  style: z.enum(CALLOUT_STYLES),
  /** card: the words of the headline set on a highlight strip. */
  highlight: fitText(48, 0).optional(),
  /** card: a short supporting phrase under the illustration. */
  support: fitText(60, 0).optional(),
  /** card and sticker: which illustration (see lib/art.ts). */
  art: z.string().max(30).optional(),
});

export const EditPlanSchema = z.object({
  /** Timeline segments (0-based) to leave out of the video. */
  drop: z.array(z.number().int().min(0)).max(12).default([]),
  /** The creator's own in and out points for a clip, in seconds of the source take (replacing the automatic trim). */
  trims: z.array(z.object({ segment: z.number().int().min(0), from: z.number().min(0), to: z.number().positive() })).max(12).default([]),
  /** Corrected caption text for a speaking segment (it replaces the transcript for that clip). */
  captionFixes: z.array(z.object({ segment: z.number().int().min(0), text: fitText(400, 0) })).transform((x) => x.slice(0, 12)).default([]),
  cutaways: z.array(CutawaySchema).transform((x) => x.slice(0, 16)),
  callouts: z.array(CalloutSchema).transform((x) => x.slice(0, 10)),
  /** Words to emphasise in the captions, per segment. */
  emphasis: z.array(z.object({ segment: z.number().int().min(0), word: fitText(40) })).transform((x) => x.slice(0, 20)),
  /** Call to action on the end card. */
  endCta: fitText(60, 0),
  /** One or two sentences on what the Director did, shown to the creator. */
  summary: fitText(500, 0),
});
export type EditPlan = z.infer<typeof EditPlanSchema>;
export type Cutaway = z.infer<typeof CutawaySchema>;
export type Callout = z.infer<typeof CalloutSchema>;

export const DEFAULT_CTA = "Follow for more";

// ---------- Look of the video (captions, motion, title, music level) ----------

export const CAPTION_STYLES = ["Pop", "Karaoke", "Bold", "Minimal", "Editorial", "Off"] as const;
export const CAPTION_SIZES = ["S", "M", "L"] as const;
export const CAPTION_POSITIONS = ["Middle", "Lower"] as const;
export const TRANSITIONS = ["Flash", "Whip", "Zoom", "Soft", "Cut"] as const;
export const ENERGIES = ["Calm", "Punchy"] as const;
/** The two ways the Director finishes a video; the creator gets one of each and keeps either. */
export const LOOKS = ["Standard", "Editorial"] as const;
export type Look = (typeof LOOKS)[number];

export const StyleSchema = z.object({
  /**
   * Pop: word-by-word on a sliding pill. Karaoke: the line fills as it's spoken. Bold: one or two huge words slam in.
   * Minimal: clean sentence-case lines. Editorial: short phrases revealed word by word on a discreet backing.
   */
  captions: z.enum(CAPTION_STYLES),
  captionSize: z.enum(CAPTION_SIZES),
  captionPosition: z.enum(CAPTION_POSITIONS),
  /** How one clip turns into the next. Soft: a quick crossfade, with an occasional warm light leak. */
  transition: z.enum(TRANSITIONS),
  /** Camera movement: Punchy adds punch-ins and jump-cut zooms; Calm keeps slow drifts. */
  energy: z.enum(ENERGIES),
  /** Animated title over the opening; empty uses the chosen hook. */
  title: z.string().max(90),
  showTitle: z.boolean(),
  /** Music level, 0–1. Even at 1 the music stays well under the voice. */
  musicVolume: z.number().min(0).max(1),
  /** Which version this is (it changes the camera moves and how cards look). */
  look: z.enum(LOOKS).default("Standard"),
  /** Even out each clip's exposure, contrast and white balance. */
  grade: z.boolean().default(false),
});
export type Style = z.infer<typeof StyleSchema>;

export const DEFAULT_STYLE: Style = {
  captions: "Pop",
  captionSize: "M",
  captionPosition: "Middle",
  transition: "Flash",
  energy: "Punchy",
  title: "",
  showTitle: true,
  musicVolume: 0.7,
  look: "Standard",
  grade: false,
};

/** The Editorial version's starting look: calm, clean and readable, with the voice leading. */
export const EDITORIAL_STYLE: Style = {
  captions: "Editorial",
  captionSize: "M",
  captionPosition: "Middle",
  transition: "Soft",
  energy: "Calm",
  title: "",
  showTitle: false,
  musicVolume: 0.45,
  look: "Editorial",
  grade: true,
};

export const lookStyle = (look: Look): Style => (look === "Editorial" ? EDITORIAL_STYLE : DEFAULT_STYLE);

const ms = (n: number) => Math.round(n * 1000) / 1000;
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const segLength = (s: Segment) => s.to - s.from;
// Shortest overlay worth showing (with a little slack for floating-point arithmetic).
const MIN_LEN = 0.8 - 1e-6;
const NON_SPEECH_COVER = new Set(["b-roll", "insert", "screen"]);

export type Trim = EditPlan["trims"][number];
/** Shortest a clip can be trimmed to, in seconds. */
export const MIN_CLIP = 0.5;

/** How far a clip's in and out points can go: the whole recorded take. */
export const clipBounds = (seg: Segment) => ({ min: 0, max: Math.max(seg.take.seconds || 0, seg.to) });

/** Keeps trims that point at real clips and stay inside them. */
function cleanTrims(trims: Trim[], timeline: Segment[]): Trim[] {
  const out: Trim[] = [];
  for (const t of trims) {
    const seg = timeline[t.segment];
    if (!seg || out.some((x) => x.segment === t.segment)) continue;
    const { max } = clipBounds(seg);
    const from = Math.min(Math.max(0, t.from), Math.max(0, max - MIN_CLIP));
    const to = Math.min(max, Math.max(t.to, from + MIN_CLIP));
    out.push({ segment: t.segment, from: ms(from), to: ms(to) });
  }
  return out;
}

/** The timeline with the creator's trims applied: new in/out points, captions limited to what's still in. */
export function applyTrims(timeline: Segment[], trims: Trim[]): Segment[] {
  if (!trims.length) return timeline;
  return timeline.map((seg, i) => {
    const t = trims.find((x) => x.segment === i);
    if (!t) return seg;
    const words = seg.words.filter((w) => (w.start + w.end) / 2 >= t.from && (w.start + w.end) / 2 <= t.to);
    return { ...seg, from: t.from, to: t.to, words, speech: seg.speech && words.length > 0 };
  });
}

/**
 * Clamps a plan (the Director's, the built-in one, or the creator's own) to what the footage can actually
 * support. `strict` (for generated plans) also keeps cutaways and callouts from overlapping; the creator's
 * hand edits may overlap — the later one draws on top.
 */
export function normalizePlan(
  plan: EditPlan,
  raw: Segment[],
  extras: Pick<Extra, "id" | "kind" | "seconds">[],
  { strict = true }: { strict?: boolean } = {},
): EditPlan {
  const trims = cleanTrims(plan.trims ?? [], raw);
  const timeline = applyTrims(raw, trims);
  const extraById = new Map(extras.map((e) => [e.id, e]));
  const usedShots = new Set<number>();
  const busy = new Map<number, [number, number][]>(); // segment → covered windows

  const fits = (segment: number, a: number, b: number) =>
    !strict || !(busy.get(segment) ?? []).some(([x, y]) => a < y && b > x);
  const take = (segment: number, a: number, b: number) => busy.set(segment, [...(busy.get(segment) ?? []), [a, b]]);

  const cutaways: Cutaway[] = [];
  for (const c of [...plan.cutaways].sort((x, y) => x.segment - y.segment || x.at - y.at)) {
    const seg = timeline[c.segment];
    if (!seg) continue;
    let maxLen = strict ? 6 : 20;
    if (c.source.startsWith("extra:")) {
      const extra = extraById.get(c.source.slice(6));
      if (!extra) continue;
      if (extra.kind === "video" && extra.seconds) maxLen = Math.min(maxLen, extra.seconds);
    } else if (c.source.startsWith("shot:")) {
      const shot = Number(c.source.slice(5));
      const src = timeline.find((s) => s.shot === shot);
      if (!src || src === seg || src.speech || (strict && usedShots.has(shot)) || !seg.speech) continue;
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
    // A card needs time to be read (headline, picture, then the supporting line).
    const [least, most] = c.style === "card" ? [1.5, 3.5] : c.style === "takeaway" ? [1.2, 3] : [1, 4];
    const at = Math.min(Math.max(0, c.at), Math.max(0, len - least));
    const seconds = Math.min(Math.max(least, c.seconds), strict ? most : 12, len - at);
    const windows = perSegment.get(c.segment) ?? [];
    if (seconds < MIN_LEN || (strict && (windows.length >= 2 || windows.some(([x, y]) => at < y && at + seconds > x)))) continue;
    perSegment.set(c.segment, [...windows, [at, at + seconds]]);
    const out: Callout = { segment: c.segment, at: ms(at), seconds: ms(seconds), text, style: c.style };
    // Only words that are actually in the headline can be highlighted.
    const highlight = c.highlight?.trim();
    if (highlight && text.toLowerCase().includes(highlight.toLowerCase())) out.highlight = highlight;
    if (c.support?.trim()) out.support = c.support.trim();
    if (c.style === "card" || c.style === "sticker") out.art = c.art && isArt(c.art) ? c.art : "lightbulb";
    callouts.push(out);
  }

  const emphasis = plan.emphasis.filter((e) => timeline[e.segment]?.words.some((w) => norm(w.word) === norm(e.word)));

  // Never drop every speaking clip: the video needs a voice.
  let drop = [...new Set(plan.drop)].filter((i) => i < timeline.length).sort((a, b) => a - b);
  if (!timeline.some((seg, i) => seg.speech && !drop.includes(i))) drop = drop.filter((i) => !timeline[i].speech);
  if (drop.length >= timeline.length) drop = [];
  const captionFixes = plan.captionFixes
    .map((f) => ({ segment: f.segment, text: f.text.trim() }))
    .filter((f) => f.text && timeline[f.segment]?.speech);

  return { drop, trims, captionFixes, cutaways, callouts, emphasis, endCta: plan.endCta.trim() || DEFAULT_CTA, summary: plan.summary.trim() };
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
    drop: [],
    trims: [],
    captionFixes: [],
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
export function composeEdit(raw: Segment[], plan: EditPlan): ComposedEdit {
  const timeline = applyTrims(raw, plan.trims ?? []);
  const usedShots = new Set(plan.cutaways.filter((c) => c.source.startsWith("shot:")).map((c) => Number(c.source.slice(5))));
  const sequence: ComposedSegment[] = [];
  const dropped = new Set(plan.drop);
  timeline.forEach((seg, i) => {
    if (dropped.has(i) || (usedShots.has(seg.shot) && !seg.speech)) return;
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
        /** Where it starts in the current video (seconds), or null when it isn't in it. */
        startsAt: z.number().min(0).nullable(),
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
  /** Which version to make: the standard edit, or the Editorial look with illustrated cards. */
  look: z.enum(LOOKS).default("Standard"),
  style: StyleSchema,
  music: z.enum(["generated", "custom", "none"]),
  /** For a revision: the edit the creator just watched, and what they want changed. */
  current: EditPlanSchema.nullable(),
  feedback: z.string().trim().max(FEEDBACK_MAX),
  /** Earlier rounds of feedback in this session, oldest first. */
  history: z.array(z.object({ feedback: z.string().max(FEEDBACK_MAX), summary: z.string().max(500) })).max(6),
});
export type EditRequest = z.infer<typeof EditRequestSchema>;
export type EditResponse = { plan: EditPlan; style: Style } | { error: string };

/**
 * The timeline as the Director sees it: segment-relative word times, rounded, and where each
 * segment starts in the video the creator watched (with `current` applied).
 */
export function timelineForDirector(timeline: Segment[], titles: string[], current: EditPlan | null = null): EditRequest["timeline"] {
  const r = (n: number) => Math.round(n * 100) / 100;
  const startsAt = new Map<number, number>();
  if (current) {
    let t = 0;
    for (const s of composeEdit(timeline, current).sequence) {
      startsAt.set(s.shot, r(t));
      t += s.to - s.from;
    }
  }
  return timeline.map((s, i) => ({
    segment: i,
    shot: s.shot,
    title: titles[s.shot] ?? `Shot ${s.shot + 1}`,
    kind: s.kind,
    seconds: r(s.to - s.from),
    speech: s.speech,
    startsAt: current ? (startsAt.get(s.shot) ?? null) : null,
    words: s.words.map((w) => ({ word: w.word, start: r(Math.max(0, w.start - s.from)), end: r(Math.max(0, w.end - s.from)) })),
  }));
}
