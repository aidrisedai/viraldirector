"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccountButton, useAccount } from "@/components/app/account";
import { api, thumbFromVideo } from "@/components/app/api";
import { Button } from "@/components/ds/Button";
import { applyHook, BriefSchema, DEFAULT_BRIEF, PlanSchema, type Brief, type Plan, type PlanResponse } from "@/lib/plan";
import type { ProjectDetail, Video } from "@/lib/projectTypes";
import { seriesContext } from "@/lib/series";
import { clearProject, loadProject, saveProject } from "@/lib/storage";
import type { Extra } from "@/lib/editPlan";
import type { Take } from "@/lib/takes";
import { analyzeClips, directClips, pickClips, type ImportedClip } from "./clips/importClips";
import { ConceptStep } from "./ConceptStep";
import { extraFromFile } from "./render/media";
import { DirectorProvider } from "./DirectorContext";
import { DirectorPanel } from "./DirectorPanel";
import { useExportState } from "./export/useExportState";
import { ExportStep } from "./ExportStep";
import { PlanStep } from "./PlanStep";
import { RecordStep } from "./RecordStep";
import { ReviewStep } from "./ReviewStep";
import { ShotsStep } from "./ShotsStep";
import { useDirectorChat } from "./useDirectorChat";
import a from "@/components/app/app.module.css";
import s from "./director.module.css";

const STEPS = ["Concept", "Plan", "Shots", "Record", "Review", "Export"] as const;
type Step = 1 | 2 | 3 | 4 | 5 | 6;

type Props = {
  /** Start a video in this project (optionally from one of its ideas). */
  projectId?: string;
  ideaId?: string;
  /** Pick up a saved video. */
  videoId?: string;
};

/** What's saved with a video so it can be picked up again: the plan plus the choices made on it. */
type SavedPlan = { plan: Plan; hook: number; sample: boolean };

export function Director({ projectId: startProject, ideaId: startIdea, videoId: startVideo }: Props = {}) {
  const router = useRouter();
  const account = useAccount();
  const cloud = account.signedIn;
  const [videoId, setVideoId] = useState<string | null>(startVideo ?? null);
  const [project, setProject] = useState<{ id: string; name: string } | null>(null);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [step, setStep] = useState<Step>(1);
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [plan, setPlan] = useState<Plan | null>(null);
  // The plan as the Director wrote it; line feedback compares the creator's edits against it.
  const [basePlan, setBasePlan] = useState<Plan | null>(null);
  const [sample, setSample] = useState(false);
  const [hook, setHook] = useState(0);
  const [shot, setShot] = useState(0);
  const [takes, setTakes] = useState<Take[]>([]);
  const [kept, setKept] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  /** While clips are being read: what's happening ("Looking at clip 2 of 6…"). */
  const [clipStatus, setClipStatus] = useState("");
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const stepsRef = useRef<HTMLElement>(null);

  // Where this session starts: a saved video, a project's idea, or (signed out / single video) this browser's last draft.
  const local = !startProject && !startVideo;
  useEffect(() => {
    if (account.mode !== "off" && !account.ready) return;
    let live = true;
    const restorePlan = (raw: unknown) => {
      const saved = raw as Partial<SavedPlan> | null;
      const parsed = PlanSchema.safeParse(saved?.plan);
      if (!parsed.success) return;
      setPlan(parsed.data);
      setBasePlan(parsed.data);
      setHook(Math.min(2, Math.max(0, saved?.hook ?? 0)));
      setSample(Boolean(saved?.sample));
      setStep(3);
    };
    (async () => {
      try {
        if (startVideo && cloud) {
          const { video } = await api<{ video: Video }>(`/api/videos/${startVideo}`);
          if (!live) return;
          const b = BriefSchema.safeParse(video.brief);
          if (b.success) setBrief(b.data);
          restorePlan(video.plan);
          if (video.projectId) {
            const d = await api<ProjectDetail>(`/api/projects/${video.projectId}`);
            if (live) setProject({ id: d.project.id, name: d.project.name });
          }
        } else if (startProject && cloud) {
          const d = await api<ProjectDetail>(`/api/projects/${startProject}`);
          if (!live) return;
          const idea = d.ideas.find((i) => i.id === startIdea);
          setProject({ id: d.project.id, name: d.project.name });
          setIdeaTitle(idea?.title ?? "");
          setBrief({ ...DEFAULT_BRIEF, ...d.project.defaults, concept: idea?.concept ?? "", series: seriesContext(d.project, d.videos, idea?.title ?? "") });
        } else if (local) {
          const saved = loadProject();
          if (saved) {
            setBrief(saved.brief);
            setPlan(saved.plan);
            setBasePlan(saved.plan);
            setSample(saved.sample);
            setHook(saved.hook);
            setShot(saved.shot);
            if (saved.plan) setStep(3);
          }
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Couldn’t open that video.");
      } finally {
        if (live) setRestored(true);
      }
    })();
    return () => {
      live = false;
    };
    // Runs once sign-in state is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.ready, account.mode]);

  useEffect(() => {
    if (restored && local) saveProject({ brief, plan, sample, hook, shot });
  }, [restored, local, brief, plan, sample, hook, shot]);

  // Signed in: keep the saved video up to date as the plan changes (a moment after the last change).
  useEffect(() => {
    if (!cloud || !videoId || !plan) return;
    const id = setTimeout(() => {
      api(`/api/videos/${videoId}`, { method: "PATCH", body: { brief, plan: { plan, hook, sample } satisfies SavedPlan } }).catch(() => {});
    }, 1500);
    return () => clearTimeout(id);
  }, [cloud, videoId, brief, plan, hook, sample]);

  // On phones the steps scroll sideways: keep the current one in view, and start each step at the top.
  useEffect(() => {
    const nav = stepsRef.current;
    const on = nav?.querySelector<HTMLElement>("[aria-current=step]");
    if (nav && on) nav.scrollTo({ left: on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2, behavior: "smooth" });
    window.scrollTo({ top: 0 });
  }, [step]);

  // Takes live only in memory, so warn before a refresh throws them away.
  useEffect(() => {
    if (!takes.length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [takes.length]);

  const keptTakes = useMemo(
    () => (plan ? plan.shots.map((_, i) => takes.find((t) => t.id === kept[i])) : []),
    [plan, takes, kept],
  );
  const latestTake = useMemo(() => takes.findLast((t) => t.shot === shot), [takes, shot]);

  const finish = useExportState();
  const chat = useDirectorChat({ brief, plan, basePlan, hook, step: STEPS[step - 1], shot });
  const { ask, setOpen: setPanelOpen } = chat;
  const directorActions = useMemo(() => ({ ask, open: () => setPanelOpen(true) }), [ask, setPanelOpen]);

  /** Signed in: a new video is saved (to its project, if any) so it shows up in the studio and can be picked up later. */
  const saveNewVideo = (next: Brief, plan: Plan, isSample: boolean) => {
    if (!cloud || videoId) return;
    const saved: SavedPlan = { plan: applyHook(plan, 0), hook: 0, sample: isSample };
    api<{ video: Video }>("/api/videos", {
      body: { projectId: project?.id ?? null, ideaId: startIdea ?? null, title: (ideaTitle || next.concept).slice(0, 90), concept: next.concept.slice(0, 280), brief: next, plan: saved },
    })
      .then(({ video }) => {
        setVideoId(video.id);
        window.history.replaceState(null, "", `/studio?video=${video.id}`);
      })
      .catch(() => {});
  };

  const direct = useCallback(async (patch: Partial<Brief> = {}) => {
    const next = { ...brief, ...patch };
    setBrief(next);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await res.json().catch(() => ({ error: "The Director didn’t respond. Try again." }))) as PlanResponse;
      if ("error" in data) throw new Error(data.error);
      takes.forEach((t) => URL.revokeObjectURL(t.url));
      setTakes([]);
      setKept({});
      finish.reset();
      setPlan(applyHook(data.plan, 0));
      setBasePlan(applyHook(data.plan, 0));
      setSample(data.sample);
      setHook(0);
      setShot(0);
      setStep(2);
      saveNewVideo(next, data.plan, data.sample);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn’t reach the Director. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveNewVideo reads the same values
  }, [brief, takes, finish, cloud, videoId, project, startIdea, ideaTitle]);


  /** Clips that didn't go under a shot become extra content the edit can still use. */
  const keepAsExtras = async (left: ImportedClip[]) => {
    const extras: Extra[] = [];
    for (const c of left) {
      URL.revokeObjectURL(c.take.url);
      try {
        extras.push({ ...(await extraFromFile(c.file)), note: c.info.transcript ? `Says: ${c.info.transcript.slice(0, 200)}` : "" });
      } catch {}
    }
    if (extras.length) finish.setExtras((all) => [...all, ...extras].slice(0, 6));
    return extras.length;
  };

  /** Starts a video from clips the creator already has: the Director plans around them. */
  const directFromClips = async (files: File[], patch: Partial<Brief> = {}) => {
    const next = { ...brief, ...patch, story: "" };
    setBrief(next);
    const picked = pickClips(files);
    if (!picked.files.length) {
      setError(picked.note || "Pick at least one video clip.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const clips = await analyzeClips(picked.files, setClipStatus);
      if (!clips.length) throw new Error("This browser couldn’t play those clips. Try MP4 or MOV files.");
      setClipStatus("The Director is putting your clips together…");
      const data = await directClips({ mode: "plan", brief: next, clips: clips.map((c) => c.info) });
      if (!data.plan) throw new Error("The Director didn’t return a plan. Try again.");
      takes.forEach((t) => URL.revokeObjectURL(t.url));
      finish.reset();
      const used = clips.filter((c) => data.assign[c.info.id] !== undefined);
      const filed = used.map((c) => ({ ...c.take, shot: data.assign[c.info.id] }));
      setTakes(filed);
      setKept(Object.fromEntries(filed.map((t) => [t.shot, t.id])));
      const extra = await keepAsExtras(clips.filter((c) => data.assign[c.info.id] === undefined));
      const plan = applyHook(data.plan, 0);
      setPlan(plan);
      setBasePlan(plan);
      setSample(data.sample);
      setHook(0);
      setShot(Math.max(0, plan.shots.findIndex((_, i) => !filed.some((t) => t.shot === i))));
      setStep(2);
      setSavedNote([data.note, extra ? `${extra} clip${extra === 1 ? "" : "s"} kept as extra content for the edit.` : "", picked.note].filter(Boolean).join(" "));
      saveNewVideo(next, data.plan, data.sample);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn’t bring in your clips. Try again.");
    } finally {
      setLoading(false);
      setClipStatus("");
    }
  };

  /** Adds clips to an existing plan: each goes under the shot it fits; the rest become extra content. */
  const importToShots = async (files: File[]): Promise<string> => {
    if (!plan) return "";
    const picked = pickClips(files);
    if (!picked.files.length) return picked.note || "Pick at least one video clip.";
    try {
      const clips = await analyzeClips(picked.files, setClipStatus);
      if (!clips.length) return "This browser couldn’t play those clips. Try MP4 or MOV files.";
      setClipStatus("The Director is matching your clips to shots…");
      const filled = plan.shots.flatMap((_, i) => (kept[i] ? [i] : []));
      const data = await directClips({ mode: "match", brief, plan, filled, clips: clips.map((c) => c.info) });
      const filed = clips.filter((c) => data.assign[c.info.id] !== undefined).map((c) => ({ ...c.take, shot: data.assign[c.info.id] }));
      setTakes((all) => [...all, ...filed]);
      setKept((k) => ({ ...k, ...Object.fromEntries(filed.map((t) => [t.shot, t.id])) }));
      const extra = await keepAsExtras(clips.filter((c) => data.assign[c.info.id] === undefined));
      const counts = [
        `${filed.length} clip${filed.length === 1 ? "" : "s"} filed under ${filed.length === 1 ? "a shot" : "shots"}`,
        extra && `${extra} kept as extra content for the edit`,
      ].filter(Boolean).join(", ");
      return [`${counts}.`, data.note, picked.note].filter(Boolean).join(" ");
    } catch (e) {
      return e instanceof Error ? e.message : "Couldn’t bring in your clips.";
    } finally {
      setClipStatus("");
    }
  };

  /** The file was made: record it (with a thumbnail) in the creator's history. */
  const onExported = useCallback(
    async (result: { blob: Blob; seconds: number; format: string }) => {
      if (!cloud || !videoId || !plan) return;
      const thumb = await thumbFromVideo(result.blob);
      try {
        await api(`/api/videos/${videoId}`, {
          method: "PATCH",
          body: { status: "made", seconds: result.seconds, format: result.format, hook: plan.hooks[hook].line.replace(/^[“"]|[”"]$/g, ""), ...(thumb ? { thumb } : {}) },
        });
        setSavedNote(project ? `Saved to ${project.name}` : "Saved to your studio");
      } catch {
        setSavedNote("Made — but it couldn’t be saved to your history. Check your connection.");
      }
    },
    [cloud, videoId, plan, hook, project],
  );
  const onPostCaption = useCallback(
    (caption: string) => {
      if (cloud && videoId) api(`/api/videos/${videoId}`, { method: "PATCH", body: { caption } }).catch(() => {});
    },
    [cloud, videoId],
  );

  const pickHook = (i: number) => {
    setHook(i);
    setPlan((p) => (p ? applyHook(p, i) : p));
    setBasePlan((p) => (p ? applyHook(p, i) : p));
  };

  const editSeconds = (i: number, seconds: number) =>
    setPlan((p) => (p ? { ...p, shots: p.shots.map((x, j) => (j === i ? { ...x, seconds } : x)) } : p));

  const editLine = (i: number, line: string) =>
    setPlan((p) => (p ? { ...p, shots: p.shots.map((x, j) => (j === i ? { ...x, line } : x)) } : p));

  const addTake = useCallback((t: Take) => {
    setTakes((all) => [...all, t]);
    setShot(t.shot);
    setStep(5);
  }, []);

  const keepTake = (t: Take) => {
    if (!plan) return;
    const next = { ...kept, [t.shot]: t.id };
    setKept(next);
    // Move on to the next required shot still missing a take, else to export.
    const order = plan.shots.map((_, i) => (t.shot + 1 + i) % plan.shots.length);
    const missing = order.find((i) => plan.shots[i].required && !next[i]);
    if (missing === undefined) setStep(6);
    else {
      setShot(missing);
      setStep(3);
    }
  };

  const reset = () => {
    if (takes.length && !window.confirm("Start a new video? Your recorded takes will be discarded.")) return;
    if (project) {
      router.push(`/projects/${project.id}`);
      return;
    }
    if (!local) {
      router.push("/studio");
      return;
    }
    takes.forEach((t) => URL.revokeObjectURL(t.url));
    clearProject();
    // The next video is a new saved video, not more changes to this one.
    if (videoId) {
      setVideoId(null);
      window.history.replaceState(null, "", window.location.pathname);
    }
    setSavedNote("");
    setTakes([]);
    setKept({});
    setPlan(null);
    setBasePlan(null);
    chat.clear();
    chat.setOpen(false);
    finish.reset();
    setSample(false);
    setHook(0);
    setShot(0);
    setBrief(DEFAULT_BRIEF);
    setError("");
    setStep(1);
  };

  const canVisit = (n: Step) => n === 1 || (plan !== null && (n !== 5 || latestTake !== undefined));

  return (
    <DirectorProvider value={directorActions}>
    <div className={`${s.app} ${chat.open ? s.appWithPanel : ""}`}>
      <header className={s.header}>
        <div className={s.brand}>
          <Link href="/" className={s.wordmark} style={{ color: "inherit", textDecoration: "none" }}>ViralDirector</Link>
          {project ? (
            <>
              <span className={s.slash}>/</span>
              <Link href={`/projects/${project.id}`} className={s.projectName} style={{ color: "inherit" }}>{project.name}</Link>
            </>
          ) : plan ? (
            <>
              <span className={s.slash}>/</span>
              <span className={s.projectName}>{brief.concept}</span>
            </>
          ) : null}
        </div>
        <nav className={s.steps} aria-label="Steps" ref={stepsRef}>
          {STEPS.map((label, i) => {
            const n = (i + 1) as Step;
            const cls = n === step ? s.stepOn : n < step ? s.stepDone : "";
            return (
              <button
                key={label}
                type="button"
                className={`${s.stepBtn} ${cls}`}
                aria-current={n === step ? "step" : undefined}
                disabled={!canVisit(n)}
                onClick={() => setStep(n)}
              >
                <span className={s.stepDot}>{n}</span>
                {label}
              </button>
            );
          })}
        </nav>
        <div className={s.headerActions}>
          <Button variant={chat.open ? "secondary" : "outline"} size="sm" icon="message" onClick={() => chat.setOpen(!chat.open)} aria-expanded={chat.open} aria-label="Ask the Director">
            <span className={s.wideOnly}>Ask the Director</span>
          </Button>
          {(plan || project) && (
            <Button variant="ghost" size="sm" onClick={reset}>
              {project ? <>Back<span className={s.wideOnly}>&nbsp;to project</span></> : <>New<span className={s.wideOnly}>&nbsp;video</span></>}
            </Button>
          )}
          <AccountButton />
        </div>
      </header>

      {step === 1 && (
        <ConceptStep
          brief={brief}
          onChange={(patch) => setBrief((b) => ({ ...b, ...patch }))}
          onNext={direct}
          onFromClips={directFromClips}
          clipStatus={clipStatus}
          loading={loading}
          error={error}
        />
      )}
      {step === 2 && plan && (
        <PlanStep plan={plan} brief={brief} sample={sample} hook={hook} onPickHook={pickHook} onNext={() => setStep(3)} />
      )}
      {step === 3 && plan && (
        <ShotsStep
          plan={plan}
          shot={shot}
          kept={keptTakes}
          onPickShot={setShot}
          onEditLine={editLine}
          onEditSeconds={editSeconds}
          onRecord={() => setStep(4)}
          onUpload={addTake}
          onAskLine={chat.askLine}
          askBusy={chat.busy}
          brief={brief}
          onImportClips={importToShots}
          clipStatus={clipStatus}
        />
      )}
      {step === 4 && plan && <RecordStep plan={plan} shot={shot} onTake={addTake} onBack={() => setStep(3)} />}
      {step === 5 && plan && latestTake && (
        <ReviewStep
          shot={plan.shots[shot]}
          index={shot}
          take={latestTake}
          takeNumber={takes.filter((t) => t.shot === shot).length}
          onRetake={() => setStep(4)}
          onKeep={() => keepTake(latestTake)}
          onAskDirector={() => chat.askTake(latestTake, takes.filter((t) => t.shot === shot).length)}
          askBusy={chat.busy}
        />
      )}
      {step === 6 && plan && (
        <ExportStep
          plan={plan}
          brief={brief}
          hook={hook}
          kept={keptTakes}
          onGoToShot={(i) => { setShot(i); setStep(3); }}
          finish={finish}
          onExported={onExported}
          onPostCaption={onPostCaption}
        />
      )}

      {savedNote && (
        <div className={a.savedNote} role="status">
          <span>{savedNote}</span>
          {project ? <Link href={`/projects/${project.id}`}>View project</Link> : cloud ? <Link href="/">Your studio</Link> : null}
          <button type="button" className={s.panelClose} style={{ color: "inherit" }} onClick={() => setSavedNote("")} aria-label="Dismiss">×</button>
        </div>
      )}

      <DirectorPanel
        open={chat.open}
        onClose={() => chat.setOpen(false)}
        messages={chat.messages}
        busy={chat.busy}
        plan={plan}
        shot={shot}
        onAsk={chat.ask}
        onApplyLine={editLine}
        onClear={chat.clear}
      />
    </div>
    </DirectorProvider>
  );
}
