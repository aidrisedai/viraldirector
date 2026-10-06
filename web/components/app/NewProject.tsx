"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ds/Icon";
import { AUDIENCES, GOALS, LENGTHS, PLATFORMS } from "@/lib/plan";
import { localDay } from "@/lib/projectStats";
import { CADENCES, DURATIONS, GOAL_MAX, NAME_MAX, type Project, type ProjectInput } from "@/lib/projectTypes";
import { api } from "./api";
import { TopBar } from "./TopBar";
import s from "./app.module.css";

function Chips<T extends string | number | null>({ options, value, onChange, label }: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className={s.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.label} type="button" aria-pressed={o.value === value} className={`${s.chip} ${o.value === value ? s.chipOn : ""}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const IDEAS = ["One build-in-public video a day until launch", "Teach one money skill to teens every weekday", "Grow our startup's Instagram to 1,000 followers"];

export function NewProject() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [perWeek, setPerWeek] = useState(7);
  const [durationDays, setDurationDays] = useState<number | null>(90);
  const [startDate, setStartDate] = useState(() => localDay(new Date()));
  const [defaults, setDefaults] = useState<ProjectInput["defaults"]>({ goal: "Grow", length: "45s", platform: "Reels / TikTok", audience: "Teens 13–18", format: "Director picks" });
  const [busy, setBusy] = useState<"" | "create" | "ideas">("");
  const [error, setError] = useState("");

  const target = durationDays ? Math.max(1, Math.round((durationDays / 7) * perWeek)) : null;
  const cadence = CADENCES.find((c) => c.perWeek === perWeek)?.label.toLowerCase() ?? `${perWeek} a week`;

  const create = async () => {
    if (!name.trim()) return setError("Give your project a name.");
    setError("");
    setBusy("create");
    try {
      const { project } = await api<{ project: Project }>("/api/projects", {
        body: { name: name.trim(), goal: goal.trim(), perWeek, durationDays, startDate, defaults } satisfies ProjectInput,
      });
      // First ideas from the Director; if it isn't connected the project still works with your own ideas.
      setBusy("ideas");
      await api(`/api/projects/${project.id}/ideas`, { body: { mode: "generate", count: 10, steer: "" } }).catch(() => {});
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t create the project.");
      setBusy("");
    }
  };

  return (
    <div className={s.page}>
      <TopBar back={{ href: "/", label: "Your studio" }} />
      <main className={s.main}>
        <div className={s.stack} style={{ gap: 8 }}>
          <span className={s.eyebrow}>New project</span>
          <h1 className={s.title}>Set a goal. Show up for it.</h1>
          <p className={s.lede}>Tell the Director what you’re working toward and how often you’ll post. It plans the series and keeps the ideas coming.</p>
        </div>

        <form className={s.form} onSubmit={(e) => { e.preventDefault(); create(); }}>
          <label className={s.field}>
            <span className={s.label}>Project name</span>
            <input className={s.input} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="90 days of building in public" autoFocus />
          </label>
          <label className={s.field}>
            <span className={s.label}>What’s the goal?</span>
            <textarea className={s.textarea} rows={3} value={goal} maxLength={GOAL_MAX} onChange={(e) => setGoal(e.target.value)} placeholder="What you want these videos to achieve — who for, and what changes if it works." />
            <div className={s.chips}>
              {IDEAS.map((x) => (
                <button key={x} type="button" className={s.chip} style={{ fontSize: 13, padding: "6px 12px" }} onClick={() => setGoal(x)}>{x}</button>
              ))}
            </div>
          </label>
          <div className={s.field}>
            <span className={s.label}>How often?</span>
            <Chips label="How often" options={CADENCES.map((c) => ({ label: c.label, value: c.perWeek }))} value={perWeek} onChange={(v) => setPerWeek(v)} />
          </div>
          <div className={s.field}>
            <span className={s.label}>For how long?</span>
            <Chips label="For how long" options={DURATIONS.map((d) => ({ label: d.label, value: d.days }))} value={durationDays} onChange={(v) => setDurationDays(v)} />
          </div>
          <label className={s.field}>
            <span className={s.label}>Starts</span>
            <input className={s.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ maxWidth: 220 }} />
          </label>
          <div className={s.field}>
            <span className={s.label}>Videos for</span>
            <Chips label="Platform" options={PLATFORMS.map((x) => ({ label: x, value: x }))} value={defaults.platform} onChange={(platform) => setDefaults((d) => ({ ...d, platform }))} />
            <Chips label="Audience" options={AUDIENCES.map((x) => ({ label: x, value: x }))} value={defaults.audience} onChange={(audience) => setDefaults((d) => ({ ...d, audience }))} />
            <Chips label="Purpose" options={GOALS.map((x) => ({ label: x, value: x }))} value={defaults.goal} onChange={(g) => setDefaults((d) => ({ ...d, goal: g }))} />
            <Chips label="Length" options={LENGTHS.map((x) => ({ label: x, value: x }))} value={defaults.length} onChange={(length) => setDefaults((d) => ({ ...d, length }))} />
          </div>

          <div className={s.summary}>
            {target ? <>That’s <strong>{target} videos</strong> — {cadence} for {durationDays} days.</> : <>Open-ended — {cadence}, for as long as you like.</>}
            {" "}You can change any of this later.
          </div>

          {error && <p className={s.error} role="alert">{error}</p>}
          <div className={s.row}>
            <button type="submit" className={s.primaryBtn} disabled={Boolean(busy)}>
              <Icon name="sparkles" size={16} />
              {busy === "create" ? "Creating…" : busy === "ideas" ? "The Director is writing your first ideas…" : "Create project"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
