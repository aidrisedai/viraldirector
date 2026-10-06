import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { GET, POST } = await import("./route");
const defaults = { goal: "Teach", length: "45s", platform: "Reels / TikTok", audience: "Teens 13–18", format: "Director picks" };
const body = { name: "90 days", goal: "Grow", perWeek: 7, durationDays: 90, startDate: "2026-03-01", defaults };
const post = (b: unknown) => POST(new NextRequest("http://localhost/api/projects", { method: "POST", body: JSON.stringify(b) }));

describe("/api/projects", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("explains when sign-in or the database isn't set up", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.stubEnv("DEV_AUTH", "");
    expect((await GET()).status).toBe(503);
    vi.stubEnv("DEV_AUTH", "1");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "");
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/database/);
  });

  const url = process.env.TEST_DATABASE_URL;
  (url ? it : it.skip)("creates and lists the signed-in user's projects, validating input", async () => {
    vi.stubEnv("DEV_AUTH", "1");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", url!);
    expect((await post({ ...body, name: "" })).status).toBe(400);
    expect((await post({ ...body, perWeek: 99 })).status).toBe(400);
    const created = await post(body);
    expect(created.status).toBe(201);
    const { projects } = await (await GET()).json();
    expect(projects.some((p: { name: string }) => p.name === "90 days")).toBe(true);
  });

  afterAll(async () => (await import("@/lib/db")).closeDb());
});
