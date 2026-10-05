import { describe, expect, it } from "vitest";
import { SAMPLE_PLAN } from "./plan";
import { exportChecks, reviewTake, scriptText, takeFileName, type Take } from "./takes";

const aroll = SAMPLE_PLAN.shots[2]; // 8s line
const broll = SAMPLE_PLAN.shots[3]; // 3s, no line

const take = (over: Partial<Take> = {}): Take => ({
  id: "t", shot: 2, url: "blob:x", blob: new Blob(), mime: "video/webm",
  seconds: 7.8, peak: 0.6, clipped: 0, voiced: 0.7, transcript: null, source: "camera", ...over,
});

describe("reviewTake", () => {
  it("accepts a clean take", () => {
    const r = reviewTake(take(), aroll);
    expect(r.verdict).toBe("accept");
    expect(r.checks.map((c) => c.label)).toEqual(["Duration", "Audio", "Line delivered"]);
  });

  it("asks for a retake when audio clips for a sustained stretch", () => {
    const r = reviewTake(take({ peak: 1, clipped: 0.1 }), aroll);
    expect(r.verdict).toBe("retake");
    expect(r.note).toMatch(/clipping/);
  });

  it("ignores a brief peak at full scale", () => {
    expect(reviewTake(take({ peak: 1, clipped: 0.005 }), aroll).verdict).toBe("accept");
  });

  it("flags a rushed take", () => {
    const r = reviewTake(take({ seconds: 5 }), aroll);
    expect(r.verdict).toBe("retake");
    expect(r.note).toMatch(/ran short/);
  });

  it("flags a take where the line wasn't heard", () => {
    expect(reviewTake(take({ voiced: 0.05 }), aroll).note).toMatch(/didn’t hear/);
  });

  it("doesn't expect speech on shots without a line", () => {
    const r = reviewTake(take({ shot: 3, seconds: 2.4, voiced: 0 }), broll);
    expect(r.verdict).toBe("accept");
    expect(r.checks.find((c) => c.label === "Line delivered")).toBeUndefined();
  });

  it("skips audio checks for uploads", () => {
    const r = reviewTake(take({ peak: null, clipped: null, voiced: null, source: "upload" }), aroll);
    expect(r.checks.map((c) => c.label)).toEqual(["Duration"]);
    expect(r.verdict).toBe("accept");
  });
});

describe("exportChecks", () => {
  const brief = { length: "45s" as const };

  it("reports missing required shots", () => {
    const checks = exportChecks(SAMPLE_PLAN, brief, []);
    expect(checks.find((c) => !c.ok)?.label).toBe("6 required shots missing");
  });

  it("passes when every required shot is kept and nothing clips", () => {
    const kept = SAMPLE_PLAN.shots.map((s, i) => (s.required ? take({ shot: i }) : undefined));
    expect(exportChecks(SAMPLE_PLAN, brief, kept).every((c) => c.ok)).toBe(true);
  });

  it("fails when a kept take clips", () => {
    const kept = SAMPLE_PLAN.shots.map((s, i) => take({ shot: i, peak: i === 0 ? 1 : 0.5, clipped: i === 0 ? 0.2 : 0 }));
    expect(exportChecks(SAMPLE_PLAN, brief, kept).find((c) => c.label === "No audio clipping")?.ok).toBe(false);
  });
});

describe("files", () => {
  it("names takes by shot number and title", () => {
    expect(takeFileName(take({ mime: "video/mp4" }), aroll)).toBe("03-value-beat-1.mp4");
  });

  it("writes a readable script", () => {
    const text = scriptText("Why most teens never start a business", SAMPLE_PLAN, 0);
    expect(text).toContain("0–3s  HOOK:");
    expect(text).toContain("5. Raise an eyebrow (reaction, 1s, optional)");
  });
});
