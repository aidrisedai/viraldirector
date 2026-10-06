import "server-only";
import { NextResponse } from "next/server";
import { authMode } from "./authConfig";
import { dbConfigured } from "./db";

export const DEV_USER = "dev-user";

/** The signed-in user's id, or null. */
export async function currentUserId(): Promise<string | null> {
  const mode = authMode();
  if (mode === "dev") return DEV_USER;
  if (mode !== "clerk") return null;
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId;
}

/** For project routes: the user id, or the response explaining why not. */
export async function requireUser(): Promise<{ userId: string } | { response: NextResponse }> {
  const json = (error: string, status: number) => ({ response: NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } }) });
  if (authMode() === "off") return json("Sign-in isn’t set up on this server yet.", 503);
  if (!dbConfigured()) return json("Projects need a database (DATABASE_URL) on this server.", 503);
  const userId = await currentUserId();
  return userId ? { userId } : json("Sign in to use projects.", 401);
}
