import { Fragment, useRef, useState } from "react";
import { Button } from "@/components/ds/Button";
import { aiEligibility, videoPrompt } from "@/lib/aiPrompts";
import { recordingMinutes, SHOT_TYPE_LABEL, type Brief, type Plan } from "@/lib/plan";
import type { Take } from "@/lib/takes";
import { StockSearch } from "./StockSearch";
import { Term } from "./Term";
import { takeFromFile } from "./useRecorder";
import s from "./director.module.css";

type Props = {
  plan: Plan;
  shot: number;
  kept: (Take | undefined)[];
  onPickShot: (i: number) => void;
  onEditLine: (i: number, line: string) => void;
  /** Changes how long a shot should be (recording stops automatically at this length). */
  onEditSeconds: (i: number, seconds: number) => void;
  onRecord: () => void;
  onUpload: (take: Take) => void;
  onAskLine: (shot: number) => void;
  askBusy: boolean;
  brief: Pick<Brief, "concept" | "audience" | "look">;
};

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export function ShotsStep({ plan, shot, kept, onPickShot, onEditLine, onEditSeconds, onRecord, onUpload, onAskLine, askBusy, brief }: Props) {
  const detailRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const total = plan.shots.length;
  const recorded = kept.filter(Boolean).length;
  const requiredLeft = plan.shots.filter((x, i) => x.required && !kept[i]).length;
  const cur = plan.shots[shot];

  const ai = aiEligibility(cur);
  const prompt = ai.ok ? videoPrompt(cur, brief) : "";
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const upload = async (file: File | undefined, origin?: "ai") => {
    setUploadError("");
    if (!file) return;
    if (!file.type.startsWith("video/")) return setUploadError("Choose a video file.");
    if (file.size > MAX_UPLOAD_BYTES) return setUploadError("That clip is over 500 MB. Trim it and try again.");
    try {
      const take = await takeFromFile(file, shot);
      onUpload(origin ? { ...take, origin } : take);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Couldn’t read that clip.");
    }
  };

  return (
    <main data-screen-label="03 Shot list" className={s.main}>
      <div className={`${s.wide} ${s.stack}`} style={{ gap: 32 }}>
        <div className={s.shotsHead}>
          <div className={s.stack} style={{ gap: 10 }}>
            <span className={s.eyebrow}>CALL SHEET</span>
            <h1 className={s.h1}>{total} shots · about {recordingMinutes(plan)} minutes</h1>
            <span style={{ fontSize: 16, color: "var(--vd-text-body)" }}>Grouped by where you’ll film, not story order.</span>
          </div>
          <div className={s.progress}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span>{recorded} of {total} recorded</span>
              <span className={s.muted}>{requiredLeft ? `${requiredLeft} required left` : "All required done"}</span>
            </div>
            <div className={s.track}>
              <div className={s.fill} style={{ width: `${Math.round((recorded / total) * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className={s.shotsGrid}>
          <div className={s.stack} style={{ gap: 12 }}>
            {plan.shots.map((x, i) => (
              <Fragment key={i}>
                {x.location !== plan.shots[i - 1]?.location && <span className={s.eyebrowMuted}>{x.location.toUpperCase()}</span>}
                <button
                  type="button"
                  aria-pressed={i === shot}
                  className={`${s.shot} ${i === shot ? s.shotOn : ""}`}
                  onClick={() => {
                    onPickShot(i);
                    setEditing(false);
                    setUploadError("");
                    // On phones the details sit below the list: bring them (and the Record button) into view.
                    if (window.matchMedia("(max-width: 820px)").matches) {
                      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                    }
                  }}
                >
                  <span className={`${s.shotMark} ${kept[i] ? s.shotMarkDone : ""}`} aria-label={kept[i] ? "Recorded" : undefined}>{i + 1}</span>
                  <span className={s.stack} style={{ gap: 2 }}>
                    <span className={s.shotTitle}>{x.title}</span>
                    <span className={s.small}>{SHOT_TYPE_LABEL[x.type]} · {x.size} · {x.seconds}s{kept[i]?.origin === "ai" ? " · AI-made" : kept[i]?.origin === "stock" ? " · Stock" : ""}</span>
                  </span>
                  <span className={s.tiny}>{x.required ? "" : "Optional"}</span>
                </button>
              </Fragment>
            ))}
          </div>

          <div className={s.detail} ref={detailRef} style={{ scrollMarginTop: 96 }}>
            <div className={s.stack} style={{ gap: 8 }}>
              <span className={s.eyebrow}>
                SHOT {shot + 1} · <Term word={SHOT_TYPE_LABEL[cur.type]}>{SHOT_TYPE_LABEL[cur.type].toUpperCase()}</Term> ·{" "}
                <Term word={cur.size}>{cur.size.toUpperCase()}</Term>
              </span>
              <h2 className={s.h2}>{cur.title}</h2>
            </div>
            <div className={s.specs}>
              <div className={s.spec}><span className={s.small}><Term word="Framing" /></span><span>{cur.framing}</span></div>
              <div className={s.spec}><span className={s.small}><Term word="Lighting" /></span><span>{cur.lighting}</span></div>
              <div className={s.spec}><span className={s.small}><Term word="Delivery" /></span><span>{cur.delivery}</span></div>
              <div className={s.spec}>
                <span className={s.small}>Duration</span>
                <span className={s.secondsRow}>
                  <button type="button" className={s.secondsBtn} onClick={() => onEditSeconds(shot, Math.max(1, cur.seconds - 1))} disabled={cur.seconds <= 1} aria-label="One second shorter">−</button>
                  <span className={s.secondsVal} aria-live="polite">{cur.seconds}s</span>
                  <button type="button" className={s.secondsBtn} onClick={() => onEditSeconds(shot, Math.min(30, cur.seconds + 1))} disabled={cur.seconds >= 30} aria-label="One second longer">+</button>
                </span>
                {(() => {
                  // People say about 2.6 words a second on short-form video.
                  const words = cur.line.trim() ? cur.line.trim().split(/\s+/).length : 0;
                  const needs = Math.ceil(words / 2.6);
                  return words > 0 && needs > cur.seconds ? (
                    <span className={s.tiny} style={{ color: "var(--status-warning-fg)" }}>The line needs about {needs}s to say</span>
                  ) : null;
                })()}
              </div>
            </div>
            <div className={s.lineBlock}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={s.small}>Line</span>
                <Button variant="ghost" size="sm" icon={editing ? "check" : "pencil"} onClick={() => setEditing((e) => !e)}>
                  {editing ? "Done" : "Edit line"}
                </Button>
              </div>
              {editing ? (
                <textarea
                  className={s.lineInput}
                  aria-label="Line"
                  value={cur.line}
                  maxLength={400}
                  rows={3}
                  onChange={(e) => onEditLine(shot, e.target.value)}
                  autoFocus
                />
              ) : (
                <span className={s.serifLine}>{cur.line || <span className={s.muted}>No line — {cur.delivery}</span>}</span>
              )}
              <div>
                <Button variant="outline" size="sm" icon="message" onClick={() => onAskLine(shot)} disabled={askBusy}>
                  {editing ? "Ask the Director about my edit" : "Ask the Director about this line"}
                </Button>
              </div>
            </div>
            <div className={s.actions}>
              <Button size="lg" icon="video" onClick={onRecord}>{kept[shot] ? "Record again" : "Record this shot"}</Button>
              <Button variant="outline" size="lg" icon="upload" onClick={() => fileRef.current?.click()}>Upload a clip</Button>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => {
                  upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            {uploadError && <p className={s.error} role="alert">{uploadError}</p>}
            {(cur.type === "b-roll" || cur.type === "insert") && (
              <details className={s.aiPanel} key={shot}>
                <summary>Can’t film this? Use stock or AI</summary>
                {ai.ok ? (
                  <div className={s.stack} style={{ gap: 20 }}>
                  <StockSearch key={shot} shot={shot} title={cur.title} onPick={onUpload} />
                  <div className={s.stack} style={{ gap: 12 }}>
                    <span className={s.label}>Make it with AI</span>
                    <span className={s.hint}>
                      Paste this into a text-to-video tool (Sora, Veo, Runway, Kling and the like), download the clip, then upload it
                      here. It’s marked as AI-made so you remember to label it when you post.
                    </span>
                    <textarea className={s.promptBox} readOnly rows={9} value={prompt} aria-label="AI video prompt" onFocus={(e) => e.currentTarget.select()} />
                    <div className={s.actions}>
                      <Button variant="outline" size="sm" icon={copied ? "check" : undefined} onClick={copyPrompt}>{copied ? "Copied" : "Copy prompt"}</Button>
                      <Button variant="outline" size="sm" icon="upload" onClick={() => aiFileRef.current?.click()}>Upload the AI clip</Button>
                      <input
                        ref={aiFileRef}
                        type="file"
                        accept="video/*"
                        hidden
                        onChange={(e) => {
                          upload(e.target.files?.[0], "ai");
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>
                  </div>
                ) : (
                  <span className={s.hint}>{ai.reason}</span>
                )}
              </details>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
