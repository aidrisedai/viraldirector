// Fixed-window limiter kept in process memory. It protects a single server instance;
// on multi-instance or serverless hosting, put a shared limiter (e.g. Redis) or the
// host's firewall rules in front of /api/plan as well.

type Window = { start: number; count: number };

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const windows = new Map<string, Window>();

  return function check(key: string, now = Date.now()): { ok: boolean; retryAfter: number } {
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k);
    }
    const w = windows.get(key);
    if (!w || now - w.start >= windowMs) {
      windows.set(key, { start: now, count: 1 });
      return { ok: true, retryAfter: 0 };
    }
    if (w.count >= limit) return { ok: false, retryAfter: Math.ceil((w.start + windowMs - now) / 1000) };
    w.count++;
    return { ok: true, retryAfter: 0 };
  };
}
