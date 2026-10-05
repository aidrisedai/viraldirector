import { describe, expect, it } from "vitest";
import { alignWords, encodeWav } from "./transcript";

describe("alignWords", () => {
  it("keeps the transcript's punctuation with the recognised timings", () => {
    const timed = [
      { word: "Bad", start: 0.2, end: 0.4 },
      { word: "ideas", start: 0.4, end: 0.8 },
      { word: "teach", start: 0.9, end: 1.2 },
      { word: "you", start: 1.2, end: 1.3 },
    ];
    expect(alignWords("Bad ideas, teach you.", timed)).toEqual([
      { word: "Bad", start: 0.2, end: 0.4 },
      { word: "ideas,", start: 0.4, end: 0.8 },
      { word: "teach", start: 0.9, end: 1.2 },
      { word: "you.", start: 1.2, end: 1.3 },
    ]);
  });

  it("fills words recognition missed from their neighbours", () => {
    const timed = [
      { word: "ship", start: 1, end: 1.3 },
      { word: "today", start: 2, end: 2.4 },
    ];
    const out = alignWords("Ship it today.", timed);
    expect(out.map((w) => w.word)).toEqual(["Ship", "it", "today."]);
    expect(out[1].start).toBeCloseTo(1.3, 6);
    expect(out[1].end).toBeLessThanOrEqual(2 + 1e-9);
  });

  it("returns nothing without timings", () => {
    expect(alignWords("Hello", [])).toEqual([]);
  });
});

describe("encodeWav", () => {
  it("writes a 16-bit mono WAV header and samples", () => {
    const buf = encodeWav(Float32Array.from([0, 1, -1]), 16000);
    const v = new DataView(buf);
    expect(String.fromCharCode(...new Uint8Array(buf, 0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...new Uint8Array(buf, 8, 4))).toBe("WAVE");
    expect(v.getUint32(24, true)).toBe(16000);
    expect(buf.byteLength).toBe(44 + 6);
    expect(v.getInt16(46, true)).toBe(0x7fff);
    expect(v.getInt16(48, true)).toBe(-0x8000);
  });
});
