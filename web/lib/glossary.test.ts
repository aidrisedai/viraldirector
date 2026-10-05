import { describe, expect, it } from "vitest";
import { definitionQuestion, GLOSSARY, lookup, termsIn } from "./glossary";
import { SAMPLE_PLAN, SHOT_TYPE_LABEL } from "./plan";

describe("glossary", () => {
  it("finds terms however they're written", () => {
    expect(lookup("A-roll")?.term).toBe("A-roll");
    expect(lookup("a roll")?.term).toBe("A-roll");
    expect(lookup("B-Roll")?.term).toBe("B-roll");
    expect(lookup("chest up")?.term).toBe("Chest-up");
    expect(lookup("Beats")?.term).toBe("Beat");
    expect(lookup("talking head")?.term).toBe("A-roll");
    expect(lookup("banana")).toBeUndefined();
  });

  it("defines every shot type and size the sample plan uses", () => {
    for (const shot of SAMPLE_PLAN.shots) {
      expect(lookup(SHOT_TYPE_LABEL[shot.type]), SHOT_TYPE_LABEL[shot.type]).toBeDefined();
    }
    expect(lookup("close-up")).toBeDefined();
    expect(lookup("new angle")).toBeDefined();
  });

  it("finds terms inside a sentence, longest match included", () => {
    const found = termsIn("Hook shot · chest-up · Energy 5/5").map((e) => e.term);
    expect(found).toEqual(expect.arrayContaining(["Hook shot", "Chest-up", "Energy"]));
  });

  it("recognises plain definition questions", () => {
    expect(definitionQuestion("What is B-roll?")?.term).toBe("B-roll");
    expect(definitionQuestion("what does chest-up mean")?.term).toBe("Chest-up");
    expect(definitionQuestion("What does “A-roll” mean?")?.term).toBe("A-roll");
    expect(definitionQuestion("define the eye line")?.term).toBe("Eye line");
    expect(definitionQuestion("What is the best way to light this shot?")).toBeUndefined();
    expect(definitionQuestion("Can you explain \"Hook\" for this shot?")).toBeUndefined();
  });

  it("has no duplicate terms or aliases", () => {
    const keys = GLOSSARY.flatMap((e) => [e.term, ...(e.aliases ?? [])].map((k) => k.toLowerCase().replace(/[^a-z0-9:]+/g, " ").trim()));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
