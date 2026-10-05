"use client";

import { wordsFromChunks, type TimedWord } from "@/lib/edit";
import type { Take } from "@/lib/takes";

export type TranscribeProgress = { phase: "download"; fraction: number } | { phase: "transcribe"; done: number; total: number };
export type TakeTranscript = { text: string; words: TimedWord[] };

let worker: Worker | null = null;
const getWorker = () => (worker ??= new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" }));

/** Decodes a take's audio to 16 kHz mono, the input Whisper expects. */
async function audio16k(take: Take): Promise<Float32Array> {
  const buffer = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(await take.blob.arrayBuffer());
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice(); // own copy: it is transferred to the worker
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) mono[i] += d[i] / buffer.numberOfChannels;
  }
  return mono;
}

/**
 * Transcribes takes on this device with word timestamps. The first run downloads the speech
 * model (about 80–100 MB), which the browser then caches.
 */
export async function transcribeTakes(takes: Take[], onProgress: (p: TranscribeProgress) => void): Promise<Map<string, TakeTranscript>> {
  const w = getWorker();
  const results = new Map<string, TakeTranscript>();
  for (let i = 0; i < takes.length; i++) {
    const take = takes[i];
    const audio = await audio16k(take);
    const result = await new Promise<TakeTranscript>((resolve, reject) => {
      const onMessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.type === "download") onProgress({ phase: "download", fraction: Math.min(1, m.progress / 100) });
        else if (m.type === "ready") onProgress({ phase: "transcribe", done: i, total: takes.length });
        else if (m.id !== take.id) return;
        else if (m.type === "result") { w.removeEventListener("message", onMessage); resolve({ text: m.text, words: wordsFromChunks(m.chunks) }); }
        else if (m.type === "error") { w.removeEventListener("message", onMessage); reject(new Error(m.message)); }
      };
      w.addEventListener("message", onMessage);
      w.postMessage({ id: take.id, audio }, [audio.buffer]);
    });
    results.set(take.id, result);
    onProgress({ phase: "transcribe", done: i + 1, total: takes.length });
  }
  return results;
}
