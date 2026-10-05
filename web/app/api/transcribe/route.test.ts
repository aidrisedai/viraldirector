import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { encodeWav } from "@/lib/transcript";

const { POST } = await import("./route");

const wav = () => new Blob([encodeWav(new Float32Array(16000), 16000)], { type: "audio/wav" });
const req = (form: FormData, ip = "1.1.1.1") =>
  new NextRequest("http://localhost/api/transcribe", { method: "POST", headers: { "x-real-ip": ip }, body: form });
const formWith = (audio: Blob, prompt = "Bad ideas teach you") => {
  const f = new FormData();
  f.append("audio", audio, "clip.wav");
  f.append("prompt", prompt);
  return f;
};

describe("POST /api/transcribe", () => {
  let sent: { url: string; body: FormData } | null = null;
  beforeEach(() => {
    sent = null;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      sent = { url, body: init.body as FormData };
      return new Response(JSON.stringify({ text: "Bad ideas, teach you.", words: [{ word: "Bad", start: 0.1, end: 0.3 }, { word: "ideas", start: 0.3, end: 0.7 }, { word: "teach", start: 0.8, end: 1 }, { word: "you", start: 1, end: 1.2 }] }), { status: 200 });
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("says when server transcription isn't set up", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const res = await POST(req(formWith(wav())));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/isn’t set up/);
  });

  it("rejects missing or non-WAV audio", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    expect((await POST(req(new FormData(), "2.2.2.2"))).status).toBe(400);
    expect((await POST(req(formWith(new Blob([new Uint8Array(2000)])), "2.2.2.2"))).status).toBe(415);
    expect(sent).toBeNull();
  });

  it("asks whisper-1 for word timings and returns punctuated, timed words", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    const res = await POST(req(formWith(wav()), "3.3.3.3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Bad ideas, teach you.");
    expect(body.words.map((w: { word: string }) => w.word)).toEqual(["Bad", "ideas,", "teach", "you."]);
    expect(sent!.url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(sent!.body.get("model")).toBe("whisper-1");
    expect(sent!.body.get("timestamp_granularities[]")).toBe("word");
    expect(sent!.body.get("prompt")).toBe("Bad ideas teach you");
  });

  it("maps upstream errors", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 429 }));
    const res = await POST(req(formWith(wav()), "4.4.4.4"));
    expect(res.status).toBe(503);
  });
});
