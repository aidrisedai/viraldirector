import { captionChunks } from "./edit";
import type { ComposedEdit } from "./editPlan";

// Captions as an SRT file, timed to the finished video, for platforms that take a separate caption track.

/** 00:00:01,250 */
export function srtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

type Cue = { start: number; end: number; text: string };

/** Short phrases (up to `maxWords`, breaking after punctuation), each on screen while it's spoken. */
export function captionCues(edit: ComposedEdit, maxWords = 4): Cue[] {
  const cues: Cue[] = [];
  let offset = 0;
  for (const seg of edit.sequence) {
    const len = seg.to - seg.from;
    const inClip = seg.words.filter((w) => w.end > seg.from && w.start < seg.to);
    for (const chunk of captionChunks(inClip, maxWords)) {
      const start = offset + Math.max(0, chunk[0].start - seg.from);
      const end = offset + Math.min(len, chunk[chunk.length - 1].end - seg.from);
      const text = chunk.map((w) => w.word.replace(/[“”"]/g, "")).join(" ").trim();
      if (text && end > start) cues.push({ start, end, text });
    }
    offset += len;
  }
  // Hold each phrase a little longer when there's room, but never over the next one.
  return cues.map((c, i) => {
    const next = cues[i + 1]?.start ?? Infinity;
    return { ...c, end: Math.min(Math.max(c.end, c.start + 0.7), next) };
  });
}

export function toSrt(edit: ComposedEdit, maxWords = 4): string {
  return captionCues(edit, maxWords)
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`)
    .join("\n");
}
