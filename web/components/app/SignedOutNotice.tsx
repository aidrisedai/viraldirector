"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AccountButton, useAccount } from "./account";
import { TopBar } from "./TopBar";
import s from "./app.module.css";

/** Project pages need an account: show why, and how, instead of an empty page. */
export function SignedOutNotice({ children }: { children: ReactNode }) {
  const { mode, ready, signedIn } = useAccount();
  if (!ready) return null;
  if (signedIn) return <>{children}</>;
  return (
    <div className={s.page}>
      <TopBar />
      <main className={s.main} style={{ maxWidth: 560 }}>
        <h1 className={s.title}>Projects need an account</h1>
        <p className={s.lede}>
          {mode === "off"
            ? "Sign-in isn’t set up on this server yet, so projects aren’t available. You can still make single videos."
            : "Sign in to keep projects, track your progress and pick up where you left off on any device."}
        </p>
        <div className={s.row}>
          {mode !== "off" && <AccountButton />}
          <Link href="/" className={s.iconBtn} style={{ height: 36 }}>Make a single video</Link>
        </div>
      </main>
    </div>
  );
}
