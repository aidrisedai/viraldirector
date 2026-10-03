import { NextResponse } from "next/server";
import { directorConfigured } from "@/lib/director";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true, director: directorConfigured() ? "connected" : "sample" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
