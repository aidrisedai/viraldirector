import { describe, expect, it } from "vitest";
import type { Segment } from "./edit";
import { applyTrims, composeEdit, normalizePlan, type EditPlan } from "./editPlan";
import type { Take } from "./takes";
import { addCallout, addCutaway, clipWindow, fromVideoTime, layout, moveCutaway, resetTrim, setTrim, toggleDrop, toVideoTime } from "./timeline";

const take = (shot: number): Take => ({
  id: `t${shot}`, shot, url: "blob:x", blob: new Blob(), mime: "video/mp4", seconds: 8, peak: 0.5,
  clipped: 0, voiced: 0.6, transcript: null, source: "camera",
});
const seg = (shot: number, kind: Segment["kind"], from: number, to: number, speech: boolean): Segment => ({
  shot, take: take(shot), kind, from, to, gain: 1, speech, voiceLevel: speech ? 0.25 : null, words: [],
});
// hook 3s, a-roll 8s, b-roll 3s, a-roll 6s
const timeline = [seg(0, "hook", 0.5, 3.5, true), seg(2, "a-roll", 1, 9, true), seg(3, "b-roll", 0, 3, false), seg(5, "a-roll", 0.4, 6.4, true)];
const empty: EditPlan = { drop: [], trims: [], captionFixes: [], cutaways: [], callouts: [], emphasis: [], endCta: "", summary: "" };

describe("layout", () => {
  it("lays kept clips end to end", () => {
    const lay = layout(timeline, empty);
    expect(lay.clips.map((c) => [c.segment, c.start, c.end])).toEqual([[0, 0, 3], [1, 3, 11], [2, 11, 14], [3, 14, 20]]);
    expect(lay.seconds).toBe(20);
  });

  it("closes the gap when B-roll becomes a cutaway or a clip is removed", () => {
    const withBroll = { ...empty, cutaways: [{ source: "shot:3", segment: 1, at: 2, seconds: 3, style: "full" as const }] };
    expect(layout(timeline, withBroll).seconds).toBe(17);
    expect(layout(timeline, toggleDrop(empty, 0)).clips[0].segment).toBe(1);
  });

  it("converts between video time and segment time", () => {
    const lay = layout(timeline, empty);
    expect(toVideoTime(lay, 1, 2.5)).toBe(5.5);
    expect(fromVideoTime(lay, 5.5)).toEqual({ segment: 1, at: 2.5 });
    // Near a clip's end, an item is pulled back so it fits.
    expect(fromVideoTime(lay, 10.8, 2)).toEqual({ segment: 1, at: 6 });
    // B-roll only goes over speech: dropping it over the B-roll clip lands on a speaking clip.
    expect(fromVideoTime(lay, 12, 1, true)!.segment).not.toBe(2);
  });
});

describe("hand edits", () => {
  it("drops a picture at a time and keeps it inside its clip", () => {
    const lay = layout(timeline, empty);
    const plan = addCutaway(empty, lay, "extra:a", 9.5, 4, "pip");
    expect(plan.cutaways).toEqual([{ source: "extra:a", segment: 1, at: 4, seconds: 4, style: "pip" }]);
  });

  it("moves an overlay to another clip", () => {
    const lay = layout(timeline, empty);
    const plan = moveCutaway(addCutaway(empty, lay, "extra:a", 1, 2, "full"), lay, 0, 15);
    expect(plan.cutaways[0]).toMatchObject({ segment: 3, at: 1, seconds: 2 });
  });

  it("adds text at the playhead", () => {
    const plan = addCallout(empty, layout(timeline, empty), "200 users", 4, "stat");
    expect(plan.callouts[0]).toMatchObject({ segment: 1, at: 1, text: "200 users", style: "stat" });
  });

  it("keeps overlapping hand edits that a generated plan would drop", () => {
    const lay = layout(timeline, empty);
    let plan = addCutaway(empty, lay, "extra:a", 4, 2, "pip");
    plan = addCutaway(plan, lay, "extra:b", 4.5, 2, "full");
    const extras = [{ id: "a", kind: "image" as const, seconds: null }, { id: "b", kind: "image" as const, seconds: null }];
    expect(normalizePlan(plan, timeline, extras).cutaways).toHaveLength(1);
    expect(normalizePlan(plan, timeline, extras, { strict: false }).cutaways).toHaveLength(2);
  });
});

describe("trimming clips", () => {
  const withWords = timeline.map((s, i) => (i === 1 ? { ...s, words: [{ word: "Bad", start: 1.5, end: 2 }, { word: "ideas", start: 7, end: 8 }] } : s));

  it("sets a clip's in and out points inside the recorded take", () => {
    const plan = setTrim(empty, withWords, 1, 2.5, 99);
    expect(plan.trims).toEqual([{ segment: 1, from: 2.5, to: 9 }]); // as far as the clip goes
    expect(clipWindow(plan, withWords, 1)).toEqual({ from: 2.5, to: 9 });
    expect(clipWindow(empty, withWords, 1)).toEqual({ from: 1, to: 9 });
    expect(setTrim(empty, withWords, 1, 5, 5.1).trims[0].to).toBeCloseTo(5.5, 6); // never shorter than half a second
  });

  it("changes the video's length and drops captions that were cut", () => {
    const plan = setTrim(empty, withWords, 1, 2.5, 8);
    expect(layout(withWords, plan).seconds).toBeCloseTo(20 - 8 + 5.5, 6);
    const seq = composeEdit(withWords, plan).sequence;
    expect(seq[1].words.map((w) => w.word)).toEqual(["ideas"]);
    expect(applyTrims(withWords, plan.trims)[1].from).toBe(2.5);
  });

  it("goes back to the automatic trim", () => {
    expect(resetTrim(setTrim(empty, withWords, 1, 2, 4), 1).trims).toEqual([]);
  });
});
