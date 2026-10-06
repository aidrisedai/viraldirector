import { describe, expect, it } from "vitest";
import { aiEligibility, videoPrompt } from "./aiPrompts";
import { SAMPLE_PLAN, type Shot } from "./plan";

const shot = (over: Partial<Shot>): Shot => ({ ...SAMPLE_PLAN.shots[3], ...over });

describe("aiEligibility", () => {
  it("allows illustrative B-roll and inserts", () => {
    expect(aiEligibility(shot({ title: "Sunrise over a city skyline", type: "b-roll" })).ok).toBe(true);
    expect(aiEligibility(shot({ title: "A lightbulb flickering on", type: "insert" })).ok).toBe(true);
  });

  it("never makes the creator, real people, reactions or results", () => {
    expect(aiEligibility(shot({ type: "a-roll" })).ok).toBe(false);
    expect(aiEligibility(shot({ type: "reaction" })).ok).toBe(false);
    expect(aiEligibility(shot({ type: "screen" })).ok).toBe(false);
    for (const title of ["Students testing the app", "A friend's reaction", "Phone showing a first sale", "Our follower count"]) {
      expect(aiEligibility(shot({ title, type: "b-roll" })).ok, title).toBe(false);
    }
  });
});

describe("videoPrompt", () => {
  it("describes the shot in the chosen look and rules out faces, text and fake results", () => {
    const p = videoPrompt(shot({ title: "Sunrise over a city skyline", seconds: 3 }), { concept: "Why teens should build", audience: "Teens 13–18", look: "Cinematic" });
    expect(p).toMatch(/^Vertical 9:16 video, 3 seconds/);
    expect(p).toContain("Subject: Sunrise over a city skyline.");
    expect(p).toMatch(/dark cinematic grade/);
    expect(p).toMatch(/no recognisable people/);
    expect(p).toMatch(/No text, captions, logos/);
    expect(p).toMatch(/testimonial or result/);
  });
});
