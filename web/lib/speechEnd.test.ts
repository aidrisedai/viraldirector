import { describe, expect, it } from "vitest";
import { createSpeechEnd } from "./speechEnd";

/** Runs a level track at 60 frames a second; returns when it stopped, or null. */
function run(planned: number, level: (t: number) => number, until = 30): number | null {
  const done = createSpeechEnd({ planned });
  for (let i = 0; i <= until * 60; i++) {
    const t = i / 60;
    if (done(t, level(t))) return t;
  }
  return null;
}
// Speech: a level that wobbles between syllables, with a short gap between words every 0.6 s.
const talk = (t: number) => (t % 0.6 < 0.08 ? 0.01 : 0.12 + 0.08 * Math.abs(Math.sin(t * 9)));

describe("createSpeechEnd", () => {
  it("never stops while the speaker is still talking past the planned length", () => {
    expect(run(3, talk, 20)).toBeNull();
  });

  it("stops shortly after they finish, not at the planned length", () => {
    const stop = run(3, (t) => (t < 5.2 ? talk(t) : 0.005));
    expect(stop).toBeGreaterThan(5.9);
    expect(stop).toBeLessThan(6.2);
  });

  it("doesn't stop early when they finish before the planned length", () => {
    expect(run(6, (t) => (t < 2 ? talk(t) : 0.004))).toBeCloseTo(6.5, 1);
  });

  it("treats a steady noisy room as quiet", () => {
    const stop = run(3, (t) => (t < 4 ? talk(t) : 0.035));
    expect(stop).toBeGreaterThan(4.7);
    expect(stop).toBeLessThan(5.1);
  });

  it("isn't fooled by noise alone when the speech came before recording", () => {
    // It takes a moment to learn the room's level, then stops soon after the planned length.
    const stop = run(3, () => 0.03)!;
    expect(stop).toBeGreaterThanOrEqual(3.5);
    expect(stop).toBeLessThan(4.6);
  });
});
