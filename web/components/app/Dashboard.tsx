"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ds/Icon";
import { statusLine, summaryProgress } from "@/lib/projectStats";
import type { ProjectSummary, Video } from "@/lib/projectTypes";
import { api, shortDate } from "./api";
import { TopBar } from "./TopBar";
import s from "./app.module.css";

/** Signed-in home: projects with their progress, and recent single videos. */
export function Dashboard() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [singles, setSingles] = useState<Video[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<{ projects: ProjectSummary[] }>("/api/projects"), api<{ videos: Video[] }>("/api/videos")])
      .then(([p, v]) => {
        setProjects(p.projects);
        setSingles(v.videos);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className={s.page}>
      <TopBar />
      <main className={s.main}>
        <div className={s.hero}>
          <div className={s.stack} style={{ gap: 8 }}>
            <span className={s.eyebrow}>Your studio</span>
            <h1 className={s.title}>What are you building toward?</h1>
            <p className={s.lede}>A project is a goal you reach one video at a time — the Director keeps the ideas coming and tracks your run.</p>
          </div>
          <Link href="/studio" className={s.iconBtn} style={{ height: 40, padding: "0 16px" }}>
            <Icon name="video" size={16} /> Make a single video
          </Link>
        </div>

        {error && <p className={s.error} role="alert">{error}</p>}

        <section className={s.stack} aria-label="Projects">
          <h2 className={s.h2}>Projects</h2>
          <div className={s.grid}>
            {projects?.map((p) => {
              const st = summaryProgress(p);
              const pct = st.target ? Math.min(100, (p.made / st.target) * 100) : 0;
              const line = statusLine(st, p.perWeek);
              const behind = st.ahead < 0 && !st.finished && st.dayNumber > 0;
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className={s.projectCard}>
                  <div className={s.cardTop}>
                    {p.latestThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- stored data URL
                      <img className={s.cardThumb} src={p.latestThumb} alt="" />
                    ) : (
                      <span className={s.cardThumbEmpty}><Icon name="sparkles" size={20} /></span>
                    )}
                    <div className={s.stack} style={{ gap: 6, minWidth: 0 }}>
                      <span className={s.cardName}>{p.name}</span>
                      {p.goal && <span className={s.cardGoal}>{p.goal}</span>}
                    </div>
                  </div>
                  <div className={s.stack} style={{ gap: 8 }}>
                    <div className={s.between}>
                      <span className={s.small}>
                        {st.dayNumber > 0 ? `Day ${st.dayNumber}${p.durationDays ? ` of ${p.durationDays}` : ""} · ` : ""}
                        {p.made} made{st.target ? ` of ${st.target}` : ""}
                      </span>
                      <span className={`${s.statusPill} ${behind ? s.statusWarn : ""}`}>{line}</span>
                    </div>
                    {st.target !== null && <div className={s.bar}><div style={{ width: `${pct}%` }} /></div>}
                  </div>
                </Link>
              );
            })}
            <Link href="/projects/new" className={s.newCard}>
              <Icon name="plus" size={22} />
              Start a project
              <span className={s.small}>e.g. one video a day for 90 days</span>
            </Link>
          </div>
          {projects === null && !error && <p className={s.small}>Loading your projects…</p>}
        </section>

        {singles.length > 0 && (
          <section className={s.stack} aria-label="Single videos">
            <h2 className={s.h2}>Single videos</h2>
            <div className={s.videoStrip}>
              {singles.slice(0, 12).map((v) => (
                <Link key={v.id} href={`/studio?video=${v.id}`} className={s.videoTile}>
                  {v.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- stored data URL
                    <img src={v.thumb} alt="" />
                  ) : (
                    <span className={s.videoTileEmpty}>{v.status === "draft" ? "Draft" : "Video"}</span>
                  )}
                  <span className={s.tileTitle}>{v.title}</span>
                  <span className={s.small}>{shortDate(v.madeAt ?? v.createdAt)}{v.status === "draft" ? " · draft" : ""}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
