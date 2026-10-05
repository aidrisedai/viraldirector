import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ChatRequest, DirectorReply } from "@/lib/chat";
import { DEFAULT_BRIEF, SAMPLE_PLAN } from "@/lib/plan";

// A plain stub rather than vi.fn(): Vitest fails a test whose vi.fn() mock rejects.
let calls: unknown[] = [];
let askDirector: () => Promise<DirectorReply> = async () => ({ reply: "Face the window.", suggestedLine: "", verdict: "none" });
vi.mock("@/lib/directorChat", () => ({
  askDirector: (r: unknown) => (calls.push(r), askDirector()),
}));

const { POST } = await import("./route");
const { DirectorError } = await import("@/lib/director");

const body: ChatRequest = {
  mode: "ask",
  message: "How should I light this shot?",
  history: [],
  context: {
    brief: { ...DEFAULT_BRIEF, concept: "Why most teens never start a business" },
    plan: SAMPLE_PLAN,
    hook: 0,
    step: "Shots",
    shot: 2,
    originalLine: null,
  },
  take: null,
};

const req = (b: unknown, ip = "1.1.1.1") =>
  new NextRequest("http://localhost/api/director", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: typeof b === "string" ? b : JSON.stringify(b),
  });

describe("POST /api/director", () => {
  beforeEach(() => {
    calls = [];
    askDirector = async () => ({ reply: "Face the window.", suggestedLine: "", verdict: "none" });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects malformed and invalid requests", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    expect((await POST(req("{nope"))).status).toBe(400);
    expect((await POST(req({ ...body, message: "" }))).status).toBe(400);
    expect((await POST(req({ ...body, mode: "rewrite-everything" }))).status).toBe(400);
    const badFrame = { ...body, mode: "take", take: { takeNumber: 1, source: "camera", seconds: 3, peak: 0.5, clipped: 0, voiced: 0.5, transcript: null, frames: ["data:image/jpeg;base64,AAAA"] } };
    expect((await POST(req(badFrame))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("rejects oversized requests before parsing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    expect((await POST(req("x".repeat(2_600_000)))).status).toBe(413);
  });

  it("explains when the Director isn't connected", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await POST(req(body));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/isn’t connected/);
  });

  it("returns the Director's reply", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const res = await POST(req(body, "2.2.2.2"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Face the window.", suggestedLine: "", verdict: "none" });
    expect(calls).toHaveLength(1);
  });

  it("maps Director errors to their status and message", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    askDirector = async () => {
      throw new DirectorError("The Director is busy right now. Try again in a minute.", 503);
    };
    const res = await POST(req(body, "4.4.4.4"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/busy/);
  });

  it("rate limits per client", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const statuses = [];
    for (let i = 0; i < 41; i++) statuses.push((await POST(req(body, "3.3.3.3"))).status);
    expect(statuses.slice(0, 40).every((s) => s === 200)).toBe(true);
    expect(statuses[40]).toBe(429);
  });
});
