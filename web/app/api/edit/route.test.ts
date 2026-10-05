import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_STYLE, type EditPlan, type EditRequest, type Style } from "@/lib/editPlan";

// A plain stub rather than vi.fn(): Vitest fails a test whose vi.fn() mock rejects.
const PLAN: EditPlan = { drop: [], captionFixes: [], cutaways: [], callouts: [], emphasis: [], endCta: "Follow for more", summary: "Done." };
const RESULT: { plan: EditPlan; style: Style } = { plan: PLAN, style: { ...DEFAULT_STYLE, captions: "Bold" } };
let calls: unknown[] = [];
let planEdit: () => Promise<{ plan: EditPlan; style: Style }> = async () => RESULT;
vi.mock("@/lib/directorEdit", () => ({ planEdit: (r: unknown) => (calls.push(r), planEdit()) }));

const { POST } = await import("./route");
const { DirectorError } = await import("@/lib/director");

const body: EditRequest = {
  timeline: [{ segment: 0, shot: 0, title: "Walk in", kind: "hook", seconds: 3, speech: true, startsAt: 0, words: [{ word: "Bad", start: 0.1, end: 0.4 }] }],
  extras: [{ id: "x1", kind: "image", seconds: null, note: "Our summit poster", thumb: "AAAA" }],
  notes: "Mention the Aug 29–30 summit",
  brand: true,
  concept: "Why most teens never start a business",
  platform: "Reels / TikTok",
  audience: "Teens 13–18",
  hook: "Your first business idea is probably bad.",
  style: DEFAULT_STYLE,
  music: "generated",
  current: PLAN,
  feedback: "Make the captions bigger",
  history: [{ feedback: "Quieter music", summary: "Lowered the music." }],
};

const req = (b: unknown, ip = "1.1.1.1") =>
  new NextRequest("http://localhost/api/edit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: typeof b === "string" ? b : JSON.stringify(b),
  });

describe("POST /api/edit", () => {
  beforeEach(() => {
    calls = [];
    planEdit = async () => RESULT;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("validates the request", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    expect((await POST(req("{"))).status).toBe(400);
    expect((await POST(req({ ...body, timeline: [] }))).status).toBe(400);
    expect((await POST(req({ ...body, extras: [{ ...body.extras[0], thumb: "data:image/jpeg;base64,AA" }] }))).status).toBe(400);
    expect((await POST(req({ ...body, extras: Array(7).fill(body.extras[0]) }))).status).toBe(400);
    expect((await POST(req({ ...body, style: { ...DEFAULT_STYLE, captions: "Comic Sans" } }))).status).toBe(400);
    expect((await POST(req({ ...body, feedback: "x".repeat(1001) }))).status).toBe(400);
    expect((await POST(req("x".repeat(3_100_000)))).status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it("says when the Director isn't connected", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await POST(req(body))).status).toBe(503);
  });

  it("returns the Director's plan and maps errors", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    expect(await (await POST(req(body, "2.2.2.2"))).json()).toEqual(RESULT);
    planEdit = async () => {
      throw new DirectorError("The Director is busy right now. Try again in a minute.", 503);
    };
    const res = await POST(req(body, "2.2.2.2"));
    expect(res.status).toBe(503);
  });
});
