import { describe, expect, it } from "vitest";
import type { Segment } from "./edit";
import { CINEMATIC_STYLE, composeEdit, type EditPlan } from "./editPlan";
import { editBrief } from "./editBrief";
import type { Take } from "./takes";

const take = (shot: number): Take => ({
  id: `t${shot}`, shot, url: "blob:x", blob: new Blob(), mime: "video/mp4", seconds: 8, peak: 0.5,
  clipped: 0, voiced: 0.6, transcript: null, source: "camera",
});
const seg = (shot: number, kind: Segment["kind"], from: number, to: number, words: [string, number, number][]): Segment => ({
  shot, take: take(shot), kind, from, to, gain: 1, speech: words.length > 0, voiceLevel: 0.25,
  words: words.map(([word, start, end]) => ({ word, start, end })),
});
const timeline = [
  seg(0, "hook", 0.5, 3.5, [["Your", 0.6, 0.9], ["first", 0.9, 1.2], ["idea", 1.2, 1.6], ["is", 1.6, 1.8], ["bad.", 1.8, 2.4]]),
  seg(1, "b-roll", 0, 3, []),
  seg(2, "a-roll", 1, 5, [["Build", 1.2, 1.6], ["the", 1.6, 1.8], ["bad", 1.8, 2.1], ["one.", 2.1, 2.6]]),
];
const plan: EditPlan = {
  drop: [], trims: [], captionFixes: [], emphasis: [{ segment: 2, word: "bad" }], endCta: "Follow for part 2", summary: "Check: none.",
  cutaways: [{ source: "shot:1", segment: 0, at: 1, seconds: 1.5, style: "full" }],
  callouts: [
    { segment: 0, at: 0.4, seconds: 1.2, text: "Bad", style: "headline", highlight: "Bad" },
    { segment: 2, at: 1.5, seconds: 2.5, text: "Build the bad one", style: "title", support: "Follow for part 2" },
  ],
  payoff: 2,
};

describe("editBrief", () => {
  const text = editBrief({
    concept: "Why most teens never start", platform: "Reels / TikTok", audience: "Teens 13–18", version: "Cinematic",
    style: CINEMATIC_STYLE, format: "9:16", edit: composeEdit(timeline, plan),
    takeFiles: { t0: "01-hook.mp4", t1: "02-hands.mp4", t2: "03-build.mp4" },
    shotTitles: ["Hook", "Hands sketching (AI-made illustration)", "Payoff"], extras: {},
    music: "No music", brand: true, altHooks: ["“Most teens never start.”"], summary: "Check: none.",
  });

  it("states the output and the ground rules", () => {
    expect(text).toMatch(/^# Edit brief: Why most teens never start \(Cinematic version\)/);
    expect(text).toContain("1080 × 1920");
    expect(text).toMatch(/Don't invent footage, dialogue, reactions/);
  });

  it("lists files with honest labels and lays out the timeline with in and out points", () => {
    expect(text).toContain("- 02-hands.mp4 — shot 2: Hands sketching (AI-made illustration)");
    expect(text).toContain("1. 0:00.0–0:03.0  01-hook.mp4, 0.50s–3.50s of the file");
    expect(text).toContain('   Says: "Your first idea is bad."');
    expect(text).toContain("   - 0:00.4–0:01.6  big word \"Bad\" in the upper frame (\"Bad\" in emerald)");
    expect(text).toContain("   - 0:01.0–0:02.5  full-screen cutaway: 02-hands.mp4 from 0.00s (my voice continues)");
    expect(text).toMatch(/2\. 0:03\.0–0:07\.0 {2}03-build\.mp4, 1\.00s–5\.00s of the file — human payoff starts here/);
    expect(text).toContain('closing title "Build the bad one", call to action "Follow for part 2", small EdAI logo');
    expect(text).toContain('Emphasise: "bad"');
  });

  it("includes the look, other hooks and the captions", () => {
    expect(text).toContain("small official EdAI logo with the closing title; no end card");
    expect(text).toContain("- “Most teens never start.”");
    expect(text).toContain("00:00:00,100 --> ");
  });
});
