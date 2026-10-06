// Which sign-in is active. Read at request time, so keys added in the host take effect on redeploy.
//   clerk — Clerk keys are set (production).
//   dev   — DEV_AUTH=1 outside production (or in automated tests): everyone is one local test user.
//   off   — no sign-in: single videos work, projects are unavailable.

export type AuthMode = "clerk" | "dev" | "off";

export const clerkPublishableKey = () => process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

export function authMode(): AuthMode {
  if (process.env.CLERK_SECRET_KEY && clerkPublishableKey()) return "clerk";
  if (process.env.DEV_AUTH === "1" && (process.env.NODE_ENV !== "production" || process.env.VD_E2E === "1")) return "dev";
  return "off";
}

/** Clerk's Frontend API host, encoded in the publishable key (pk_live_<base64("clerk.example.com$")>). */
export function clerkFrontendHost(pk = clerkPublishableKey()): string | null {
  const encoded = pk.split("_")[2];
  if (!encoded) return null;
  try {
    const host = atob(encoded).replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) ? host : null;
  } catch {
    return null;
  }
}

/** The Content-Security-Policy, widened just enough for Clerk when it's on. */
export function contentSecurityPolicy(isDev: boolean, clerkHost: string | null): string {
  const clerk = clerkHost ? ` https://${clerkHost} https://challenges.cloudflare.com` : "";
  return [
    "default-src 'self'",
    // Next's App Router injects inline bootstrap scripts; 'wasm-unsafe-eval' lets on-device speech recognition run.
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}${clerk}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${clerkHost ? " https://img.clerk.com" : ""}`,
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co${clerkHost ? ` https://${clerkHost}` : ""}${isDev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    `frame-src ${clerkHost ? "https://challenges.cloudflare.com" : "'none'"}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
