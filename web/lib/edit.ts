import type { Plan, Shot } from "./plan";
import type { Take } from "./takes";

// ---------- Speech detection (trim dead air, normalise level) ----------

export type SpeechAnalysis = {
  /** Seconds where speech starts and ends; null when no speech was found. */
  onset: number | null;
  offset: number | null;
  /** RMS level of the speech frames (0–1); null when no speech. */
  speechRms: number | null;
  duration: number;
};

const FRAME = 0.02; // 20 ms analysis frames

/** Finds where speech starts and ends in mono samples, using a level threshold relative to the loud parts. */
export function detectSpeech(samples: Float32Array, sampleRate: number): SpeechAnalysis {
  const size = Math.max(1, Math.round(sampleRate * FRAME));
  const frames: number[] = [];
  for (let i = 0; i + size <= samples.length; i += size) {
    let sum = 0;
    for (let j = i; j < i + size; j++) sum += samples[j] * samples[j];
    frames.push(Math.sqrt(sum / size));
  }
  const duration = samples.length / sampleRate;
  if (!frames.length) return { onset: null, offset: null, speechRms: null, duration };

  const sorted = [...frames].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.95)];
  const threshold = Math.max(0.015, loud * 0.2);
  const voiced = frames.map((r) => r > threshold);
  // Ignore isolated blips (a click or a breath): need 3 voiced frames in a row.
  const first = voiced.findIndex((v, i) => v && voiced[i + 1] && voiced[i + 2]);
  let last = -1;
  for (let i = voiced.length - 1; i >= 2; i--) if (voiced[i] && voiced[i - 1] && voiced[i - 2]) { last = i; break; }
  if (first < 0 || last < first) return { onset: null, offset: null, speechRms: null, duration };

  let sum = 0, n = 0;
  for (let i = first; i <= last; i++) if (voiced[i]) { sum += frames[i] * frames[i]; n++; }
  return { onset: first * FRAME, offset: (last + 1) * FRAME, speechRms: Math.sqrt(sum / n), duration };
}

// ---------- Captions ----------

export type TimedWord = { word: string; start: number; end: number };

/** Splits caption text into words, attaching stray punctuation ("—", "-", "…") to the word before it. */
export function captionWords(text: string): string[] {
  const out: string[] = [];
  for (const token of text.replace(/[“”"]/g, "").split(/\s+/).filter(Boolean)) {
    if (/[\p{L}\p{N}]/u.test(token)) out.push(token);
    else if (out.length) out[out.length - 1] += ` ${token}`;
  }
  return out;
}

/**
 * Spreads words across [start, end], weighting each by its length plus a pause after punctuation.
 * Without word-level timestamps this keeps captions close to the speech for short lines.
 */
export function timeWords(text: string, start: number, end: number): TimedWord[] {
  const words = captionWords(text);
  if (!words.length || end <= start) return [];
  const weight = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 2 + (/[.,!?;:—–-]$/.test(w) ? 3 : 0);
  const total = words.reduce((t, w) => t + weight(w), 0);
  let t = start;
  return words.map((word) => {
    const d = ((end - start) * weight(word)) / total;
    const w = { word, start: t, end: t + d };
    t += d;
    return w;
  });
}

/** Groups words into on-screen caption chunks of up to 3 words, breaking after punctuation. */
export function captionChunks(words: TimedWord[], max = 3): TimedWord[][] {
  const chunks: TimedWord[][] = [];
  let cur: TimedWord[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= max || /[.,!?;:—–]$/.test(w.word)) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** Whisper word chunks ({ text, timestamp: [start, end|null] }) → timed words relative to the clip. */
export function wordsFromChunks(chunks: { text: string; timestamp: [number, number | null] }[]): TimedWord[] {
  const out: TimedWord[] = [];
  chunks.forEach((c, i) => {
    const word = c.text.trim();
    if (!word) return;
    const start = c.timestamp[0];
    const next = chunks[i + 1]?.timestamp[0];
    const end = c.timestamp[1] ?? (next !== undefined ? next : start + 0.4);
    out.push({ word, start, end: Math.max(end, start + 0.05) });
  });
  return out;
}

/**
 * Times caption text that a creator may have edited. With exact word times and the same word
 * count, each word keeps its timing; otherwise the words are spread across the speech.
 */
export function retimeWords(text: string, exact: TimedWord[] | null, onset: number | null, offset: number | null): TimedWord[] {
  const words = captionWords(text);
  if (!words.length) return [];
  if (exact?.length) {
    if (exact.length === words.length) return exact.map((w, i) => ({ ...w, word: words[i] }));
    return timeWords(words.join(" "), exact[0].start, exact[exact.length - 1].end);
  }
  if (onset === null || offset === null) return [];
  return timeWords(words.join(" "), onset, offset);
}

// ---------- Timeline ----------

export type Segment = {
  shot: number;
  take: Take;
  kind: Shot["type"];
  /** Portion of the source clip to use, in seconds. */
  from: number;
  to: number;
  /** Caption words, timed relative to the start of the source clip. */
  words: TimedWord[];
  /** Gain that brings this clip's speech to a common level. */
  gain: number;
  /** Whether the clip carries speech (music ducks under it). */
  speech: boolean;
  /** Speech RMS after `gain`; null without speech. Music is mixed relative to this. */
  voiceLevel: number | null;
};

const LEAD = 0.2; // keep a breath before the first word
const TAIL = 0.5; // and let the last word (and its trailing sound) land before the cut
// Speech level that lands near the loudness social platforms play at (about −14 to −16 LUFS for voice).
export const TARGET_RMS = 0.25;

/** Caption text for a kept take: the creator's edit, else what was said, else the script. */
export function captionText(take: Take, shot: Shot, edited?: string): string {
  if (!shot.line.trim() && !edited?.trim()) return "";
  return (edited?.trim() || take.transcript?.trim() || shot.line).trim();
}

/** Builds the edit: kept takes in script order, trimmed, with timed captions and level matching. */
export function buildTimeline(
  plan: Plan,
  kept: (Take | undefined)[],
  analyses: Map<string, SpeechAnalysis>,
  edits: Record<string, string> = {},
): Segment[] {
  const segments: Segment[] = [];
  plan.shots.forEach((shot, i) => {
    const take = kept[i];
    if (!take) return;
    const a = analyses.get(take.id);
    const length = a?.duration && Number.isFinite(a.duration) ? a.duration : take.seconds;
    const text = captionText(take, shot, edits[take.id]);
    // Exact word times (from speech recognition) beat the level-based estimate.
    const exact = take.words?.length ? take.words : null;
    const onset = exact ? exact[0].start : (a?.onset ?? null);
    const offset = exact ? exact[exact.length - 1].end : (a?.offset ?? null);
    const speech = text.length > 0 && onset !== null && offset !== null;

    let from = 0, to = length;
    if (speech) {
      from = Math.max(0, onset! - LEAD);
      to = Math.min(length, offset! + TAIL);
    }
    if (to - from < 0.5) { from = 0; to = length; } // never trim a clip to nothing

    const words = speech ? retimeWords(text, exact, onset, Math.min(offset!, to)) : [];
    const gain = a?.speechRms ? Math.min(8, Math.max(0.25, TARGET_RMS / a.speechRms)) : 1;

    const voiceLevel = speech && a?.speechRms ? a.speechRms * gain : null;
    segments.push({ shot: i, take, kind: shot.type, from, to, words, gain, speech, voiceLevel });
  });
  return segments;
}

export const timelineSeconds = (segments: Segment[]) => segments.reduce((t, s) => t + (s.to - s.from), 0);

// ---------- Output formats ----------

export const FORMATS = {
  "9:16": { width: 1080, height: 1920, label: "9:16 · Reels, TikTok, Shorts" },
  "4:5": { width: 1080, height: 1350, label: "4:5 · Instagram & LinkedIn feed" },
} as const;
export type FormatKey = keyof typeof FORMATS;

export const MUSIC_STYLES = ["Calm build", "Upbeat", "My music", "No music"] as const;
export type MusicStyle = (typeof MUSIC_STYLES)[number];
