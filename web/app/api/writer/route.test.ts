import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_BRIEF } from "@/lib/plan";
import type { Story, WriterRequest } from "@/lib/story";

// A plain stub rather than vi.fn(): Vitest fails a test whose vi.fn() mock rejects.
const STORY: Story = { title: "Idea number four", logline: "My first three ideas flopped, and that is why the fourth sold.", script: "My first idea flopped.", note: "" };
let calls: unknown[] = [];
let askWriter: () => Promise<unknown> = async () => ({ story: STORY });
vi.mock("@/lib/writer", () => ({
  askWriter: (r: unknown) => (calls.push(r), askWriter()),
}));

const { POST } = await import("./route");
const { DirectorError } = await import("@/lib/director");

const { goal, length, platform, audience, format } = DEFAULT_BRIEF;
const body: WriterRequest = {
  action: "draft",
  writer: "screenwriter",
  scenario: "I built three apps nobody used. The fourth, a tutoring marketplace, got its first sale in a week.",
  settings: { goal, length, platform, audience, format },
  answers: [],
  draft: null,
  note: "",
};

const req = (b: unknown, ip = "1.1.1.1") =>
  new NextRequest("http://localhost/api/writer", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: typeof b === "string" ? b : JSON.stringify(b),
  });

describe("POST /api/writer", () => {
  beforeEach(() => {
    calls = [];
    askWriter = async () => ({ story: STORY });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects malformed, invalid and oversized requests", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    expect((await POST(req("{nope"))).status).toBe(400);
    expect((await POST(req({ ...body, writer: "poet" }))).status).toBe(400);
    const short = await POST(req({ ...body, scenario: "too short" }));
    expect(short.status).toBe(400);
    expect((await short.json()).error).toMatch(/bit more/);
    expect((await POST(req("x".repeat(50_000)))).status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it("explains when the writers aren't connected", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await POST(req(body));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/aren’t connected/);
  });

  it("returns the writer's story", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const res = await POST(req(body, "2.2.2.2"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ story: STORY });
    expect(calls).toHaveLength(1);
  });

  it("maps writer errors to their status and message", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    askWriter = async () => {
      throw new DirectorError("The Director is busy right now. Try again in a minute.", 503);
    };
    const res = await POST(req(body, "4.4.4.4"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/busy/);
  });
});
