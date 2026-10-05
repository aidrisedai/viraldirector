import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Icon } from "@/components/ds/Icon";
import type { ChatRequest, ChatResponse } from "@/lib/chat";
import { buildTimeline, FORMATS, MUSIC_STYLES, type FormatKey, type MusicStyle, type SpeechAnalysis } from "@/lib/edit";
import { plannedSeconds, SHOT_TYPE_LABEL, type Brief, type Plan } from "@/lib/plan";
import { exportChecks, scriptText, slug, takeFileName, type Take } from "@/lib/takes";
import { Chips } from "./Chips";
import { analyzeTake } from "./render/analyze";
import { outputType, renderVideo } from "./render/renderVideo";
import { fixDuration } from "./useRecorder";
import s from "./director.module.css";

type Props = { plan: Plan; brief: Brief; hook: number; kept: (Take | undefined)[]; onGoToShot: (i: number) => void };

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

type Render =
  | { state: "idle" }
  | { state: "preparing" }
  | { state: "rendering"; progress: number }
  | { state: "done"; url: string; blob: Blob; mime: string; seconds: number; format: FormatKey }
  | { state: "error"; message: string };

export function ExportStep({ plan, brief, hook, kept, onGoToShot }: Props) {
  const checks = exportChecks(plan, brief, kept);
  const ready = checks.every((c) => c.ok);
  const cut = useMemo(() => kept.flatMap((t, i) => (t ? [{ take: t, shot: plan.shots[i] }] : [])), [kept, plan]);
  const [clip, setClip] = useState(0);
  const current = cut[Math.min(clip, cut.length - 1)];

  const [format, setFormat] = useState<FormatKey>(brief.platform === "LinkedIn" ? "4:5" : "9:16");
  const [music, setMusic] = useState<MusicStyle>("Calm build");
  const [captions, setCaptions] = useState(true);
  const [render, setRender] = useState<Render>({ state: "idle" });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mime = useMemo(() => (typeof window === "undefined" ? null : outputType()), []);

  const [caption, setCaption] = useState("");
  const [captionState, setCaptionState] = useState<"idle" | "loading" | "error">("idle");
  const [captionError, setCaptionError] = useState("");
  const [copied, setCopied] = useState(false);

  // Free the finished video's memory when it's replaced or the page goes away.
  const doneUrl = render.state === "done" ? render.url : null;
  useEffect(() => () => {
    if (doneUrl) URL.revokeObjectURL(doneUrl);
  }, [doneUrl]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const busy = render.state === "preparing" || render.state === "rendering";
  const fileName = (m: string) => `${slug(brief.concept)}-${format.replace(":", "x")}.${m.includes("mp4") ? "mp4" : "webm"}`;

  const create = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRender({ state: "preparing" });
    try {
      const analyses = new Map<string, SpeechAnalysis>();
      for (const { take } of cut) analyses.set(take.id, await analyzeTake(take));
      const segments = buildTimeline(plan, kept, analyses);
      setRender({ state: "rendering", progress: 0 });
      const result = await renderVideo({
        segments,
        format,
        music,
        captions,
        hookTitle: plan.hooks[hook].line.replace(/^[“"]|[”"]$/g, ""),
        canvas: canvasRef.current!,
        onProgress: (progress) => setRender({ state: "rendering", progress }),
        signal: ctrl.signal,
      });
      setRender({ state: "done", url: URL.createObjectURL(result.blob), ...result, format });
    } catch (e) {
      setRender({ state: "error", message: e instanceof Error ? e.message : "Something went wrong while creating your video." });
    }
  };

  const share = async () => {
    if (render.state !== "done") return;
    const file = new File([render.blob], fileName(render.mime), { type: render.blob.type });
    try {
      await navigator.share({ files: [file], title: brief.concept, text: caption || undefined });
    } catch {
      // The person closed the share sheet.
    }
  };
  const canShare =
    render.state === "done" &&
    typeof navigator !== "undefined" &&
    !!navigator.canShare?.({ files: [new File([render.blob], "v.mp4", { type: render.blob.type })] });

  const writeCaption = async () => {
    setCaptionState("loading");
    setCaptionError("");
    const body: ChatRequest = {
      mode: "ask",
      message: `Write the caption for when I post this video on ${brief.platform}: one or two short lines in my voice that make people want to watch, then 3–5 relevant hashtags on a new line. Reply with only the caption text.`,
      history: [],
      context: { brief, plan, hook, step: "Export", shot: null, originalLine: null },
      take: null,
    };
    try {
      const res = await fetch("/api/director", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({ error: "The Director didn’t respond." }))) as ChatResponse;
      if ("error" in data) throw new Error(data.error);
      setCaption(data.reply.trim());
      setCaptionState("idle");
    } catch (e) {
      // Still give the creator something to post.
      setCaption((c) => c || `${plan.hooks[hook].line.replace(/^[“"]|[”"]$/g, "")}\n\n#${brief.goal === "Sell" ? "smallbusiness" : "entrepreneur"} #founder #buildinpublic`);
      setCaptionError(e instanceof Error ? e.message : "Couldn’t reach the Director.");
      setCaptionState("error");
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const downloadTakes = async () => {
    for (const { take, shot } of cut) {
      download(take.url, takeFileName(take, shot));
      await new Promise((r) => setTimeout(r, 400)); // Browsers drop rapid back-to-back downloads.
    }
  };

  const downloadScript = () => {
    const url = URL.createObjectURL(new Blob([scriptText(brief.concept, plan, hook)], { type: "text/plain" }));
    download(url, `${slug(brief.concept)}-script.txt`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const previewFormat = render.state === "done" ? render.format : format;
  const length = render.state === "done" ? render.seconds : plannedSeconds(plan);

  return (
    <main data-screen-label="06 Export" className={s.main}>
      <div className={s.mid}>
        <div className={s.preview} style={{ aspectRatio: previewFormat === "4:5" ? "4 / 5" : "9 / 16" }}>
          <canvas ref={canvasRef} className={s.renderCanvas} hidden={render.state !== "rendering" && render.state !== "preparing"} aria-label="Video being created" />
          {render.state === "done" ? (
            <video key={render.url} className={s.finalVideo} src={render.url} controls playsInline autoPlay />
          ) : busy ? (
            <div className={s.renderOverlay} aria-live="polite">
              {render.state === "preparing" ? "Lining up your takes…" : `Creating your video · ${Math.round(render.progress * 100)}%`}
              <div className={s.scrub}><div style={{ width: `${render.state === "rendering" ? render.progress * 100 : 0}%` }} /></div>
            </div>
          ) : current ? (
            <>
              <video
                key={current.take.id}
                className={s.takeVideo}
                src={current.take.url}
                controls
                playsInline
                onLoadedMetadata={fixDuration}
                onEnded={() => setClip((c) => (c + 1 < cut.length ? c + 1 : 0))}
                autoPlay={clip > 0}
              />
              <span className={s.mediaCaption} style={{ top: 14, left: 16 }}>
                ROUGH CUT · {Math.min(clip, cut.length - 1) + 1} OF {cut.length}
              </span>
            </>
          ) : (
            <div className={s.cameraLabel} style={{ color: "var(--vd-text-muted)" }}>KEEP A TAKE TO SEE YOUR ROUGH CUT</div>
          )}
        </div>

        <div className={s.stack} style={{ gap: 28 }}>
          <div className={s.stack} style={{ gap: 10 }}>
            <Badge tone={render.state === "done" ? "accent" : ready ? "accent" : "warning"} dot={render.state === "done" || ready}>
              {render.state === "done" ? "Your video is ready" : ready ? "Ready to create" : "Not ready yet"}
            </Badge>
            <h1 className={s.exportTitle}>{clock(length)} · {cut.length} {cut.length === 1 ? "shot" : "shots"}</h1>
          </div>

          <div className={s.checks}>
            {checks.map((c) => (
              <div key={c.label} className={s.check}>
                <Icon name={c.ok ? "check" : "x"} size={18} color={c.ok ? "var(--brand-accent)" : "var(--vd-warn-bar)"} />
                {c.label}
              </div>
            ))}
          </div>

          <div className={s.createCard}>
            <div className={s.stack} style={{ gap: 4 }}>
              <span className={s.createTitle}>Create your video</span>
              <span className={s.hint}>
                Your takes in order with dead air trimmed, levels evened out, animated captions, your hook on screen and a music
                bed under your voice. It plays through once while it’s made — keep this tab open.
              </span>
            </div>
            <div className={s.stack} style={{ gap: 8 }}>
              <span className={s.label}>Format</span>
              <Chips label="Format" options={Object.keys(FORMATS) as FormatKey[]} isOn={(f) => f === format} onToggle={setFormat} />
            </div>
            <div className={s.stack} style={{ gap: 8 }}>
              <span className={s.label}>Music</span>
              <Chips label="Music" options={MUSIC_STYLES} isOn={(m) => m === music} onToggle={setMusic} />
            </div>
            <div className={s.stack} style={{ gap: 8 }}>
              <span className={s.label}>Captions</span>
              <Chips label="Captions" options={["On", "Off"] as const} isOn={(c) => (c === "On") === captions} onToggle={(c) => setCaptions(c === "On")} />
            </div>

            {render.state === "error" && <p className={s.error} role="alert">{render.message}</p>}
            {mime && !mime.includes("mp4") && (
              <span className={s.hint}>This browser saves WebM. Instagram needs MP4 — create your video in Chrome, Edge or Safari for MP4.</span>
            )}

            <div className={s.actions}>
              {busy ? (
                <Button variant="outline" size="lg" onClick={() => abortRef.current?.abort()}>Cancel</Button>
              ) : render.state === "done" ? (
                <>
                  <Button size="lg" icon="download" onClick={() => download(render.url, fileName(render.mime))}>Download video</Button>
                  {canShare && <Button variant="secondary" size="lg" icon="share" onClick={share}>Share</Button>}
                  <Button variant="ghost" size="lg" icon="rotate-ccw" onClick={create}>Make again</Button>
                </>
              ) : (
                <Button size="lg" icon="sparkles" onClick={create} disabled={!cut.length || !mime}>
                  Create my video
                </Button>
              )}
            </div>
          </div>

          <div className={s.createCard}>
            <div className={s.stack} style={{ gap: 4 }}>
              <span className={s.createTitle}>Post caption</span>
              <span className={s.hint}>The words that go under your video when you post it.</span>
            </div>
            {caption && (
              <textarea className={s.captionInput} aria-label="Post caption" rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} />
            )}
            {captionState === "error" && <span className={s.hint}>{captionError} Here’s a simple draft to start from.</span>}
            <div className={s.actions}>
              <Button variant={caption ? "outline" : "primary"} size="md" icon="message" onClick={writeCaption} disabled={captionState === "loading"}>
                {captionState === "loading" ? "Writing…" : caption ? "Write another" : "Write my post caption"}
              </Button>
              {caption && <Button variant="ghost" size="md" icon={copied ? "check" : undefined} onClick={copyCaption}>{copied ? "Copied" : "Copy"}</Button>}
            </div>
          </div>

          <div className={s.settings}>
            <div className={s.setting}>
              <span>Hook</span>
              <span className={s.muted}>{plan.hooks[hook].kind}</span>
            </div>
            {plan.shots.map((x, i) => (
              <button key={i} type="button" className={s.setting} onClick={() => onGoToShot(i)}>
                <span>{i + 1}. {x.title}</span>
                <span className={s.settingValue}>
                  {kept[i] ? `${SHOT_TYPE_LABEL[x.type]} · ${kept[i]!.seconds.toFixed(1)}s` : x.required ? "Missing" : "Skipped"}
                  <Icon name="chevron-right" size={18} color="var(--vd-text-muted)" />
                </span>
              </button>
            ))}
          </div>

          <div className={s.actions}>
            <Button variant="ghost" size="sm" icon="download" onClick={downloadTakes} disabled={!cut.length}>
              Raw takes ({cut.length})
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadScript}>Script</Button>
          </div>
        </div>
      </div>
    </main>
  );
}
