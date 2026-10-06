import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise).
const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("projects data (Postgres)", async () => {
  let db: typeof import("./db");
  let p: typeof import("./projects");
  const alice = `alice-${Date.now()}`, bob = `bob-${Date.now()}`;
  const defaults = { goal: "Teach", length: "45s", platform: "Reels / TikTok", audience: "Teens 13–18", format: "Director picks" } as const;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    p = await import("./projects");
  });
  afterAll(async () => db.closeDb());

  it("creates, lists and scopes projects to their owner", async () => {
    const proj = await p.createProject(alice, { name: "90 days of building", goal: "Grow to 1,000 followers", perWeek: 7, durationDays: 90, startDate: "2026-03-01", defaults });
    expect(proj.startDate).toBe("2026-03-01");
    expect((await p.listProjects(alice)).map((x) => x.name)).toContain("90 days of building");
    expect(await p.listProjects(bob)).toEqual([]);
    expect(await p.getProjectDetail(bob, proj.id)).toBeNull();
    expect(await p.updateProject(bob, proj.id, { name: "hijack" })).toBeNull();
    expect((await p.updateProject(alice, proj.id, { name: "Build in public" }))!.name).toBe("Build in public");
  });

  it("keeps an idea backlog and uses an idea up when its video is made", async () => {
    const proj = await p.createProject(alice, { name: "Ideas", goal: "", perWeek: 3, durationDays: null, startDate: "2026-03-01", defaults });
    const ideas = await p.addIdeas(alice, proj.id, [
      { title: "My first failure", concept: "The app nobody used", angle: "" },
      { title: "Asking users", concept: "How 10 interviews changed everything", angle: "" },
    ]);
    expect(ideas.map((i) => i.position)).toEqual([1, 2]);
    const video = await p.createVideo(alice, { projectId: proj.id, ideaId: ideas[0].id, title: ideas[0].title, concept: ideas[0].concept, brief: { a: 1 }, plan: null });
    expect(video!.status).toBe("draft");
    expect((await p.getVideo(alice, video!.id))!.brief).toEqual({ a: 1 });
    expect(await p.getVideo(bob, video!.id)).toBeNull();

    const madeVideo = await p.updateVideo(alice, video!.id, { status: "made", seconds: 42.5, hook: "Your first idea is bad" });
    expect(madeVideo!.madeAt).not.toBeNull();
    const detail = await p.getProjectDetail(alice, proj.id);
    expect(detail!.ideas.find((i) => i.id === ideas[0].id)!.status).toBe("used");
    expect(detail!.videos).toHaveLength(1);
    expect((await p.listProjects(alice)).find((x) => x.id === proj.id)!.made).toBe(1);

    const posted = await p.updateVideo(alice, video!.id, { status: "posted", postedUrl: "https://www.instagram.com/reel/abc" });
    expect(posted!.postedAt).not.toBeNull();
    expect(await p.updateVideo(bob, video!.id, { status: "made" })).toBeNull();
  });

  it("deletes a project and its ideas, but keeps its videos", async () => {
    const proj = await p.createProject(alice, { name: "Short", goal: "", perWeek: 1, durationDays: 7, startDate: "2026-03-01", defaults });
    await p.addIdeas(alice, proj.id, [{ title: "One", concept: "An idea", angle: "" }]);
    const v = await p.createVideo(alice, { projectId: proj.id, ideaId: null, title: "Kept", concept: "", brief: null, plan: null });
    expect(await p.deleteProject(bob, proj.id)).toBe(false);
    expect(await p.deleteProject(alice, proj.id)).toBe(true);
    expect((await p.getVideo(alice, v!.id))!.projectId).toBeNull();
  });
});
