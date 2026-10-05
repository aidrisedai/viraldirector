import { describe, expect, it } from "vitest";
import { briefText } from "./director";
import { BriefSchema, DEFAULT_BRIEF } from "./plan";
import { spokenSeconds, spokenWords, type WriterRequest } from "./story";
import { writerPrompt } from "./writer";

const { goal, length, platform, audience, format } = DEFAULT_BRIEF;
const base: WriterRequest = {
  action: "questions",
  writer: "journalist",
  scenario: "Our team of four teens shipped a homework app at the EdAI summit and 200 students signed up.",
  settings: { goal, length, platform, audience, format },
  answers: [],
  draft: null,
  note: "",
};

describe("spoken length", () => {
  it("counts spoken words only, not [visual notes]", () => {
    const script = "[close-up of the signup counter]\nTwo hundred students signed up — in a week.\n[team high-five]";
    expect(spokenWords(script)).toBe(8);
    expect(spokenSeconds("word ".repeat(117))).toBe(45);
  });
});

describe("brief with a story", () => {
  it("defaults the story for briefs saved before story mode existed", () => {
    const old: Record<string, unknown> = { ...DEFAULT_BRIEF, concept: "Why teens never start" };
    delete old.story;
    const parsed = BriefSchema.parse(old);
    expect(parsed.story).toBe("");
  });

  it("gives the Director the story only when there is one", () => {
    expect(briefText({ ...DEFAULT_BRIEF, concept: "An idea" })).not.toContain("<story>");
    expect(briefText({ ...DEFAULT_BRIEF, concept: "An idea", story: "We shipped it." })).toContain("<story>\nWe shipped it.\n</story>");
  });
});

describe("writerPrompt", () => {
  it("asks for questions without asking for a draft", () => {
    const p = writerPrompt(base);
    expect(p).toContain("45 seconds");
    expect(p).toContain("<scenario>\nOur team of four");
    expect(p).toMatch(/at most 3 short, friendly questions/);
    expect(p).not.toContain("Return: title");
  });

  it("includes only answered questions in a draft", () => {
    const p = writerPrompt({
      ...base,
      action: "draft",
      answers: [
        { question: "What was the hardest moment?", answer: "The server crashed the night before." },
        { question: "Who used it first?", answer: "" },
      ],
    });
    expect(p).toContain("Q: What was the hardest moment?\nA: The server crashed");
    expect(p).not.toContain("Who used it first?");
    expect(p).toContain("Write the story.");
  });

  it("revises the creator's edited draft with their note", () => {
    const p = writerPrompt({
      ...base,
      action: "revise",
      draft: { title: "200 in a week", logline: "Four teens shipped an app.", script: "We built it in two days.", note: "" },
      note: "Make the ending punchier",
    });
    expect(p).toContain("<draft>\nTitle: 200 in a week");
    expect(p).toContain("<change>\nMake the ending punchier\n</change>");
    expect(p).toMatch(/keep their edits/);
  });
});
