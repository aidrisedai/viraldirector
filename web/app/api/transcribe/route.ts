import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/clientIp";
import { createRateLimiter } from "@/lib/rateLimit";
import { TRANSCRIBE_MAX_BYTES } from "@/lib/transcript";
import { TranscribeError, transcribeAudio, transcriptionConfigured } from "@/lib/transcribeServer";

export const runtime = "nodejs";
export const maxDuration = 90;

const limiter = createRateLimiter({
  limit: Number(process.env.TRANSCRIBE_RATE_LIMIT ?? 60),
  windowMs: 10 * 60 * 1000,
});

type Body = { text: string; words: { word: string; start: number; end: number }[] } | { error: string };
const json = (body: Body, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** POST multipart: `audio` (16 kHz mono WAV) and optional `prompt` (the script line). */
export async function POST(req: NextRequest) {
  if (!transcriptionConfigured()) return json({ error: "Server transcription isn’t set up." }, 503);
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > TRANSCRIBE_MAX_BYTES + 4096) return json({ error: "That clip is too long to transcribe." }, 413);

  const { ok, retryAfter } = limiter(clientIp(req));
  if (!ok) return json({ error: "Lots of transcription in a short time. Try again in a few minutes." }, 429, { "Retry-After": String(retryAfter) });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const audio = form.get("audio");
  const prompt = String(form.get("prompt") ?? "").slice(0, 800);
  if (!(audio instanceof Blob) || audio.size < 1000) return json({ error: "No audio received." }, 400);
  if (audio.size > TRANSCRIBE_MAX_BYTES) return json({ error: "That clip is too long to transcribe." }, 413);
  // Only our own WAV uploads: RIFF/WAVE header.
  const head = new Uint8Array(await audio.slice(0, 12).arrayBuffer());
  if (String.fromCharCode(...head.slice(0, 4)) !== "RIFF" || String.fromCharCode(...head.slice(8, 12)) !== "WAVE") {
    return json({ error: "Unsupported audio." }, 415);
  }

  try {
    return json(await transcribeAudio(audio, prompt));
  } catch (error) {
    if (error instanceof TranscribeError) return json({ error: error.message }, error.status);
    console.error("Unexpected transcription error", error);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
}
