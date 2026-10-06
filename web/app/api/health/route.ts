import { NextResponse } from "next/server";
import { authMode } from "@/lib/authConfig";
import { dbConfigured } from "@/lib/db";
import { directorConfigured } from "@/lib/director";
import { transcriptionConfigured } from "@/lib/transcribeServer";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      director: directorConfigured() ? "connected" : "sample",
      transcription: transcriptionConfigured() ? "server" : "device",
      accounts: authMode() === "clerk" ? "clerk" : authMode() === "dev" ? "test" : "off",
      database: dbConfigured() ? "connected" : "none",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
