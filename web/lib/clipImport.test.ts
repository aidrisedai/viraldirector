import { describe, expect, it } from "vitest";
import { lineMatch, matchLocally, planLocally, type ClipInfo } from "./clipImport";
import { SAMPLE_PLAN } from "./plan";

const clip = (id: string, over: Partial<ClipInfo> = {}): ClipInfo => ({ id, name: `${id}.mp4`, seconds: 4.4, speech: false, transcript: null, frames: [], ...over });

describe("lineMatch", () => {
  it("scores how much of the line was said", () => {
    expect(lineMatch("most teens wait for the perfect idea so they never start", "Most teens wait for the perfect idea. So they never start.")).toBe(1);
    expect(lineMatch("hello there", "Bad ideas teach you what users want")).toBe(0);
  });
});

describe("matchLocally", () => {
  it("files speaking clips by what they say, silent clips under silent shots, and skips filled shots", () => {
    const clips = [
      clip("a", { speech: true, transcript: "Bad ideas teach you what real users actually want and you find out by shipping" }),
      clip("b", { speech: true, transcript: "Most teens wait for the perfect idea so they never start" }),
      clip("c"),
      clip("d"),
      clip("e"),
      clip("f"),
    ];
    const assign = matchLocally(SAMPLE_PLAN, clips, [0]);
    expect(assign.a).toBe(2); // value beat line
    expect(assign.b).toBe(1); // setup line
    // Silent shots in order: 3 (B-roll), 4 (reaction), 6 (insert); one clip left over.
    expect([assign.c, assign.d, assign.e]).toEqual([3, 4, 6]);
    expect(assign.f).toBeUndefined();
  });
});

describe("planLocally", () => {
  it("builds one shot per clip, opening on the first thing said", () => {
    const { plan, assign } = planLocally({ concept: "Our first hackathon" }, [
      clip("x"),
      clip("y", { speech: true, transcript: "We built an app in one day. It almost worked." }),
      clip("z", { seconds: 2.2 }),
    ]);
    expect(plan.shots.map((s) => s.type)).toEqual(["b-roll", "hook", "b-roll"]);
    expect(plan.shots[1].line).toBe("We built an app in one day. It almost worked.");
    expect(assign).toEqual({ x: 0, y: 1, z: 2 });
    expect(plan.hooks[0]).toMatchObject({ kind: "From your clips", line: "“We built an app in one day.”" });
    expect(plan.hooks).toHaveLength(3);
  });

  it("asks for a hook to record when no clip has speech, and pads very short sets", () => {
    const { plan, assign } = planLocally({ concept: "Demo day" }, [clip("only")]);
    expect(plan.shots.map((s) => `${s.type}:${s.required}`)).toEqual(["hook:true", "b-roll:true", "a-roll:false"]);
    expect(plan.shots[0].line).toBe("Demo day");
    expect(assign).toEqual({ only: 1 });
    expect(plan.shots.filter((s) => s.type === "hook")).toHaveLength(1);
  });

  it("never makes two hook shots", () => {
    const { plan } = planLocally({ concept: "x" }, [clip("a", { speech: true, transcript: "One." }), clip("b", { speech: true, transcript: "Two." })]);
    expect(plan.shots.filter((s) => s.type === "hook")).toHaveLength(1);
    expect(plan.shots).toHaveLength(3);
  });
});
