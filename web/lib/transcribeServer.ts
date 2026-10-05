import "server-only";
import { alignWords } from "./transcript";
import type { TimedWord } from "./edit";

// Server-side speech to text with OpenAI, so creators don't download a speech model.
// whisper-1 is the OpenAI-hosted model that returns word-level timestamps.

const MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1";

export const transcriptionConfigured = () => Boolean(process.env.OPENAI_API_KEY);

export class TranscribeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type Verbose = { text?: string; words?: { word: string; start: number; end: number }[] };

/** Transcribes one clip's audio; `prompt` (the script line) helps with names and spelling. */
export async function transcribeAudio(audio: Blob, prompt: string): Promise<{ text: string; words: TimedWord[] }> {
  const form = new FormData();
  form.append("file", audio, "clip.wav");
  form.append("model", MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  if (prompt) form.append("prompt", prompt.slice(0, 800));

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    console.error("Transcription request failed", e);
    throw new TranscribeError("Couldn’t reach the transcription service. Try again.", 504);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Transcription API error", res.status, detail.slice(0, 300));
    if (res.status === 429) throw new TranscribeError("Transcription is busy right now. Try again in a minute.", 503);
    if (res.status === 401 || res.status === 403) throw new TranscribeError("Transcription isn’t configured correctly.", 500);
    throw new TranscribeError("Transcription failed. Try again.", 502);
  }
  const data = (await res.json()) as Verbose;
  const text = (data.text ?? "").trim();
  const words = (data.words ?? [])
    .filter((w) => typeof w.start === "number" && typeof w.end === "number" && w.word?.trim())
    .map((w) => ({ word: w.word.trim(), start: w.start, end: Math.max(w.end, w.start + 0.05) }));
  return { text, words: alignWords(text, words) };
}
