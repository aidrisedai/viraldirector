"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ds/Icon";
import { AccountButton } from "./account";
import s from "./app.module.css";

/** The header for Home and project pages: wordmark (home), an optional back link, and the account. */
export function TopBar({ back, children }: { back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className={s.top}>
      <Link href="/" className={s.wordmark}>ViralDirector</Link>
      {back && (
        <Link href={back.href} className={s.crumb}>
          <Icon name="chevron-right" size={16} style={{ transform: "rotate(180deg)" }} />
          <span>{back.label}</span>
        </Link>
      )}
      <div className={s.topEnd}>
        {children}
        <AccountButton />
      </div>
    </header>
  );
}
