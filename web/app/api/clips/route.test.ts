import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { SAMPLE_PLAN, DEFAULT_BRIEF } from "@/lib/plan";
import { cleanAssign } from "@/lib/clipDirector";

const { POST } = await import("./route");
const clip = (id: string, speech = false, transcript: string | null = null) => ({ id, name: `${id}.mov`, seconds: 3.2, speech, transcript, frames: [] });
const post = (body: unknown) => POST(new NextRequest("http://x/api/clips", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));

describe("POST /api/clips without the Director", () => {
  let key: string | undefined;
  beforeEach(() => {
    key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
  });

  it("plans around the clips", async () => {
    const res = await post({ mode: "plan", brief: { ...DEFAULT_BRIEF, concept: "Our hackathon" }, clips: [clip("a", true, "We built it in a day."), clip("b"), clip("c")] });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sample).toBe(true);
    expect(data.plan.shots).toHaveLength(3);
    expect(data.assign).toEqual({ a: 0, b: 1, c: 2 });
  });

  it("files clips under open shots only", async () => {
    const res = await post({ mode: "match", brief: { ...DEFAULT_BRIEF, concept: "Demo day" }, plan: SAMPLE_PLAN, filled: [3], clips: [clip("s1"), clip("s2")] });
    const data = await res.json();
    expect(data.assign).toEqual({ s1: 4, s2: 6 });
  });

  it("rejects malformed requests", async () => {
    expect((await post({ mode: "plan", brief: DEFAULT_BRIEF, clips: [] })).status).toBe(400);
  });
});

describe("cleanAssign", () => {
  it("drops unknown clips, out-of-range or filled shots, and doubles", () => {
    expect(cleanAssign([{ clip: "a", shot: 1 }, { clip: "b", shot: 1 }, { clip: "x", shot: 2 }, { clip: "c", shot: 9 }, { clip: "c", shot: 0 }, { clip: "d", shot: 2 }], new Set(["a", "b", "c", "d"]), 5, [0])).toEqual({ a: 1, d: 2 });
  });
});
