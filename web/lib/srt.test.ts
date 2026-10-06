import { describe, expect, it } from "vitest";
import type { Segment } from "./edit";
import type { ComposedEdit } from "./editPlan";
import { captionCues, srtTime, toSrt } from "./srt";
import type { Take } from "./takes";

const take = (shot: number): Take => ({
  id: `t${shot}`, shot, url: "blob:x", blob: new Blob(), mime: "video/mp4", seconds: 8, peak: 0.5,
  clipped: 0, voiced: 0.6, transcript: null, source: "camera",
});
const words = (list: [string, number, number][]) => list.map(([word, start, end]) => ({ word, start, end }));
const seg = (shot: number, from: number, to: number, w: Segment["words"]) => ({
  shot, take: take(shot), kind: "a-roll" as const, from, to, words: w, gain: 1, speech: w.length > 0, voiceLevel: 0.25,
  overlays: [], callouts: [], emphasis: new Set<number>(),
});

describe("srtTime", () => {
  it("formats hours, minutes, seconds and milliseconds", () => {
    expect(srtTime(0)).toBe("00:00:00,000");
    expect(srtTime(61.25)).toBe("00:01:01,250");
    expect(srtTime(3723.0004)).toBe("01:02:03,000");
  });
});

describe("captionCues", () => {
  const edit: ComposedEdit = {
    endCta: "",
    sequence: [
      // Starts 1 s into the take: word times move back by 1 s.
      seg(0, 1, 4, words([["Your", 1.1, 1.3], ["first", 1.3, 1.6], ["idea", 1.6, 1.9], ["is", 1.9, 2.0], ["bad.", 2.0, 2.4], ["Ship", 2.6, 2.9], ["it.", 2.9, 3.2]])),
      // A clip with no speech still moves the clock on.
      seg(1, 0, 2, []),
      seg(2, 0.5, 2.5, words([["Go", 0.6, 0.9], ["build", 0.9, 1.3], ["outside", 3, 3.5]])),
    ],
  };

  it("groups short phrases, breaks after punctuation and times them to the finished video", () => {
    const cues = captionCues(edit);
    expect(cues.map((c) => c.text)).toEqual(["Your first idea is", "bad.", "Ship it.", "Go build"]);
    expect(cues[0].start).toBeCloseTo(0.1);
    expect(cues[3].start).toBeCloseTo(3 + 2 + 0.1);
  });

  it("never lets a phrase run into the next one", () => {
    const cues = captionCues(edit);
    cues.slice(0, -1).forEach((c, i) => expect(c.end).toBeLessThanOrEqual(cues[i + 1].start));
  });

  it("writes numbered SRT blocks", () => {
    expect(toSrt(edit).split("\n").slice(0, 3)).toEqual(["1", "00:00:00,100 --> 00:00:01,000", "Your first idea is"]);
  });
});
