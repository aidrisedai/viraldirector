import { plannedSeconds, targetSeconds, type Brief, type Plan, type Shot } from "./plan";

export type Take = {
  id: string;
  shot: number;
  url: string;
  blob: Blob;
  mime: string;
  seconds: number;
  /** Peak sample level 0–1 measured while recording; null for uploads. */
  peak: number | null;
  /** Share of audio frames that hit full scale, 0–1; null for uploads. */
  clipped: number | null;
  /** Share of the take with speech-level audio, 0–1; null for uploads. */
  voiced: number | null;
  /** What browser speech recognition heard during the take; null when unavailable. */
  transcript: string | null;
  /** Word-level timings from on-device speech recognition, relative to the clip; null until run. */
  words?: { word: string; start: number; end: number }[] | null;
  source: "camera" | "upload";
};

export type Check = { label: string; note: string; value: number; warn: boolean };
export type Review = { verdict: "accept" | "retake"; note: string; checks: Check[] };

/** A sample at or above this level counts as clipped. */
export const CLIP_LEVEL = 0.99;
/** Brief peaks on plosives are normal; flag only when clipping is sustained. */
const CLIP_SHARE = 0.02;
const QUIET_PEAK = 0.05;
const MIN_VOICED = 0.25;

const pct = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 100);

/** Automatic take checks we can measure in the browser: length, level, clipping, speech. */
export function reviewTake(take: Take, shot: Shot): Review {
  const checks: Check[] = [];
  const notes: string[] = [];
  const hasLine = shot.line.trim().length > 0;

  const ratio = take.seconds / shot.seconds;
  const short = hasLine && take.seconds < shot.seconds - 1 && ratio < 0.8;
  checks.push({ label: "Duration", note: `${take.seconds.toFixed(1)}s of ${shot.seconds}s`, value: pct(ratio), warn: short });

  if (take.peak !== null) {
    const clipping = (take.clipped ?? 0) > CLIP_SHARE;
    const quiet = take.peak < QUIET_PEAK;
    checks.push({
      label: "Audio",
      note: clipping ? "Clipping" : quiet ? "Too quiet" : "Clear",
      value: clipping ? 100 : pct(take.peak / 0.8),
      warn: clipping || quiet,
    });
    if (clipping) notes.push("Your audio is clipping — move the mic back a little or speak a touch softer.");
    else if (quiet && hasLine) notes.push("I can barely hear you — move closer to the mic and try again.");
  }

  if (hasLine && take.voiced !== null) {
    const missing = take.voiced < MIN_VOICED;
    checks.push({ label: "Line delivered", note: missing ? "Not heard" : "Heard", value: pct(take.voiced / 0.6), warn: missing });
    if (missing && !notes.length) notes.push("I didn’t hear the line — check your mic and say it again.");
  }

  if (short && !notes.length) notes.push("That ran short — slow down and land the last words.");

  const verdict = checks.some((c) => c.warn) ? "retake" : "accept";
  const note =
    notes[0] ??
    (verdict === "accept"
      ? take.source === "upload"
        ? "Clip added. Play it back to make sure it’s the one you want."
        : "Good take. Keep it and move on to the next shot."
      : "Something’s off with this take — have another go.");

  return { verdict, note, checks };
}

export type ExportCheck = { label: string; ok: boolean };

/** The PRD's pre-export quality gate, limited to what the app measures today. */
export function exportChecks(plan: Plan, brief: Pick<Brief, "length">, kept: (Take | undefined)[]): ExportCheck[] {
  const missing = plan.shots.filter((s, i) => s.required && !kept[i]).length;
  return [
    { label: "Hook under 3s", ok: plan.beats[0].seconds <= 3 },
    { label: "Within target length", ok: plannedSeconds(plan) <= targetSeconds(brief) + 2 },
    { label: "No audio clipping", ok: kept.every((t) => !t || (t.clipped ?? 0) <= CLIP_SHARE) },
    { label: missing ? `${missing} required ${missing === 1 ? "shot" : "shots"} missing` : "All required shots", ok: missing === 0 },
  ];
}

export const fileExtension = (mime: string) => (mime.includes("mp4") ? "mp4" : mime.includes("quicktime") ? "mov" : "webm");

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "shot";

export function takeFileName(take: Take, shot: Shot) {
  return `${String(take.shot + 1).padStart(2, "0")}-${slug(shot.title)}.${fileExtension(take.mime)}`;
}

export function scriptText(concept: string, plan: Plan, hookIndex: number): string {
  const lines = [concept, "", `Hook (${plan.hooks[hookIndex].kind}): ${plan.hooks[hookIndex].line}`, "", "BEAT SHEET"];
  let t = 0;
  for (const b of plan.beats) lines.push(`${t}–${(t += b.seconds)}s  ${b.label.toUpperCase()}: ${b.line}`);
  lines.push("", "SHOT LIST");
  plan.shots.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.title} (${s.type}, ${s.seconds}s${s.required ? "" : ", optional"}) — ${s.location}`);
    lines.push(`   Framing: ${s.framing}`, `   Lighting: ${s.lighting}`, `   Delivery: ${s.delivery}`);
    if (s.line) lines.push(`   Line: ${s.line}`);
  });
  return lines.join("\n") + "\n";
}
