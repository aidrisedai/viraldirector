import { z } from "zod";

// ---------- Brief (Concept step input) ----------

export const GOALS = ["Grow", "Teach", "Sell"] as const;
export const LENGTHS = ["30s", "45s", "60s"] as const;
export const PLATFORMS = ["Reels / TikTok", "LinkedIn"] as const;
export const AUDIENCES = ["Teens 13–18", "Parents"] as const;
export const FORMATS = ["Director picks", "Talking head", "Myth-busting", "Story", "Tutorial"] as const;

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

const HookSchema = z.object({
  kind: z.string().min(1).max(40),
  line: z.string().min(1).max(200),
  why: z.string().min(1).max(240),
});

const BeatSchema = z.object({
  label: z.string().min(1).max(24),
  line: z.string().min(1).max(400),
  seconds: z.number().int().min(1).max(60),
});

const ShotSchema = z.object({
  location: z.string().min(1).max(40),
  title: z.string().min(1).max(60),
  type: z.enum(SHOT_TYPES),
  size: z.string().min(1).max(30),
  framing: z.string().min(1).max(200),
  lighting: z.string().min(1).max(200),
  delivery: z.string().min(1).max(200),
  line: z.string().max(400),
  seconds: z.number().int().min(1).max(30),
  required: z.boolean(),
});

export const PlanSchema = z.object({
  hooks: z.array(HookSchema).length(3),
  beats: z.array(BeatSchema).min(3).max(8),
  shots: z.array(ShotSchema).min(3).max(12),
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
