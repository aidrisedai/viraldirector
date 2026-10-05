import { describe, expect, it } from "vitest";
import type { ChatRequest } from "./chat";
import { cleanHistory, contextBlock } from "./directorChat";
import { DEFAULT_BRIEF, SAMPLE_PLAN } from "./plan";

const base: ChatRequest = {
  mode: "ask",
  message: "How do I light this?",
  history: [],
  context: {
    brief: { ...DEFAULT_BRIEF, concept: "Why most teens never start a business" },
    plan: SAMPLE_PLAN,
    hook: 0,
    step: "Shots",
    shot: 2,
    originalLine: null,
  },
  take: null,
};

describe("contextBlock", () => {
  it("describes the video and the current shot", () => {
    const c = contextBlock(base);
    expect(c).toContain("mode: ask");
    expect(c).toContain("concept: Why most teens never start a business");
    expect(c).toContain("current shot: 3. Value beat 1");
    expect(c).toContain("lighting: Window light in front of you, not behind.");
    expect(c).toContain("0–3s Hook:");
  });

  it("includes the original line only when the creator changed it", () => {
    const plan = { ...SAMPLE_PLAN, shots: SAMPLE_PLAN.shots.map((s, i) => (i === 2 ? { ...s, line: "Ship the bad idea." } : s)) };
    const edited = contextBlock({ ...base, mode: "line", context: { ...base.context, plan, originalLine: SAMPLE_PLAN.shots[2].line } });
    expect(edited).toContain("line: Ship the bad idea.");
    expect(edited).toContain(`original line before the creator's edit: ${SAMPLE_PLAN.shots[2].line}`);
    const same = contextBlock({ ...base, mode: "line", context: { ...base.context, originalLine: SAMPLE_PLAN.shots[2].line } });
    expect(same).not.toContain("original line");
  });

  it("reports take measurements", () => {
    const c = contextBlock({
      ...base,
      mode: "take",
      take: { takeNumber: 2, source: "camera", seconds: 7.6, peak: 0.71, clipped: 0, voiced: 0.55, transcript: "bad ideas teach you", frames: ["AAAA"] },
    });
    expect(c).toContain("take 2 (recorded in the app)");
    expect(c).toContain("duration: 7.6s");
    expect(c).toContain("peak level: 71%");
    expect(c).toContain("transcript: bad ideas teach you");
    expect(c).toContain("frames attached: 1");
  });
});

describe("cleanHistory", () => {
  it("keeps only question → answer pairs, never pairing an answer with the wrong question", () => {
    const h = cleanHistory([
      { role: "assistant", text: "stray" },
      { role: "user", text: "q1 unanswered" },
      { role: "user", text: "q2" },
      { role: "assistant", text: "a2" },
      { role: "user", text: "q3" },
      { role: "assistant", text: "a3" },
      { role: "user", text: "q4 unanswered" },
    ]);
    expect(h).toEqual([
      { role: "user", content: "q2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "q3" },
      { role: "assistant", content: "a3" },
    ]);
  });
});
