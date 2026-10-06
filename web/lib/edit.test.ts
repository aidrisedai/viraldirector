import { describe, expect, it } from "vitest";
import { buildTimeline, captionChunks, captionText, captionWords, detectSpeech, retimeWords, timeWords, timelineSeconds, wordsFromChunks, type SpeechAnalysis } from "./edit";
import { SAMPLE_PLAN } from "./plan";
import type { Take } from "./takes";

const SR = 8000;
/** Silence, then a tone "speaking" from `on` to `off` seconds. */
function clip(seconds: number, on: number, off: number, amp = 0.3) {
  const s = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    s[i] = t >= on && t < off ? amp * Math.sin(2 * Math.PI * 220 * t) : (Math.random() - 0.5) * 0.002;
  }
  return s;
}

const take = (shot: number, over: Partial<Take> = {}): Take => ({
  id: `t${shot}`, shot, url: "blob:x", blob: new Blob(), mime: "video/mp4", seconds: 8, peak: 0.5,
  clipped: 0, voiced: 0.6, transcript: null, source: "camera", ...over,
});

describe("detectSpeech", () => {
  it("finds where speech starts and ends", () => {
    const a = detectSpeech(clip(6, 1.2, 4.5), SR);
    expect(a.onset).toBeCloseTo(1.2, 1);
    expect(a.offset).toBeCloseTo(4.5, 1);
    expect(a.speechRms).toBeGreaterThan(0.15);
    expect(a.duration).toBeCloseTo(6, 2);
  });

  it("reports no speech for near-silence and ignores a lone click", () => {
    const s = clip(3, 0, 0);
    s[SR] = 0.9;
    expect(detectSpeech(s, SR).onset).toBeNull();
  });
});

describe("timeWords / captionChunks", () => {
  it("spreads words across the window in order, longer words taking longer", () => {
    const w = timeWords("Bad ideas teach you everything.", 1, 3);
    expect(w.map((x) => x.word)).toEqual(["Bad", "ideas", "teach", "you", "everything."]);
    expect(w[0].start).toBe(1);
    expect(w.at(-1)!.end).toBeCloseTo(3, 6);
    expect(w[4].end - w[4].start).toBeGreaterThan(w[0].end - w[0].start);
  });

  it("chunks captions in threes and breaks after punctuation", () => {
    const chunks = captionChunks(timeWords("So go build. The bad one, because it teaches", 0, 4));
    expect(chunks.map((c) => c.map((w) => w.word).join(" "))).toEqual(["So go build.", "The bad one,", "because it teaches"]);
  });
});

describe("buildTimeline", () => {
  const analyses = new Map<string, SpeechAnalysis>([
    ["t0", { onset: 0.8, offset: 3.4, speechRms: 0.04, duration: 4 }],
    ["t2", { onset: 0.5, offset: 8.1, speechRms: 0.16, duration: 9 }],
    ["t3", { onset: null, offset: null, speechRms: null, duration: 3.2 }],
  ]);
  const kept = [take(0, { seconds: 4 }), undefined, take(2, { seconds: 9, transcript: "bad ideas teach you" }), take(3, { seconds: 3.2 })];

  it("orders kept takes by script, skipping shots without a take", () => {
    expect(buildTimeline(SAMPLE_PLAN, kept, analyses).map((s) => s.shot)).toEqual([0, 2, 3]);
  });

  it("trims dead air around speech but keeps B-roll whole", () => {
    const [hook, , broll] = buildTimeline(SAMPLE_PLAN, kept, analyses);
    expect(hook.from).toBeCloseTo(0.6, 2);
    expect(hook.to).toBeCloseTo(3.9, 2);
    expect(broll.from).toBe(0);
    expect(broll.to).toBe(3.2);
    expect(broll.words).toEqual([]);
    expect(broll.speech).toBe(false);
  });

  it("captions what was said when a transcript exists, else the script line", () => {
    const [hook, value] = buildTimeline(SAMPLE_PLAN, kept, analyses);
    expect(value.words.map((w) => w.word).join(" ")).toBe("bad ideas teach you");
    expect(hook.words[0].word).toBe("Your");
    expect(hook.words[0].start).toBeCloseTo(0.8, 6);
  });

  it("caps the boost for very quiet clips", () => {
    const quiet = new Map(analyses);
    quiet.set("t0", { onset: 0.8, offset: 3.4, speechRms: 0.005, duration: 4 });
    expect(buildTimeline(SAMPLE_PLAN, kept, quiet)[0].gain).toBe(8);
  });

  it("evens out levels between quiet and loud clips", () => {
    const [hook, value, broll] = buildTimeline(SAMPLE_PLAN, kept, analyses);
    expect(hook.gain).toBeCloseTo(6.25, 6); // 0.25 / 0.04
    expect(value.gain).toBeCloseTo(1.5625, 6);
    expect(broll.gain).toBe(1);
  });

  it("totals the edited length", () => {
    expect(timelineSeconds(buildTimeline(SAMPLE_PLAN, kept, analyses))).toBeCloseTo(3.3 + 8.3 + 3.2, 1);
  });
});

describe("exact captions", () => {
  it("turns Whisper word chunks into timed words, filling a missing end", () => {
    const w = wordsFromChunks([
      { text: " Bad", timestamp: [0.5, 0.8] },
      { text: " ideas", timestamp: [0.8, 1.2] },
      { text: " ", timestamp: [1.2, 1.3] },
      { text: " ship.", timestamp: [1.3, null] },
    ]);
    expect(w).toEqual([
      { word: "Bad", start: 0.5, end: 0.8 },
      { word: "ideas", start: 0.8, end: 1.2 },
      { word: "ship.", start: 1.3, end: 1.7000000000000002 },
    ]);
  });

  it("keeps exact timings when an edit fixes a word, and spreads them when the count changes", () => {
    const exact = [
      { word: "bad", start: 1, end: 1.4 },
      { word: "ideas", start: 1.4, end: 2 },
      { word: "teach", start: 2, end: 2.6 },
    ];
    expect(retimeWords("Bad ideas taught", exact, null, null).map((w) => [w.word, w.start])).toEqual([
      ["Bad", 1], ["ideas", 1.4], ["taught", 2],
    ]);
    const spread = retimeWords("Bad ideas teach you", exact, null, null);
    expect(spread).toHaveLength(4);
    expect(spread[0].start).toBe(1);
    expect(spread.at(-1)!.end).toBeCloseTo(2.6, 6);
  });

  it("captions an edit over the clip's real word timings and trims to them", () => {
    const withWords = take(2, {
      seconds: 9,
      words: [
        { word: "bad", start: 1.0, end: 1.3 },
        { word: "ideas", start: 1.3, end: 1.8 },
      ],
    });
    const [seg] = buildTimeline(SAMPLE_PLAN, [undefined, undefined, withWords], new Map(), { t2: "Bad ideas" });
    expect(seg.words.map((w) => [w.word, w.start])).toEqual([["Bad", 1.0], ["ideas", 1.3]]);
    expect(seg.from).toBeCloseTo(0.8, 6);
    expect(seg.to).toBeCloseTo(2.3, 6);
  });

  it("uses the creator's caption edit over the transcript and script", () => {
    const t = take(2, { transcript: "bad idea teach you" });
    expect(captionText(t, SAMPLE_PLAN.shots[2], "Bad ideas teach you")).toBe("Bad ideas teach you");
    expect(captionText(t, SAMPLE_PLAN.shots[2])).toBe("bad idea teach you");
    expect(captionText(take(3), SAMPLE_PLAN.shots[3])).toBe("");
  });
});

describe("captionWords", () => {
  it("never leaves a dash or ellipsis as its own caption word", () => {
    expect(captionWords("users actually want — and you … ship “it”")).toEqual(["users", "actually", "want —", "and", "you …", "ship", "it"]);
    expect(captionWords("— leading dash")).toEqual(["leading", "dash"]);
  });
});
