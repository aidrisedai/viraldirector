import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_BRIEF, SAMPLE_PLAN } from "@/lib/plan";

// A plain stub rather than vi.fn(): Vitest fails a test whose vi.fn() mock rejects,
// even when the route handles the rejection.
let calls: unknown[] = [];
let generatePlan: () => Promise<unknown> = async () => SAMPLE_PLAN;
vi.mock("@/lib/director", async (orig) => ({
  ...(await orig<typeof import("@/lib/director")>()),
  generatePlan: (brief: unknown) => (calls.push(brief), generatePlan()),
}));

const { POST } = await import("./route");
const { DirectorError } = await import("@/lib/director");

const req = (body: unknown, ip = "1.1.1.1") =>
  new NextRequest("http://localhost/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const brief = { ...DEFAULT_BRIEF, concept: "Why most teens never start a business" };

describe("POST /api/plan", () => {
  beforeEach(() => {
    calls = [];
    generatePlan = async () => SAMPLE_PLAN;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects malformed JSON and invalid briefs", async () => {
    expect((await POST(req("{nope"))).status).toBe(400);
    const res = await POST(req({ ...brief, concept: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  it("returns the sample plan when no API key is configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await POST(req(brief));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ plan: SAMPLE_PLAN, sample: true });
    expect(calls).toHaveLength(0);
  });

  it("returns the Director's plan when configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const res = await POST(req(brief, "2.2.2.2"));
    expect(await res.json()).toEqual({ plan: SAMPLE_PLAN, sample: false });
    expect(calls).toEqual([brief]);
  });

  it("maps Director errors to their status and message", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    generatePlan = async () => {
      throw new DirectorError("The Director can’t plan this concept.", 422);
    };
    const res = await POST(req(brief, "3.3.3.3"));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("The Director can’t plan this concept.");
  });

  it("rate limits per client", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await POST(req(brief, "4.4.4.4"))).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
