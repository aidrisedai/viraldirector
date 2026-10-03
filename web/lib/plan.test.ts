import { describe, expect, it } from "vitest";
import { applyHook, beatRanges, BriefSchema, DEFAULT_BRIEF, PlanSchema, plannedSeconds, SAMPLE_PLAN } from "./plan";

describe("plan", () => {
  it("sample plan satisfies the schema the Director output is validated against", () => {
    expect(PlanSchema.safeParse(SAMPLE_PLAN).success).toBe(true);
  });

  it("rejects plans without exactly three hooks", () => {
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, hooks: SAMPLE_PLAN.hooks.slice(0, 2) }).success).toBe(false);
  });

  it("validates the brief", () => {
    expect(BriefSchema.safeParse({ ...DEFAULT_BRIEF, concept: "Why teens never start" }).success).toBe(true);
    expect(BriefSchema.safeParse({ ...DEFAULT_BRIEF, concept: "  " }).success).toBe(false);
    expect(BriefSchema.safeParse({ ...DEFAULT_BRIEF, concept: "x".repeat(281) }).success).toBe(false);
    expect(BriefSchema.safeParse({ ...DEFAULT_BRIEF, concept: "Valid idea", goal: "Shock" }).success).toBe(false);
  });

  it("computes beat ranges and planned length", () => {
    expect(plannedSeconds(SAMPLE_PLAN)).toBe(45);
    expect(beatRanges(SAMPLE_PLAN)).toEqual(["0–3s", "3–10s", "10–30s", "30–40s", "40–45s"]);
  });

  it("applies the chosen hook to the hook beat and hook shot without quotes", () => {
    const plan = applyHook(SAMPLE_PLAN, 2);
    expect(plan.beats[0].line).toBe("Most teens never start. Not for the reason you think.");
    expect(plan.shots.find((s) => s.type === "hook")?.line).toBe("Most teens never start. Not for the reason you think.");
    expect(plan.beats[1]).toEqual(SAMPLE_PLAN.beats[1]);
  });
});
