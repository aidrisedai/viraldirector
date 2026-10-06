"use client";

import { wordsFromChunks, type TimedWord } from "@/lib/edit";
import type { Take } from "@/lib/takes";
import { encodeWav, TRANSCRIBE_MAX_SECONDS } from "@/lib/transcript";

export type TranscribeProgress =
  | { phase: "download"; fraction: number }
  | { phase: "transcribe"; done: number; total: number; where: "server" | "device" };
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
        else if (m.type === "ready") onProgress({ phase: "transcribe", done: i, total: takes.length, where: "device" });
        else if (m.id !== take.id) return;
        else if (m.type === "result") { w.removeEventListener("message", onMessage); resolve({ text: m.text, words: wordsFromChunks(m.chunks) }); }
        else if (m.type === "error") { w.removeEventListener("message", onMessage); reject(new Error(m.message)); }
      };
      w.addEventListener("message", onMessage);
      w.postMessage({ id: take.id, audio }, [audio.buffer]);
    });
    results.set(take.id, result);
    onProgress({ phase: "transcribe", done: i + 1, total: takes.length, where: "device" });
  }
  return results;
}

/** Thrown when the server has no transcription set up, so the caller can fall back to the device. */
class NoServer extends Error {}

async function transcribeOnServer(take: Take, prompt: string): Promise<TakeTranscript> {
  const audio = await audio16k(take);
  if (audio.length / 16000 > TRANSCRIBE_MAX_SECONDS) throw new Error("That clip is too long to transcribe.");
  const form = new FormData();
  form.append("audio", new Blob([encodeWav(audio, 16000)], { type: "audio/wav" }), "clip.wav");
  form.append("prompt", prompt);
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({ error: "No response." }))) as TakeTranscript | { error: string };
  if (res.status === 503 && "error" in data && /isn’t set up/.test(data.error)) throw new NoServer();
  if ("error" in data) throw new Error(data.error);
  return data;
}

/** One clip on the server, or null when the server doesn't transcribe (no model download for a quick look). */
export async function transcribeIfServer(take: Take): Promise<TakeTranscript | null> {
  if (!(await serverTranscription())) return null;
  try {
    return await transcribeOnServer(take, "");
  } catch {
    return null;
  }
}

let serverAvailable: boolean | null = null;

/** Whether this deployment transcribes on the server (no model download for the creator). */
export async function serverTranscription(): Promise<boolean> {
  if (serverAvailable !== null) return serverAvailable;
  try {
    const health = await (await fetch("/api/health", { cache: "no-store" })).json();
    serverAvailable = health.transcription === "server";
  } catch {
    serverAvailable = false;
  }
  return serverAvailable;
}

/**
 * Exact captions with word timings: on the server when it's set up (fast, nothing to download),
 * otherwise on this device. `prompts` (script lines by take id) help recognition with names.
 */
export async function transcribe(
  takes: Take[],
  prompts: Record<string, string>,
  onProgress: (p: TranscribeProgress) => void,
): Promise<Map<string, TakeTranscript>> {
  if (await serverTranscription()) {
    try {
      const results = new Map<string, TakeTranscript>();
      onProgress({ phase: "transcribe", done: 0, total: takes.length, where: "server" });
      let done = 0;
      // A few at a time keeps it quick without flooding the rate limit.
      for (let i = 0; i < takes.length; i += 3) {
        await Promise.all(
          takes.slice(i, i + 3).map(async (t) => {
            results.set(t.id, await transcribeOnServer(t, prompts[t.id] ?? ""));
            onProgress({ phase: "transcribe", done: ++done, total: takes.length, where: "server" });
          }),
        );
      }
      return results;
    } catch (e) {
      if (!(e instanceof NoServer)) throw e;
      serverAvailable = false;
    }
  }
  return transcribeTakes(takes, onProgress);
}
