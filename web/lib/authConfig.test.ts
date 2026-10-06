import { afterEach, describe, expect, it, vi } from "vitest";
import { authMode, clerkFrontendHost, contentSecurityPolicy } from "./authConfig";

describe("sign-in configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses Clerk only when both keys are set", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    vi.stubEnv("CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("DEV_AUTH", "");
    expect(authMode()).toBe("off");
    vi.stubEnv("CLERK_PUBLISHABLE_KEY", "pk_test_x");
    expect(authMode()).toBe("clerk");
  });

  it("never allows the local test sign-in in production", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.stubEnv("DEV_AUTH", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VD_E2E", "");
    expect(authMode()).toBe("off");
    vi.stubEnv("NODE_ENV", "development");
    expect(authMode()).toBe("dev");
  });

  it("reads Clerk's domain from the publishable key and allows only it in the CSP", () => {
    const pk = `pk_live_${btoa("clerk.viraldirector.app$")}`;
    expect(clerkFrontendHost(pk)).toBe("clerk.viraldirector.app");
    expect(clerkFrontendHost("pk_live_!!!")).toBeNull();
    const csp = contentSecurityPolicy(false, "clerk.viraldirector.app");
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://clerk.viraldirector.app https://challenges.cloudflare.com");
    expect(csp).toContain("connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co https://clerk.viraldirector.app");
    expect(contentSecurityPolicy(false, null)).toContain("frame-src 'none'");
    expect(contentSecurityPolicy(false, null)).not.toContain("clerk");
  });
});
