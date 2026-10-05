import { describe, expect, it } from "vitest";
import type { Segment } from "./edit";
import { composeEdit, DEFAULT_CTA, fallbackPlan, normalizePlan, timelineForDirector, type EditPlan } from "./editPlan";
import type { Take } from "./takes";

const take = (shot: number): Take => ({
  id: `t${shot}`, shot, url: "blob:x", blob: new Blob(), mime: "video/mp4", seconds: 8, peak: 0.5,
  clipped: 0, voiced: 0.6, transcript: null, source: "camera",
});
const seg = (shot: number, kind: Segment["kind"], from: number, to: number, speech: boolean): Segment => ({
  shot, take: take(shot), kind, from, to, gain: 1, speech,
  words: speech ? [{ word: "Bad", start: from + 0.1, end: from + 0.5 }, { word: "ideas.", start: from + 0.5, end: from + 1 }] : [],
});

// hook (3s), a-roll (8s), b-roll (3s), a-roll (6s)
const timeline = [seg(0, "hook", 0.5, 3.5, true), seg(2, "a-roll", 1, 9, true), seg(3, "b-roll", 0, 3, false), seg(5, "a-roll", 0.4, 6.4, true)];
const empty: EditPlan = { cutaways: [], callouts: [], emphasis: [], endCta: "", summary: "" };

describe("fallbackPlan", () => {
  it("lays B-roll over the end of the talking clip before it", () => {
    const plan = fallbackPlan(timeline, []);
    expect(plan.cutaways).toEqual([{ source: "shot:3", segment: 1, at: 8 - 3 - 0.2, seconds: 3, style: "full" }]);
    expect(plan.summary).toMatch(/B-roll over your voice/);
  });

  it("puts added pictures on the longest talking clips not already covered", () => {
    const plan = fallbackPlan(timeline, [{ id: "a", kind: "image", seconds: null }, { id: "b", kind: "video", seconds: 10 }]);
    const extras = plan.cutaways.filter((c) => c.source.startsWith("extra:"));
    expect(extras).toEqual([
      { source: "extra:a", segment: 3, at: 0.8, seconds: 2.5, style: "pip" },
      { source: "extra:b", segment: 0, at: 0.8, seconds: 2, style: "full" },
    ]);
  });
});

describe("normalizePlan", () => {
  const extras = [{ id: "pic", kind: "image" as const, seconds: null }, { id: "clip", kind: "video" as const, seconds: 1.5 }];

  it("clamps times, caps video length, and drops overlaps and unknown sources", () => {
    const plan = normalizePlan(
      {
        ...empty,
        cutaways: [
          { source: "extra:pic", segment: 1, at: 7.9, seconds: 9, style: "pip" }, // clamped to end
          { source: "extra:clip", segment: 1, at: 1, seconds: 5, style: "full" }, // capped to 1.5s
          { source: "extra:clip", segment: 1, at: 1.5, seconds: 1, style: "full" }, // overlaps → dropped
          { source: "extra:nope", segment: 1, at: 3, seconds: 1, style: "full" }, // unknown → dropped
          { source: "shot:3", segment: 2, at: 0, seconds: 2, style: "full" }, // onto a non-speech segment → dropped
          { source: "shot:0", segment: 3, at: 0, seconds: 2, style: "full" }, // a speaking shot as B-roll → dropped
          { source: "extra:pic", segment: 9, at: 0, seconds: 2, style: "pip" }, // no such segment → dropped
        ],
      },
      timeline,
      extras,
    );
    expect(plan.cutaways).toEqual([
      { source: "extra:clip", segment: 1, at: 1, seconds: 1.5, style: "full" },
      { source: "extra:pic", segment: 1, at: 7.2, seconds: 0.8, style: "pip" },
    ]);
  });

  it("keeps callouts readable and non-overlapping, at most two per clip", () => {
    const plan = normalizePlan(
      {
        ...empty,
        callouts: [
          { segment: 1, at: 0, seconds: 10, text: "4th idea", style: "stat" },
          { segment: 1, at: 1, seconds: 1, text: "overlap", style: "label" },
          { segment: 1, at: 5, seconds: 2, text: "Ship it", style: "label" },
          { segment: 1, at: 7.5, seconds: 1, text: "third", style: "label" },
          { segment: 0, at: 0, seconds: 1, text: "   ", style: "label" },
        ],
      },
      timeline,
      [],
    );
    expect(plan.callouts.map((c) => [c.text, c.at, c.seconds])).toEqual([["4th idea", 0, 4], ["Ship it", 5, 2]]);
  });

  it("keeps emphasis only on words that are in the captions, and defaults the CTA", () => {
    const plan = normalizePlan({ ...empty, emphasis: [{ segment: 1, word: "ideas" }, { segment: 1, word: "banana" }] }, timeline, []);
    expect(plan.emphasis).toEqual([{ segment: 1, word: "ideas" }]);
    expect(plan.endCta).toBe(DEFAULT_CTA);
  });
});

describe("composeEdit", () => {
  it("removes B-roll used as a cutaway from the sequence and attaches overlays, callouts and emphasis", () => {
    const plan = normalizePlan(
      {
        ...fallbackPlan(timeline, []),
        callouts: [{ segment: 3, at: 1, seconds: 2, text: "Idea #4", style: "stat" }],
        emphasis: [{ segment: 1, word: "ideas" }],
        endCta: "Join the next sprint",
      },
      timeline,
      [],
    );
    const { sequence, endCta } = composeEdit(timeline, plan);
    expect(sequence.map((s) => s.shot)).toEqual([0, 2, 5]);
    expect(sequence[1].overlays[0]).toMatchObject({ kind: "segment", at: 4.8, seconds: 3 });
    expect(sequence[1].emphasis).toEqual(new Set([1]));
    expect(sequence[2].callouts[0].text).toBe("Idea #4");
    expect(endCta).toBe("Join the next sprint");
  });
});

describe("timelineForDirector", () => {
  it("gives segment-relative word times", () => {
    const t = timelineForDirector(timeline, ["Walk in", "", "Setup", "Sketch", "", "Payoff"]);
    expect(t[1]).toMatchObject({ segment: 1, shot: 2, title: "Setup", seconds: 8, speech: true });
    expect(t[1].words[0]).toEqual({ word: "Bad", start: 0.1, end: 0.5 });
  });
});
