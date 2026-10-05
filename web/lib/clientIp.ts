import type { NextRequest } from "next/server";

/**
 * The edge proxy (Railway, or any single reverse proxy) sets X-Real-IP and appends the address it
 * saw to X-Forwarded-For. Earlier X-Forwarded-For entries come from the client and can be forged,
 * so never key a rate limit on them.
 */
export function clientIp(req: NextRequest) {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded?.at(-1) ?? "unknown";
}
