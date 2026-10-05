import { NextResponse } from "next/server";
import { directorConfigured } from "@/lib/director";
import { transcriptionConfigured } from "@/lib/transcribeServer";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      director: directorConfigured() ? "connected" : "sample",
      transcription: transcriptionConfigured() ? "server" : "device",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
