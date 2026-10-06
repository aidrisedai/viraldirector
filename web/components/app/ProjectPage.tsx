"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ds/Icon";
import { addDays, daysBetween, localDay, projectStats, statusLine } from "@/lib/projectStats";
import { CADENCES, DURATIONS, GOAL_MAX, IDEA_CONCEPT_MAX, IDEA_TITLE_MAX, NAME_MAX, type Idea, type Project, type ProjectDetail, type Video } from "@/lib/projectTypes";
import { api, shortDate } from "./api";
import { TopBar } from "./TopBar";
import s from "./app.module.css";

const cadenceLabel = (perWeek: number) => CADENCES.find((c) => c.perWeek === perWeek)?.label ?? `${perWeek} a week`;

/** Every day of the run as a grid of weeks: what was made, today, and what's still ahead. */
function Calendar({ project, byDay }: { project: Project; byDay: Record<string, number> }) {
  const today = localDay(new Date());
  const last = project.durationDays ? addDays(project.startDate, project.durationDays - 1) : addDays(today > project.startDate ? today : project.startDate, 27);
  // Weeks start on Monday; pad before the start so columns line up.
  const [y, m, d] = project.startDate.split("-").map(Number);
  const lead = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const first = addDays(project.startDate, -lead);
  const days = Array.from({ length: daysBetween(first, last) + 1 }, (_, i) => addDays(first, i));
  return (
    <div className={s.calendar} role="img" aria-label="Calendar of videos made">
      {days.map((day) => {
        const before = day < project.startDate;
        const n = byDay[day] ?? 0;
        const cls = [s.calDay, before ? s.calOut : "", day > today ? s.calFuture : "", n === 1 ? s.calMade : "", n > 1 ? s.calMade2 : "", day === today ? s.calToday : ""].join(" ");
        return <span key={day} className={cls} title={`${day}${n ? ` · ${n} video${n > 1 ? "s" : ""}` : ""}`} />;
      })}
    </div>
  );
}

function IdeaEditor({ idea, onSave, onCancel }: { idea?: Pick<Idea, "title" | "concept" | "angle">; onSave: (v: { title: string; concept: string; angle: string }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(idea?.title ?? "");
  const [concept, setConcept] = useState(idea?.concept ?? "");
  return (
    <form className={s.card} style={{ display: "flex", flexDirection: "column", gap: 10 }} onSubmit={(e) => { e.preventDefault(); if (title.trim() && concept.trim().length >= 3) onSave({ title: title.trim(), concept: concept.trim(), angle: idea?.angle ?? "" }); }}>
      <input className={s.input} aria-label="Idea title" placeholder="Title — e.g. My first failed app" value={title} maxLength={IDEA_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <textarea className={s.textarea} aria-label="What the video is about" rows={2} placeholder="What it's about, in a sentence" value={concept} maxLength={IDEA_CONCEPT_MAX} onChange={(e) => setConcept(e.target.value)} />
      <div className={s.row}>
        <button type="submit" className={s.primaryBtn} disabled={!title.trim() || concept.trim().length < 3}>Save idea</button>
        <button type="button" className={s.iconBtn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function SettingsEditor({ project, onSave, onCancel, onDelete }: { project: Project; onSave: (p: Partial<Project>) => void; onCancel: () => void; onDelete: () => void }) {
  const [name, setName] = useState(project.name);
  const [goal, setGoal] = useState(project.goal);
  const [perWeek, setPerWeek] = useState(project.perWeek);
  const [durationDays, setDurationDays] = useState(project.durationDays);
  const [startDate, setStartDate] = useState(project.startDate);
  return (
    <form className={`${s.card} ${s.form}`} style={{ maxWidth: "none" }} onSubmit={(e) => { e.preventDefault(); onSave({ name: name.trim() || project.name, goal: goal.trim(), perWeek, durationDays, startDate }); }}>
      <label className={s.field}><span className={s.label}>Name</span><input className={s.input} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} /></label>
      <label className={s.field}><span className={s.label}>Goal</span><textarea className={s.textarea} rows={3} value={goal} maxLength={GOAL_MAX} onChange={(e) => setGoal(e.target.value)} /></label>
      <div className={s.field}>
        <span className={s.label}>How often</span>
        <div className={s.chips}>{CADENCES.map((c) => <button key={c.label} type="button" aria-pressed={c.perWeek === perWeek} className={`${s.chip} ${c.perWeek === perWeek ? s.chipOn : ""}`} onClick={() => setPerWeek(c.perWeek)}>{c.label}</button>)}</div>
      </div>
      <div className={s.field}>
        <span className={s.label}>How long</span>
        <div className={s.chips}>{DURATIONS.map((d) => <button key={d.label} type="button" aria-pressed={d.days === durationDays} className={`${s.chip} ${d.days === durationDays ? s.chipOn : ""}`} onClick={() => setDurationDays(d.days)}>{d.label}</button>)}</div>
      </div>
      <label className={s.field}><span className={s.label}>Started</span><input className={s.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ maxWidth: 220 }} /></label>
      <div className={s.between}>
        <div className={s.row}>
          <button type="submit" className={s.primaryBtn}>Save</button>
          <button type="button" className={s.iconBtn} onClick={onCancel}>Cancel</button>
        </div>
        <button type="button" className={s.iconBtn} style={{ color: "var(--red-500, #C2363B)" }} onClick={onDelete}><Icon name="trash" size={14} /> Delete project</button>
      </div>
    </form>
  );
}

export function ProjectPage({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<string | null>(null); // idea id, "new", or "settings"
  const [steer, setSteer] = useState("");
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postLink, setPostLink] = useState("");

  const load = useCallback(() => api<ProjectDetail>(`/api/projects/${id}`).then(setData).catch((e: Error) => setError(e.message)), [id]);
  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => (data ? projectStats(data.project, data.videos) : null), [data]);
  if (error) return (<div className={s.page}><TopBar back={{ href: "/", label: "Your studio" }} /><main className={s.main}><p className={s.error} role="alert">{error}</p></main></div>);
  if (!data || !stats) return (<div className={s.page}><TopBar back={{ href: "/", label: "Your studio" }} /><main className={s.main}><p className={s.small}>Loading…</p></main></div>);

  const { project, ideas, videos } = data;
  const open = ideas.filter((i) => i.status === "open");
  const next = open[0];
  const made = videos.filter((v) => v.status !== "draft");
  const drafts = videos.filter((v) => v.status === "draft");
  const pct = stats.target ? Math.min(100, (stats.made / stats.target) * 100) : 0;
  const makeHref = (idea?: Idea) => `/studio?project=${project.id}${idea ? `&idea=${idea.id}` : ""}`;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setNotice("");
    try {
      await fn();
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  };
  const suggest = () => run("ideas", () => api(`/api/projects/${project.id}/ideas`, { body: { mode: "generate", count: 8, steer } }).then(() => setSteer("")));
  const moveUp = (idea: Idea, i: number) => {
    if (i === 0) return;
    const before = open[i - 1], beforeThat = open[i - 2];
    const position = beforeThat ? (beforeThat.position + before.position) / 2 : before.position - 1;
    run("move", () => api(`/api/ideas/${idea.id}`, { method: "PATCH", body: { position } }));
  };

  return (
    <div className={s.page}>
      <TopBar back={{ href: "/", label: "Your studio" }} />
      <main className={s.main}>
        {editing === "settings" ? (
          <SettingsEditor
            project={project}
            onCancel={() => setEditing(null)}
            onSave={(patch) => run("settings", () => api(`/api/projects/${project.id}`, { method: "PATCH", body: patch }).then(() => setEditing(null)))}
            onDelete={() => {
              if (!window.confirm(`Delete “${project.name}”? Its ideas are deleted; videos you made stay in your studio.`)) return;
              api(`/api/projects/${project.id}`, { method: "DELETE" }).then(() => router.push("/")).catch((e: Error) => setNotice(e.message));
            }}
          />
        ) : (
          <div className={s.projectHead}>
            <div className={s.between}>
              <span className={s.eyebrow}>{cadenceLabel(project.perWeek)}{project.durationDays ? ` · ${project.durationDays} days` : ""} · started {shortDate(`${project.startDate}T12:00:00`)}</span>
              <button type="button" className={s.iconBtn} onClick={() => setEditing("settings")}><Icon name="pencil" size={14} /> Edit</button>
            </div>
            <h1 className={s.title}>{project.name}</h1>
            {project.goal && <p className={s.lede}>{project.goal}</p>}
          </div>
        )}

        <div className={s.stats}>
          <div className={`${s.stat} ${s.statToday}`}>
            <span className={s.small}>{stats.dayNumber > 0 ? `Day ${stats.dayNumber}${project.durationDays ? ` of ${project.durationDays}` : ""}` : `Starts ${shortDate(`${project.startDate}T12:00:00`)}`}</span>
            <span className={s.statBig} style={{ fontSize: 26 }}>{statusLine(stats, project.perWeek)}</span>
            <div className={s.row}>
              <Link href={makeHref(next)} className={s.primaryBtn}>
                <Icon name="video" size={16} /> {stats.madeToday === 0 && project.perWeek >= 7 ? "Make today’s video" : "Make the next video"}
              </Link>
            </div>
            {next && <span className={s.small}>Up next: {next.title}</span>}
          </div>
          <div className={s.stat}>
            <span className={s.small}>Made</span>
            <span className={s.statBig}>{stats.made}{stats.target ? <span className={s.muted} style={{ fontSize: 18 }}> / {stats.target}</span> : null}</span>
            {stats.target !== null && <div className={s.bar}><div style={{ width: `${pct}%` }} /></div>}
          </div>
          <div className={s.stat}>
            <span className={s.small}>{project.perWeek >= 7 ? "Day streak" : "Ahead of schedule"}</span>
            <span className={s.statBig}>{project.perWeek >= 7 ? stats.streak : Math.max(0, stats.ahead)}</span>
            <span className={s.small}>{stats.ahead < 0 ? `${-stats.ahead} behind plan` : stats.ahead > 0 ? `${stats.ahead} ahead of plan` : "Right on plan"}</span>
          </div>
          <div className={s.stat}>
            <span className={s.small}>Posted</span>
            <span className={s.statBig}>{stats.posted}</span>
            <span className={s.small}>{stats.daysLeft !== null ? `${stats.daysLeft} days left` : "No end date"}</span>
          </div>
        </div>

        <section className={s.stack} aria-label="Calendar">
          <Calendar project={project} byDay={stats.byDay} />
          <div className={s.legend}>
            <span><i className={`${s.calDay} ${s.calMade}`} /> 1 video</span>
            <span><i className={`${s.calDay} ${s.calMade2}`} /> 2+</span>
            <span><i className={`${s.calDay} ${s.calFuture}`} /> Ahead</span>
            <span><i className={`${s.calDay} ${s.calToday}`} /> Today</span>
          </div>
        </section>

        {notice && <p className={s.error} role="alert">{notice}</p>}

        {drafts.length > 0 && (
          <section className={s.stack} aria-label="In progress">
            <h2 className={s.h2}>In progress</h2>
            <div className={s.made}>
              {drafts.map((v) => (
                <div key={v.id} className={s.madeItem} style={{ gridTemplateColumns: "1fr" }}>
                  <div className={s.madeBody}>
                    <span className={`${s.badge} ${s.badgeDraft}`}>Draft</span>
                    <strong>{v.title}</strong>
                    <span className={s.small}>Started {shortDate(v.createdAt)}</span>
                    <div className={s.row}>
                      <Link href={`/studio?video=${v.id}`} className={s.iconBtn}>Continue</Link>
                      <button type="button" className={s.iconBtn} onClick={() => run("del", () => api(`/api/videos/${v.id}`, { method: "DELETE" }))}>Discard</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className={s.stack} aria-label="Up next">
          <div className={s.between}>
            <h2 className={s.h2}>Up next</h2>
            <button type="button" className={s.iconBtn} onClick={() => setEditing("new")}><Icon name="plus" size={14} /> Add your own</button>
          </div>
          {editing === "new" && (
            <IdeaEditor onCancel={() => setEditing(null)} onSave={(idea) => run("add", () => api(`/api/projects/${project.id}/ideas`, { body: { mode: "add", idea } }).then(() => setEditing(null)))} />
          )}
          <div className={s.ideas}>
            {open.map((idea, i) =>
              editing === idea.id ? (
                <IdeaEditor key={idea.id} idea={idea} onCancel={() => setEditing(null)} onSave={(v) => run("edit", () => api(`/api/ideas/${idea.id}`, { method: "PATCH", body: v }).then(() => setEditing(null)))} />
              ) : (
                <div key={idea.id} className={`${s.idea} ${i === 0 ? s.ideaNext : ""}`}>
                  <span className={s.ideaNum}>{i + 1}</span>
                  <div className={s.stack} style={{ gap: 4, minWidth: 0 }}>
                    <span className={s.ideaTitle}>{idea.title}</span>
                    <span className={s.ideaConcept}>{idea.concept}</span>
                    {idea.angle && <span className={s.ideaAngle}>{idea.angle}</span>}
                  </div>
                  <div className={s.ideaActions}>
                    <Link href={makeHref(idea)} className={s.primaryBtn} style={{ height: 34 }}>Make this</Link>
                    <button type="button" className={s.iconBtn} onClick={() => setEditing(idea.id)} aria-label={`Edit ${idea.title}`}><Icon name="pencil" size={14} /></button>
                    <button type="button" className={s.iconBtn} onClick={() => moveUp(idea, i)} disabled={i === 0 || Boolean(busy)} aria-label={`Move ${idea.title} up`}>↑</button>
                    <button type="button" className={s.iconBtn} onClick={() => run("skip", () => api(`/api/ideas/${idea.id}`, { method: "PATCH", body: { status: "skipped" } }))} aria-label={`Skip ${idea.title}`}><Icon name="x" size={14} /></button>
                  </div>
                </div>
              ),
            )}
            {!open.length && <div className={s.empty}>No ideas waiting. Ask the Director for more, or add your own.</div>}
          </div>
          <div className={s.card} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input className={s.input} style={{ flex: "1 1 240px" }} aria-label="Steer the next ideas" placeholder="Optional: steer them — “more behind-the-scenes”, “answer questions from comments”" value={steer} maxLength={400} onChange={(e) => setSteer(e.target.value)} />
            <button type="button" className={s.primaryBtn} onClick={suggest} disabled={Boolean(busy)}>
              <Icon name="sparkles" size={16} /> {busy === "ideas" ? "The Director is thinking…" : "Suggest more ideas"}
            </button>
          </div>
        </section>

        <section className={s.stack} aria-label="Made">
          <h2 className={s.h2}>Made{made.length ? ` · ${made.length}` : ""}</h2>
          {!made.length && <div className={s.empty}>Your videos will appear here as you make them — with their hooks and captions, ready to look back on.</div>}
          <div className={s.made}>
            {made.map((v: Video) => (
              <div key={v.id} className={s.madeItem}>
                {v.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- stored data URL
                  <img className={s.madeThumb} src={v.thumb} alt="" />
                ) : (
                  <span className={s.madeThumb} />
                )}
                <div className={s.madeBody}>
                  <span className={`${s.badge} ${v.status === "posted" ? s.badgePosted : ""}`}>{v.status === "posted" ? "Posted" : "Made"}</span>
                  <strong style={{ fontSize: 15 }}>{v.title}</strong>
                  <span className={s.small}>{shortDate(v.madeAt ?? v.createdAt)}{v.seconds ? ` · ${Math.round(v.seconds)}s` : ""}</span>
                  {v.hook && <span className={s.small} style={{ fontStyle: "italic" }}>“{v.hook}”</span>}
                  {postingId === v.id ? (
                    <form className={s.row} onSubmit={(e) => { e.preventDefault(); run("post", () => api(`/api/videos/${v.id}`, { method: "PATCH", body: { status: "posted", postedUrl: postLink.trim() } }).then(() => { setPostingId(null); setPostLink(""); })); }}>
                      <input className={s.input} style={{ padding: "8px 10px", fontSize: 14 }} aria-label="Link to the post (optional)" placeholder="Link to the post (optional)" value={postLink} onChange={(e) => setPostLink(e.target.value)} autoFocus />
                      <button type="submit" className={s.primaryBtn} style={{ height: 34 }}>Mark posted</button>
                    </form>
                  ) : (
                    <div className={s.row} style={{ gap: 6 }}>
                      {v.status !== "posted" && <button type="button" className={s.iconBtn} onClick={() => setPostingId(v.id)}><Icon name="check" size={14} /> Posted it</button>}
                      {v.postedUrl && <a className={s.iconBtn} href={v.postedUrl} target="_blank" rel="noreferrer">View post</a>}
                      {v.caption && <button type="button" className={s.iconBtn} onClick={() => navigator.clipboard.writeText(v.caption).then(() => setNotice("Caption copied."))}>Copy caption</button>}
                      <Link href={`/studio?video=${v.id}`} className={s.iconBtn}>Open</Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
