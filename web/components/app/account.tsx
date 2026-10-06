"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { createContext, useContext, type ReactNode } from "react";
import type { AuthMode } from "@/lib/authConfig";
import s from "./app.module.css";

type Account = { mode: AuthMode; ready: boolean; signedIn: boolean };
const AccountContext = createContext<Account>({ mode: "off", ready: true, signedIn: false });

/** Who's signed in, the same way whichever sign-in is active. */
export const useAccount = () => useContext(AccountContext);

function ClerkBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  return <AccountContext.Provider value={{ mode: "clerk", ready: isLoaded, signedIn: Boolean(isSignedIn) }}>{children}</AccountContext.Provider>;
}

export function AccountProvider({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  if (mode === "clerk") return <ClerkBridge>{children}</ClerkBridge>;
  return <AccountContext.Provider value={{ mode, ready: true, signedIn: mode === "dev" }}>{children}</AccountContext.Provider>;
}

/** Sign in, or the account menu once signed in. Nothing when sign-in isn't set up. */
export function AccountButton() {
  const { mode, ready, signedIn } = useAccount();
  if (mode === "off" || !ready) return null;
  if (mode === "dev") return <span className={s.devUser} title="Local test sign-in (DEV_AUTH)">Test user</span>;
  return signedIn ? (
    <UserButton />
  ) : (
    <SignInButton mode="modal">
      <button type="button" className={s.signIn}>Sign in</button>
    </SignInButton>
  );
}
