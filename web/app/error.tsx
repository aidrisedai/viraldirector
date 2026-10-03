"use client";

import { useEffect } from "react";
import { Button } from "@/components/ds/Button";
import s from "@/components/director/director.module.css";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={`${s.main} ${s.conceptMain}`}>
      <div className={s.conceptCol}>
        <div className={s.stack} style={{ gap: 12 }}>
          <span className={s.eyebrow}>SOMETHING WENT WRONG</span>
          <h1 className={s.conceptTitle}>That scene didn’t work.</h1>
          <p className={s.lede}>Your plan is saved in this browser. Try again, and if it keeps happening, refresh the page.</p>
        </div>
        <div>
          <Button size="lg" icon="rotate-ccw" onClick={reset}>Try again</Button>
        </div>
      </div>
    </main>
  );
}
