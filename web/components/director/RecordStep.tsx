import { useEffect } from "react";
import { Button } from "@/components/ds/Button";
import { Icon } from "@/components/ds/Icon";
import { SHOT_TYPE_LABEL, type Plan } from "@/lib/plan";
import type { Take } from "@/lib/takes";
import { Term } from "./Term";
import { useRecorder } from "./useRecorder";
import s from "./director.module.css";

type Props = { plan: Plan; shot: number; onTake: (t: Take) => void; onBack: () => void };

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** Splits the line into spoken / current / upcoming words as the take progresses. */
function prompterParts(line: string, progress: number): [string, string, string] {
  const words = line.split(/\s+/).filter(Boolean);
  const spoken = Math.min(words.length, Math.floor(progress * words.length));
  const current = Math.min(words.length, spoken + 4);
  const join = (a: number, b: number) => words.slice(a, b).join(" ");
  return [join(0, spoken), join(spoken, current), join(current, words.length)];
}

export function RecordStep({ plan, shot, onTake, onBack }: Props) {
  const cur = plan.shots[shot];
  const total = cur.seconds;
  const { videoRef, phase, error, count, elapsed: rawElapsed, start, stop, retryCamera } = useRecorder({ shot, seconds: total, onTake });
  const recording = phase === "recording";
  const elapsed = Math.min(rawElapsed, total);
  const upNext = plan.shots.map((x, i) => ({ ...x, n: i + 1 })).slice(shot + 1, shot + 3);
  const [spoken, current, upcoming] = prompterParts(cur.line, recording ? elapsed / total : 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || (e.target as HTMLElement).closest("button, textarea, input")) return;
      e.preventDefault();
      if (phase === "ready") start();
      else stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, start, stop]);

  const directions = [
    { icon: "scan-face" as const, text: cur.framing },
    { icon: "sun" as const, text: cur.lighting },
    { icon: "zap" as const, text: cur.delivery },
  ];

  return (
    <main data-screen-label="04 Record" className={s.record} data-phase={phase}>
      <div className={`${s.stack} ${s.recInfo}`} style={{ gap: 20 }}>
        <div className={`${s.stack} ${s.recTitle}`} style={{ gap: 8 }}>
          <span className={s.eyebrowDark}>SHOT {shot + 1} OF {plan.shots.length} · {SHOT_TYPE_LABEL[cur.type].toUpperCase()}</span>
          <h2 className={s.h2}>{cur.title}</h2>
        </div>
        <div className={s.directions}>
          {directions.map((d) => (
            <div key={d.icon} className={s.direction}>
              <Icon name={d.icon} size={18} color="var(--vd-on-dark-accent)" />
              {d.text}
            </div>
          ))}
        </div>
        {upNext.length > 0 && (
          <div className={`${s.stack} ${s.recUpNext}`} style={{ gap: 6 }}>
            <span className={s.darkMuted}>Up next</span>
            {upNext.map((x) => (
              <div key={x.n} className={s.upNext}>
                <span style={{ color: "var(--vd-on-dark-muted)" }}>{x.n}</span>
                {x.title} · {SHOT_TYPE_LABEL[x.type]} · {x.seconds}s
              </div>
            ))}
          </div>
        )}
        <div className={s.recBack}>
          <Button variant="outline" tone="dark" size="sm" onClick={onBack} disabled={recording}>
            <span className={s.wideOnly}>Back to shot list</span><span className={s.narrowOnly}>Shots</span>
          </Button>
        </div>
      </div>

      <div className={s.cameraWrap}>
        <div className={s.camera}>
          <video ref={videoRef} className={s.cameraFeed} autoPlay muted playsInline />
          {phase !== "ready" && phase !== "recording" && phase !== "countdown" && (
            <div className={s.cameraLabel}>
              {phase === "starting" ? "STARTING CAMERA…" : phase === "saving" ? "SAVING TAKE…" : (
                <div className={s.cameraError} role="alert">
                  <span>{error}</span>
                  <Button variant="outline" tone="dark" size="sm" onClick={retryCamera}>Try again</Button>
                </div>
              )}
            </div>
          )}
          <div className={s.gridV} style={{ left: "33.3%" }} />
          <div className={s.gridV} style={{ left: "66.6%" }} />
          <div className={s.gridH} style={{ top: "33.3%" }} />
          <div className={s.gridH} style={{ top: "66.6%" }} />
          <div className={s.eyeLine} />
          <span className={s.eyeLineLabel}><Term word="Eye line" dark>EYE LINE</Term></span>
          <div className={s.safeZone}><Term word="Caption safe zone" dark>CAPTION SAFE ZONE</Term></div>
          {phase === "countdown" && <div className={s.countdown} aria-live="assertive">{count}</div>}
          <div className={s.timer}>
            <span className={s.recDot} style={{ opacity: recording ? 1 : 0.35 }} />
            {clock(elapsed)} / {clock(total)}
          </div>
          <div className={s.recProgress} style={{ width: `${(elapsed / total) * 100}%` }} />
        </div>
      </div>

      <div className={`${s.stack} ${s.recControls}`} style={{ gap: 20 }}>
        <span className={`${s.darkMuted} ${s.wideOnly}`}>Teleprompter</span>
        <div className={s.prompter}>
          {cur.line ? (
            <>
              <span className={s.spoken}>{spoken}</span> {current} <span className={s.upcoming}>{upcoming}</span>
            </>
          ) : (
            <span className={s.upcoming}>No line for this shot. {cur.delivery}</span>
          )}
        </div>
        <div className={s.stopRow}>
          <button
            type="button"
            className={s.stop}
            onClick={phase === "ready" ? start : stop}
            disabled={phase === "starting" || phase === "saving" || phase === "error"}
            aria-label={phase === "ready" ? "Start recording" : phase === "countdown" ? "Cancel countdown" : "Stop recording"}
          >
            <span className={phase === "ready" ? s.recStart : s.recStop} />
          </button>
          <span className={s.recClock}>{clock(elapsed)} / {clock(total)}</span>
          <span className={s.stopHint}>
            {phase === "ready" ? (
              <>Starts after a 3-second countdown.<br />Press space to start.</>
            ) : (
              <>Stops automatically at {total}s.<br />Press space to stop early.</>
            )}
          </span>
        </div>
      </div>
    </main>
  );
}
