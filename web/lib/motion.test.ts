import { describe, expect, it } from "vitest";
import { dbToGain, loudLevel, musicGains, UNDER_SPEECH_DB, IN_GAPS_DB } from "./audioMix";
import { DEFAULT_STYLE, type EditPlan } from "./editPlan";
import { countUp, spring } from "./motion";
import { reviseLocally } from "./revise";

describe("motion", () => {
  it("springs from 0, overshoots, and settles at 1", () => {
    expect(spring(0)).toBe(0);
    const samples = Array.from({ length: 60 }, (_, i) => spring(i / 60));
    expect(Math.max(...samples)).toBeGreaterThan(1);
    expect(spring(3)).toBeCloseTo(1, 3);
  });

  it("counts numbers up and keeps their format", () => {
    expect(countUp("200 users", 1)).toBe("200 users");
    expect(countUp("200 users", 0)).toBe("0 users");
    expect(countUp("$1,250 raised", 1)).toBe("$1,250 raised");
    expect(countUp("2.5x faster", 1)).toBe("2.5x faster");
    expect(countUp("The point", 0.3)).toBe("The point");
  });
});

describe("music mix", () => {
  const SR = 8000;
  const tone = (amp: number) => Float32Array.from({ length: SR * 2 }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / SR));

  it("measures a track's loud level", () => {
    expect(loudLevel(tone(0.5), SR)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it("keeps any track well under the voice, however loud it was mastered", () => {
    const voice = 0.25;
    for (const amp of [0.05, 0.3, 0.95]) {
      const level = loudLevel(tone(amp), SR);
      const g = musicGains(level, voice, 1);
      // Music after gain vs voice, in dB.
      const under = 20 * Math.log10((level * g.underSpeech) / voice);
      const gaps = 20 * Math.log10((level * g.gaps) / voice);
      expect(under).toBeLessThanOrEqual(UNDER_SPEECH_DB + 0.01);
      expect(gaps).toBeLessThanOrEqual(IN_GAPS_DB + 0.01);
      expect(gaps).toBeLessThan(0);
    }
  });

  it("scales with the volume slider and is silent at zero", () => {
    const full = musicGains(0.3, 0.25, 1);
    const half = musicGains(0.3, 0.25, 0.5);
    expect(half.underSpeech).toBeCloseTo(full.underSpeech / 2, 6);
    expect(musicGains(0.3, 0.25, 0)).toEqual({ underSpeech: 0, gaps: 0 });
    expect(dbToGain(-20)).toBeCloseTo(0.1, 6);
  });
});

describe("reviseLocally", () => {
  const plan: EditPlan = {
    drop: [], captionFixes: [], cutaways: [], emphasis: [], endCta: "", summary: "",
    callouts: [
      { segment: 0, at: 1, seconds: 2, text: "4th idea", style: "stat" },
      { segment: 1, at: 1, seconds: 2, text: "The point", style: "label" },
    ],
  };

  it("handles common requests about the look and the music", () => {
    const r = reviseLocally("Bigger captions please, the music is distracting, and use whip transitions", DEFAULT_STYLE, plan);
    expect(r.style.captionSize).toBe("L");
    expect(r.style.musicVolume).toBeLessThan(DEFAULT_STYLE.musicVolume);
    expect(r.style.transition).toBe("Whip");
    expect(r.changes).toHaveLength(3);
  });

  it("moves captions off the face, switches style, and trims callouts", () => {
    const r = reviseLocally("The captions cover my face. Try karaoke, and fewer callouts", DEFAULT_STYLE, plan);
    expect(r.style.captionPosition).toBe("Lower");
    expect(r.style.captions).toBe("Karaoke");
    expect(r.plan.callouts).toHaveLength(1);
  });

  it("reports nothing when it can't act", () => {
    expect(reviseLocally("Swap the second shot for the beach clip", DEFAULT_STYLE, plan).changes).toEqual([]);
  });
});
