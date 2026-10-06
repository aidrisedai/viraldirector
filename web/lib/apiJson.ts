import { NextResponse } from "next/server";

export const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** Parses a JSON body, or null if it isn't JSON. Bodies are capped so nobody can send megabytes of junk. */
export async function readJson(req: Request, maxBytes = 200_000): Promise<unknown> {
  const raw = await req.text();
  if (raw.length > maxBytes) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
