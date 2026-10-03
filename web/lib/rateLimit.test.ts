import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then reports when to retry", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(check("a", 0).ok).toBe(true);
    expect(check("a", 1_000).ok).toBe(true);
    expect(check("a", 2_000)).toEqual({ ok: false, retryAfter: 58 });
    expect(check("b", 2_000).ok).toBe(true);
    expect(check("a", 60_000).ok).toBe(true);
  });
});
