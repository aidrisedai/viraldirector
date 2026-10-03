"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ds/Button";
import { applyHook, DEFAULT_BRIEF, type Brief, type Plan, type PlanResponse } from "@/lib/plan";
import { clearProject, loadProject, saveProject } from "@/lib/storage";
import type { Take } from "@/lib/takes";
import { ConceptStep } from "./ConceptStep";
import { ExportStep } from "./ExportStep";
import { PlanStep } from "./PlanStep";
import { RecordStep } from "./RecordStep";
import { ReviewStep } from "./ReviewStep";
import { ShotsStep } from "./ShotsStep";
import s from "./director.module.css";

const STEPS = ["Concept", "Plan", "Shots", "Record", "Review", "Export"] as const;
type Step = 1 | 2 | 3 | 4 | 5 | 6;

export function Director() {
  const [step, setStep] = useState<Step>(1);
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sample, setSample] = useState(false);
  const [hook, setHook] = useState(0);
  const [shot, setShot] = useState(0);
  const [takes, setTakes] = useState<Take[]>([]);
  const [kept, setKept] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);

  // Restore the last project after mount (localStorage isn't available during SSR).
  useEffect(() => {
    const saved = loadProject();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
      setBrief(saved.brief);
      setPlan(saved.plan);
      setSample(saved.sample);
      setHook(saved.hook);
      setShot(saved.shot);
      if (saved.plan) setStep(3);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored) saveProject({ brief, plan, sample, hook, shot });
  }, [restored, brief, plan, sample, hook, shot]);

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

  const direct = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });
      const data = (await res.json().catch(() => ({ error: "The Director didn’t respond. Try again." }))) as PlanResponse;
      if ("error" in data) throw new Error(data.error);
      takes.forEach((t) => URL.revokeObjectURL(t.url));
      setTakes([]);
      setKept({});
      setPlan(applyHook(data.plan, 0));
      setSample(data.sample);
      setHook(0);
      setShot(0);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn’t reach the Director. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [brief, takes]);

  const pickHook = (i: number) => {
    setHook(i);
    setPlan((p) => (p ? applyHook(p, i) : p));
  };

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
    takes.forEach((t) => URL.revokeObjectURL(t.url));
    clearProject();
    setTakes([]);
    setKept({});
    setPlan(null);
    setSample(false);
    setHook(0);
    setShot(0);
    setBrief(DEFAULT_BRIEF);
    setError("");
    setStep(1);
  };

  const canVisit = (n: Step) => n === 1 || (plan !== null && (n !== 5 || latestTake !== undefined));

  return (
    <div className={s.app}>
      <header className={s.header}>
        <div className={s.brand}>
          <span className={s.wordmark}>ViralDirector</span>
          {plan && (
            <>
              <span className={s.slash}>/</span>
              <span className={s.projectName}>{brief.concept}</span>
            </>
          )}
        </div>
        <nav className={s.steps} aria-label="Steps">
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
        {plan && <Button variant="ghost" size="sm" onClick={reset}>New video</Button>}
      </header>

      {step === 1 && (
        <ConceptStep
          brief={brief}
          onChange={(patch) => setBrief((b) => ({ ...b, ...patch }))}
          onNext={direct}
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
          onRecord={() => setStep(4)}
          onUpload={addTake}
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
        />
      )}
      {step === 6 && plan && <ExportStep plan={plan} brief={brief} hook={hook} kept={keptTakes} onGoToShot={(i) => { setShot(i); setStep(3); }} />}
    </div>
  );
}
