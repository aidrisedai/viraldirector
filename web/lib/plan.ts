import { z } from "zod";

// ---------- Brief (Concept step input) ----------

export const GOALS = ["Grow", "Teach", "Sell"] as const;
export const LENGTHS = ["30s", "45s", "60s"] as const;
export const PLATFORMS = ["Reels / TikTok", "LinkedIn"] as const;
export const AUDIENCES = ["Teens 13–18", "Parents"] as const;
export const FORMATS = ["Director picks", "Talking head", "Myth-busting", "Story", "Tutorial"] as const;

/** How the finished video is edited. Chosen up front (it shapes the shot list) and switchable at the end. */
export const LOOKS = ["Standard", "Editorial", "Cinematic"] as const;
export type Look = (typeof LOOKS)[number];
export const LOOK_BLURB: Record<Look, string> = {
  Standard: "Bold animated captions, callouts and punchy motion.",
  Editorial: "Calm explainer: illustrated paper cards, a takeaway headline, soft cuts.",
  Cinematic: "A 25–30 s film: a dark, dramatic build with huge serif words, a montage, then a warm human payoff.",
};

export const CONCEPT_MAX = 280;
export const STORY_MAX = 3000;

export const BriefSchema = z.object({
  concept: z.string().trim().min(3, "Tell the Director a little more.").max(CONCEPT_MAX),
  goal: z.enum(GOALS),
  length: z.enum(LENGTHS),
  platform: z.enum(PLATFORMS),
  audience: z.enum(AUDIENCES),
  format: z.enum(FORMATS),
  /** A story the creator approved in story mode (see lib/story.ts); empty for a one-sentence idea. */
  story: z.string().trim().max(STORY_MAX).default(""),
  /** For a video in a project: the goal and what's been made, so the series builds instead of repeating. */
  series: z.string().trim().max(1500).default(""),
  /** The edit style the shots are planned for. */
  look: z.enum(LOOKS).default("Standard"),
});
export type Brief = z.infer<typeof BriefSchema>;

export const DEFAULT_BRIEF: Brief = {
  concept: "",
  goal: "Teach",
  length: "45s",
  platform: "Reels / TikTok",
  audience: "Teens 13–18",
  format: "Director picks",
  story: "",
  series: "",
  look: "Standard",
};

export const targetSeconds = (brief: Pick<Brief, "length">) => parseInt(brief.length, 10);

// ---------- Plan (Director output) ----------

export const SHOT_TYPES = ["hook", "a-roll", "b-roll", "insert", "reaction", "screen"] as const;
export type ShotType = (typeof SHOT_TYPES)[number];

export const SHOT_TYPE_LABEL: Record<ShotType, string> = {
  hook: "Hook shot",
  "a-roll": "A-roll",
  "b-roll": "B-roll",
  insert: "Insert",
  reaction: "Reaction",
  screen: "Screen recording",
};

/**
 * The Director's writing occasionally runs a little long ("Value beat 2: the proof"). Rather than throw away a good
 * plan, text is trimmed to fit (at a word boundary, with an ellipsis) and numbers are brought into range.
 */
export function fit(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
export const fitText = (max: number, min = 1) => z.string().transform((v) => fit(v, max)).pipe(z.string().min(min).max(max));
export const whole = (min: number, max: number) => z.number().transform((n) => Math.min(max, Math.max(min, Math.round(n))));

const HookSchema = z.object({
  kind: fitText(40),
  line: fitText(200),
  why: fitText(240),
});

const BeatSchema = z.object({
  label: fitText(24),
  line: fitText(400),
  seconds: whole(1, 60),
});

const ShotSchema = z.object({
  location: fitText(40),
  title: fitText(60),
  type: z.enum(SHOT_TYPES),
  size: fitText(30),
  framing: fitText(200),
  lighting: fitText(200),
  delivery: fitText(200),
  line: fitText(400, 0),
  seconds: whole(1, 30),
  required: z.boolean(),
});

export const PlanSchema = z.object({
  hooks: z.array(HookSchema).min(3).transform((h) => h.slice(0, 3)),
  beats: z.array(BeatSchema).min(3).transform((b) => b.slice(0, 8)),
  shots: z.array(ShotSchema).min(3).transform((x) => x.slice(0, 12)),
});

export type Hook = z.infer<typeof HookSchema>;
export type Beat = z.infer<typeof BeatSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type Plan = z.infer<typeof PlanSchema>;

/** Response body of POST /api/plan. `sample` is true when the Director isn't connected. */
export type PlanResponse = { plan: Plan; sample: boolean } | { error: string };

// ---------- Derived helpers ----------

export const plannedSeconds = (plan: Plan) => plan.beats.reduce((t, b) => t + b.seconds, 0);

/** Beat time ranges like "0–3s", "3–10s". */
export function beatRanges(plan: Plan): string[] {
  let t = 0;
  return plan.beats.map((b) => `${t}–${(t += b.seconds)}s`);
}

/** Rough recording time: setup plus a couple of takes per shot, rounded to 5 minutes. */
export const recordingMinutes = (plan: Plan) => Math.max(5, Math.round((plan.shots.length * 2) / 5) * 5);

/** Swap the chosen hook into the hook beat and the hook shot so the teleprompter reads it. */
export function applyHook(plan: Plan, hookIndex: number): Plan {
  const line = plan.hooks[hookIndex].line.replace(/^[“"]|[”"]$/g, "");
  const hookShot = plan.shots.findIndex((s) => s.type === "hook");
  return {
    ...plan,
    beats: plan.beats.map((b, i) => (i === 0 ? { ...b, line } : b)),
    shots: plan.shots.map((s, i) => (i === hookShot ? { ...s, line } : s)),
  };
}

// ---------- Sample plan (PRD example), used when no API key is configured ----------

export const SAMPLE_CONCEPT = "Why most teens never start a business";

export const SAMPLE_PLAN: Plan = {
  hooks: [
    { kind: "Contrarian", line: "“Your first business idea is probably bad — that’s the point.”", why: "Challenges a belief your audience holds and opens a loop the payoff closes." },
    { kind: "Question", line: "“What’s actually stopping you from starting?”", why: "Invites self-reflection. Softer, slower to land." },
    { kind: "Bold claim", line: "“Most teens never start. Not for the reason you think.”", why: "Clear promise of a surprising answer." },
  ],
  beats: [
    { label: "Hook", line: "Your first business idea is probably bad — that’s the point.", seconds: 3 },
    { label: "Setup", line: "Most teens wait for the perfect idea. So they never start.", seconds: 7 },
    { label: "Value ×3", line: "Bad ideas teach you what real users actually want — and you only find that out by shipping.", seconds: 20 },
    { label: "Payoff", line: "My first sale came from idea number four. I only got there because I built one, two and three.", seconds: 10 },
    { label: "Loop", line: "So go build the bad one. Because your first idea is probably bad —", seconds: 5 },
  ],
  shots: [
    { location: "At your desk", title: "Walk into frame", type: "hook", size: "chest-up", framing: "Start mid-motion, stop at chest-up.", lighting: "Window light in front of you, not behind.", delivery: "Energy 5/5 — deliberate pause after “bad”.", line: "Your first business idea is probably bad — that’s the point.", seconds: 3, required: true },
    { location: "At your desk", title: "Setup line", type: "a-roll", size: "chest-up", framing: "Chest-up, eyes on the lens.", lighting: "Window light in front of you, not behind.", delivery: "Energy 3/5 — conversational.", line: "Most teens wait for the perfect idea. So they never start.", seconds: 7, required: true },
    { location: "At your desk", title: "Value beat 1", type: "a-roll", size: "chest-up", framing: "Chest-up, eyes on the lens, camera at eye height.", lighting: "Window light in front of you, not behind.", delivery: "Energy 4/5 — like you’re letting them in on something.", line: "Bad ideas teach you what real users actually want — and you only find that out by shipping.", seconds: 8, required: true },
    { location: "At your desk", title: "Hands sketching the app", type: "b-roll", size: "close-up", framing: "Overhead close-up of your notebook.", lighting: "Desk lamp or window light from the side.", delivery: "No line — slow, steady pen strokes.", line: "", seconds: 3, required: true },
    { location: "At your desk", title: "Raise an eyebrow", type: "reaction", size: "new angle", framing: "Side angle, about 45°.", lighting: "Same light as your A-roll.", delivery: "Silent beat — a pattern interrupt.", line: "", seconds: 1, required: false },
    { location: "At your desk", title: "Payoff line", type: "a-roll", size: "chest-up", framing: "Chest-up, slightly closer than shot 3.", lighting: "Window light in front of you, not behind.", delivery: "Energy 4/5 — slow down on “number four”.", line: "My first sale came from idea number four. I only got there because I built one, two and three.", seconds: 10, required: true },
    { location: "Anywhere", title: "Phone showing a first sale", type: "insert", size: "hold to lens", framing: "Hold the phone to the lens, then pull back.", lighting: "Turn screen brightness up; avoid glare.", delivery: "No line.", line: "", seconds: 3, required: true },
  ],
};
