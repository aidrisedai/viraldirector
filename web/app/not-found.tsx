import Link from "next/link";
import s from "@/components/director/director.module.css";

export default function NotFound() {
  return (
    <main className={`${s.main} ${s.conceptMain}`}>
      <div className={s.conceptCol}>
        <div className={s.stack} style={{ gap: 12 }}>
          <span className={s.eyebrow}>404</span>
          <h1 className={s.conceptTitle}>This page isn’t on the call sheet.</h1>
          <p className={s.lede}>
            <Link href="/">Back to ViralDirector</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
