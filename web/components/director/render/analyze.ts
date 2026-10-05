"use client";

import { detectSpeech, type SpeechAnalysis } from "@/lib/edit";
import type { Take } from "@/lib/takes";

const cache = new WeakMap<Blob, SpeechAnalysis>();

/** Decodes a take's audio and finds where the speech is. Falls back to "no speech" if it can't decode. */
export async function analyzeTake(take: Take): Promise<SpeechAnalysis> {
  const hit = cache.get(take.blob);
  if (hit) return hit;
  let result: SpeechAnalysis = { onset: null, offset: null, speechRms: null, duration: take.seconds };
  try {
    const decoder = new OfflineAudioContext(1, 1, 48000);
    const buffer = await decoder.decodeAudioData(await take.blob.arrayBuffer());
    const mono = new Float32Array(buffer.length);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
    }
    result = detectSpeech(mono, buffer.sampleRate);
  } catch {
    // No audio track, or a format this browser can't decode: use the clip as is.
  }
  cache.set(take.blob, result);
  return result;
}
