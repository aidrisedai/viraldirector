import { captionWords, type TimedWord } from "./edit";

// Shared by the transcription route and the browser: packing audio for upload, and turning a
// transcript plus word timings into caption words that keep their punctuation.

/** Longest clip we'll transcribe in one request (16 kHz mono WAV ≈ 1.9 MB a minute). */
export const TRANSCRIBE_MAX_SECONDS = 180;
export const TRANSCRIBE_MAX_BYTES = 16000 * 2 * TRANSCRIBE_MAX_SECONDS + 1024;

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Word timings from speech recognition usually drop punctuation ("idea" for "idea,"). This walks the
 * punctuated transcript and gives each of its words the timing of the matching recognised word,
 * filling any it can't match from its neighbours, so captions get both the punctuation and the timing.
 */
export function alignWords(text: string, timed: TimedWord[]): TimedWord[] {
  const tokens = captionWords(text);
  if (!timed.length) return [];
  if (!tokens.length) return timed;
  const out: (TimedWord | null)[] = [];
  let j = 0;
  for (const token of tokens) {
    const n = norm(token);
    // Look a few words ahead in case recognition split or skipped one.
    let hit = -1;
    for (let k = j; k < Math.min(timed.length, j + 4); k++) {
      if (norm(timed[k].word) === n) {
        hit = k;
        break;
      }
    }
    if (hit >= 0) {
      out.push({ word: token, start: timed[hit].start, end: timed[hit].end });
      j = hit + 1;
    } else out.push(null);
  }
  // Fill unmatched words between their matched neighbours.
  const first = timed[0].start, last = timed[timed.length - 1].end;
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    let e = i;
    while (e < out.length && !out[e]) e++;
    const from = i > 0 ? out[i - 1]!.end : first;
    const to = e < out.length ? out[e]!.start : last;
    const step = Math.max(0.05, (to - from) / (e - i));
    for (let k = i; k < e; k++) out[k] = { word: tokens[k], start: from + (k - i) * step, end: from + (k - i + 1) * step };
    i = e - 1;
  }
  return out as TimedWord[];
}
