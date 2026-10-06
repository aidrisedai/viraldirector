"use client";

import { Director } from "@/components/director/Director";
import { useAccount } from "./account";
import { Dashboard } from "./Dashboard";

/** Signed in: the projects dashboard. Otherwise: straight into making a video. */
export function Home() {
  const { mode, ready, signedIn } = useAccount();
  if (mode !== "off" && !ready) return null;
  return signedIn ? <Dashboard /> : <Director />;
}
