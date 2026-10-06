import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authMode, clerkFrontendHost, clerkPublishableKey, contentSecurityPolicy } from "@/lib/authConfig";

// Runs before every page and API request: Clerk's session handling (when sign-in is on) and the
// Content-Security-Policy, which needs the Clerk domain from the runtime keys.

const isDev = process.env.NODE_ENV !== "production";

const withCsp = (res: NextResponse, clerkHost: string | null) => {
  res.headers.set("Content-Security-Policy", contentSecurityPolicy(isDev, clerkHost));
  return res;
};

const clerk = clerkMiddleware(
  async () => withCsp(NextResponse.next(), clerkFrontendHost()),
  () => ({ publishableKey: clerkPublishableKey(), secretKey: process.env.CLERK_SECRET_KEY }),
);

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (authMode() !== "clerk") return withCsp(NextResponse.next(), null);
  return clerk(req, event);
}

export const config = {
  matcher: [
    // Pages and API routes; not Next internals or static files (including the speech model's .wasm/.mjs).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|wasm|mjs)).*)",
    "/(api|trpc)(.*)",
  ],
};
