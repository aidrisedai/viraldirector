import { describe, expect, it } from "vitest";
import { ART, ART_IDS, isArt } from "./art";

describe("illustrations", () => {
  it("are well-formed path data inside the 100 × 100 box", () => {
    for (const id of ART_IDS) {
      const { body, lines } = ART[id];
      expect(body.length + lines.length, id).toBeGreaterThan(0);
      for (const d of [...body, ...lines]) {
        expect(d, id).toMatch(/^M[-\d.]/);
        expect(d, id).not.toMatch(/NaN|undefined/);
        const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
        expect(Math.max(...nums), id).toBeLessThanOrEqual(100);
      }
    }
  });

  it("knows its own ids", () => {
    expect(isArt("money-bag")).toBe(true);
    expect(isArt("toString")).toBe(false);
  });
});
