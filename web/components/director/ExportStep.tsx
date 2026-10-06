import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Icon } from "@/components/ds/Icon";
import type { ChatRequest, ChatResponse } from "@/lib/chat";
import { buildTimeline, FORMATS, type FormatKey, type Segment, type SpeechAnalysis } from "@/lib/edit";
import {
  applyTrims, composeEdit, EXTRAS_MAX, fallbackPlan, LOOKS, normalizePlan, timelineForDirector,
  type EditPlan, type EditRequest, type EditResponse, type Extra, type Look, type Style,
} from "@/lib/editPlan";
import { toSrt } from "@/lib/srt";
import { AI_LABEL_NOTE } from "@/lib/aiPrompts";
import { reviseLocally } from "@/lib/revise";
import { plannedSeconds, SHOT_TYPE_LABEL, type Brief, type Plan } from "@/lib/plan";
import { exportChecks, scriptText, slug, takeFileName, type Take } from "@/lib/takes";
import { Chips } from "./Chips";
import { Editor } from "./editor/Editor";
import { COMPACT, useMediaQuery } from "./useMediaQuery";
import { CaptionsCard } from "./export/CaptionsCard";
import { ExtrasCard } from "./export/ExtrasCard";
import { ImproveCard } from "./export/ImproveCard";
import { LookControls } from "./export/LookControls";
import type { ExportState } from "./export/useExportState";
import { extraFromFile, extraThumb } from "./render/media";
import { analyzeTake } from "./render/analyze";
import { generatedTrack, type MusicTrack } from "./render/musicTrack";
import { END_CARD_SECONDS, outputType, renderVideo } from "./render/renderVideo";
import s from "./director.module.css";

type Props = {
  plan: Plan;
  brief: Brief;
  hook: number;
  kept: (Take | undefined)[];
  onGoToShot: (i: number) => void;
  finish: ExportState;
  /** Called with the finished file, so it can be recorded in the creator's history. */
  onExported?: (result: { blob: Blob; seconds: number; format: string }) => void;
  onPostCaption?: (caption: string) => void;
};

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
  | { state: "error"; message: string };

/** A finished file, one per version. */
type Done = { url: string; blob: Blob; mime: string; seconds: number; format: FormatKey };

export function ExportStep({ plan, brief, hook, kept, onGoToShot, finish, onExported, onPostCaption }: Props) {
  const checks = exportChecks(plan, brief, kept);
  const ready = checks.every((c) => c.ok);
  const cut = useMemo(() => kept.flatMap((t, i) => (t ? [{ take: t, shot: plan.shots[i] }] : [])), [kept, plan]);

  const [format, setFormat] = useState<FormatKey>(brief.platform === "LinkedIn" ? "4:5" : "9:16");
  const [render, setRender] = useState<Render>({ state: "idle" });
  // Phones get a full-screen editor that opens on arrival.
  const compact = useMediaQuery(COMPACT);
  const [editorOpen, setEditorOpen] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mime = useMemo(() => (typeof window === "undefined" ? null : outputType()), []);

  const [caption, setCaption] = useState("");
  const [captionState, setCaptionState] = useState<"idle" | "loading" | "error">("idle");
  const [captionError, setCaptionError] = useState("");
  const [copied, setCopied] = useState(false);
  // Keep the saved video's caption in step with what's written here.
  useEffect(() => {
    if (!caption || !onPostCaption) return;
    const id = setTimeout(() => onPostCaption(caption), 1000);
    return () => clearTimeout(id);
  }, [caption, onPostCaption]);

  const [results, setResults] = useState<Partial<Record<Look, Done>>>({});
  const done = results[finish.version];
  // Free the finished videos' memory when the page goes away (a replaced one is freed as it's replaced).
  const resultsRef = useRef(results);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);
  useEffect(() => () => {
    abortRef.current?.abort();
    Object.values(resultsRef.current).forEach((r) => r && URL.revokeObjectURL(r.url));
  }, []);

  const busy = render.state === "preparing" || render.state === "rendering";
  // Open on the edit style chosen at the start, until there's an edit to look at.
  const { setVersion } = finish;
  const anyPlan = Object.values(finish.versions).some((v) => v.editPlan);
  useEffect(() => {
    if (!anyPlan) setVersion(brief.look);
  }, [anyPlan, brief.look, setVersion]);
  const hookTitle = plan.hooks[hook].line.replace(/^[“"]|[”"]$/g, "");
  const signature = kept.map((t) => t?.id ?? "-").join(",");
  const planStale = !!finish.editPlan && finish.editPlan.signature !== signature;
  const speaking = cut.flatMap(({ take, shot }) => (shot.line.trim() ? [{ take, shot, index: take.shot }] : []));

  /** The timeline as it stands: exact transcripts and caption edits applied. */
  const currentTimeline = async (edits: Record<string, string> = finish.captionEdits) => {
    const withExact = kept.map((t) => {
      const ex = t && finish.exact[t.id];
      return t && ex ? { ...t, transcript: ex.text, words: ex.words } : t;
    });
    const analyses = new Map<string, SpeechAnalysis>();
    for (const { take } of cut) analyses.set(take.id, await analyzeTake(take));
    return buildTimeline(plan, withExact, analyses, edits);
  };

  // Clips that aren't the creator's own footage say so, so the Director never presents them as real.
  const shotTitles = plan.shots.map((x, i) =>
    kept[i]?.origin === "ai" ? `${x.title} (AI-made illustration)` : kept[i]?.origin === "stock" ? `${x.title} (stock footage)` : x.title,
  );
  const aiClips = cut.filter(({ take }) => take.origin === "ai").length;
  const musicKind = finish.music === "No music" ? "none" : finish.music === "My music" ? "custom" : "generated";

  // The editor's timeline: rebuilt when takes, exact captions or caption edits change.
  const [timeline, setTimeline] = useState<Segment[] | null>(null);
  useEffect(() => {
    let live = true;
    currentTimeline().then((t) => live && setTimeline(t));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentTimeline reads exactly these
  }, [signature, finish.exact, finish.captionEdits, plan]);

  // What the editor shows: the current edit (Director's, built-in, or the creator's own).
  const editorPlan = useMemo(() => {
    if (!timeline) return null;
    if (finish.editPlan && !planStale) return finish.editPlan.plan;
    return normalizePlan(fallbackPlan(timeline, finish.extras), timeline, finish.extras);
  }, [timeline, finish.editPlan, planStale, finish.extras]);

  const { setEditPlan, setExtras, setCaptionEdits } = finish;
  const onHandEdit = useCallback((p: EditPlan) => setEditPlan({ plan: p, signature, source: "manual" }), [setEditPlan, signature]);

  /** Files dropped or picked in the editor become extra content (and are placed by the editor). */
  const addFiles = async (files: File[]) => {
    // Freeze the current edit so the built-in edit doesn't also place the new items.
    if (editorPlan && (!finish.editPlan || planStale)) onHandEdit(editorPlan);
    const room = EXTRAS_MAX - finish.extras.length;
    if (room <= 0) throw new Error(`You can add up to ${EXTRAS_MAX} items.`);
    const added: Extra[] = [];
    for (const file of files.slice(0, room)) {
      const limit = file.type.startsWith("video/") ? 300 * 1024 * 1024 : 25 * 1024 * 1024;
      if (file.size > limit) throw new Error(`${file.name} is too large (max ${Math.round(limit / 1024 / 1024)} MB).`);
      added.push(await extraFromFile(file));
    }
    setExtras((all) => [...all, ...added]);
    return added;
  };
  const onCaption = useCallback((takeId: string, text: string) => setCaptionEdits((prev) => ({ ...prev, [takeId]: text })), [setCaptionEdits]);

  /** Sends the timeline (and, for a revision, the current edit and feedback) to the Director, for one version. */
  const requestEdit = async (
    timeline: Segment[],
    feedback: string,
    current: EditPlan | null,
    look: Look = finish.version,
  ): Promise<{ data: EditResponse; status: number }> => {
    const v = finish.versions[look];
    const body: EditRequest = {
      // The Director sees clips as the creator trimmed them.
      timeline: timelineForDirector(applyTrims(timeline, current?.trims ?? []), shotTitles, current && { ...current, trims: [] }),
      extras: await Promise.all(
        finish.extras.map(async (e) => ({ id: e.id, kind: e.kind, seconds: e.seconds, note: e.note, thumb: await extraThumb(e) })),
      ),
      notes: finish.notes,
      brand: finish.brand,
      concept: brief.concept,
      platform: brief.platform,
      audience: brief.audience,
      hook: hookTitle,
      look,
      style: v.style,
      music: musicKind,
      current,
      feedback,
      history: v.revisions.slice(-6),
    };
    try {
      const res = await fetch("/api/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({ error: "The Director didn’t respond." }))) as EditResponse;
      return { data, status: res.status };
    } catch {
      return { data: { error: "Couldn’t reach the Director." }, status: 0 };
    }
  };

  /** Caption corrections from the Director, keyed by take like the creator's own edits. */
  const withFixes = (timeline: Segment[], p: EditPlan) => {
    const edits = { ...finish.captionEdits };
    for (const f of p.captionFixes) {
      const seg = timeline[f.segment];
      if (seg) edits[seg.take.id] = f.text;
    }
    return edits;
  };

  /** The Director edits the video once per version (Standard, Editorial, Cinematic), in parallel. */
  const askForEdit = async (): Promise<string> => {
    if (!cut.length) return "Keep at least one take first.";
    const timeline = await currentTimeline();
    const replies = await Promise.all(LOOKS.map((look) => requestEdit(timeline, "", null, look)));
    let fixes: EditPlan[] = [];
    let problem = "";
    replies.forEach(({ data, status }, i) => {
      const look = LOOKS[i];
      if ("error" in data) {
        const plan = normalizePlan(fallbackPlan(timeline, finish.extras), timeline, finish.extras);
        finish.update(look, () => ({ editPlan: { plan, signature, source: "builtin" }, revisions: [] }));
        problem ||= `${data.error}${status === 503 ? "" : " Using the built-in edit for now."}`;
        return;
      }
      const p = normalizePlan(data.plan, timeline, finish.extras);
      finish.update(look, () => ({ editPlan: { plan: p, signature, source: "director" }, style: data.style, revisions: [] }));
      if (p.captionFixes.length) fixes = look === finish.version ? [...fixes, p] : [p, ...fixes];
    });
    // Caption fixes are shared by both versions; the one on screen has the last word.
    if (fixes.length) finish.setCaptionEdits(fixes.reduce((edits, p) => ({ ...edits, ...withFixes(timeline, p) }), finish.captionEdits));
    return problem;
  };

  /** After watching the video: re-edit from the creator's feedback, then make the video again. */
  const improve = async (feedback: string): Promise<string> => {
    if (!cut.length) return "Keep at least one take first.";
    const look = finish.version;
    const timeline = await currentTimeline();
    const current = finish.editPlan && !planStale ? finish.editPlan.plan : normalizePlan(fallbackPlan(timeline, finish.extras), timeline, finish.extras);
    const { data, status } = await requestEdit(timeline, feedback, current, look);
    let next: EditPlan, style: Style, summary: string, source: "director" | "builtin" | "manual";
    let note = "";
    if ("error" in data) {
      // Without the Director, the built-in rules still handle the look and the music.
      const local = reviseLocally(feedback, finish.style, current);
      if (!local.changes.length) {
        const why = status === 503 ? "The Director isn’t connected, so only the built-in editor can help." : data.error;
        return `${why} It can change the captions, motion, title and music level — try “bigger captions, quieter music”.`;
      }
      next = local.plan;
      style = local.style;
      const list = local.changes.join(", ");
      summary = `${list.charAt(0).toUpperCase()}${list.slice(1)}.`;
      source = finish.editPlan && !planStale ? finish.editPlan.source : "builtin";
      if (status !== 503) note = `${data.error} Made the changes the built-in editor understands.`;
    } else {
      // Trims are the creator's call; the Director's revision keeps them.
      next = normalizePlan({ ...data.plan, trims: current.trims }, timeline, finish.extras);
      style = data.style;
      summary = next.summary || "Updated the edit.";
      source = "director";
    }
    const edits = withFixes(timeline, next);
    finish.update(look, (v) => ({ editPlan: { plan: next, signature, source }, style, revisions: [...v.revisions, { feedback, summary }] }));
    finish.setCaptionEdits(edits);
    return note;
  };

  const fileName = (m: string, look: Look = finish.version) =>
    `${slug(brief.concept)}${look === "Editorial" ? "-editorial" : ""}-${format.replace(":", "x")}.${m.includes("mp4") ? "mp4" : "webm"}`;

  /** The edit as it would be exported now, for the version on screen. */
  const composed = async (edits?: Record<string, string>, plan?: EditPlan) => {
    const timeline = await currentTimeline(edits);
    // The Director's edit if it matches these takes; otherwise the built-in one.
    const chosen = plan ?? (finish.editPlan && !planStale ? finish.editPlan.plan : fallbackPlan(timeline, finish.extras));
    return composeEdit(timeline, normalizePlan(chosen, timeline, finish.extras, { strict: false }));
  };

  /** Captions as an SRT file, timed to the finished video. */
  const downloadSrt = async () => {
    const edit = await composed();
    const url = URL.createObjectURL(new Blob([toSrt(edit)], { type: "application/x-subrip" }));
    download(url, `${slug(brief.concept)}${finish.version === "Editorial" ? "-editorial" : ""}-captions.srt`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /** Makes the video; `over` carries a fresh revision before its state has landed. */
  const create = async (over: { plan?: EditPlan; style?: Style; edits?: Record<string, string> } = {}) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRender({ state: "preparing" });
    const look = finish.version;
    try {
      const edit = await composed(over.edits, over.plan);
      const seconds = edit.sequence.reduce((t, x) => t + (x.to - x.from), 0) + (finish.brand ? END_CARD_SECONDS : 0);
      let track: MusicTrack | null = null;
      if (finish.music === "My music") {
        if (!finish.customMusic) throw new Error("Choose a song for “My music”, or pick another music option.");
        track = finish.customMusic;
      } else track = await generatedTrack(finish.music, seconds);
      setRender({ state: "rendering", progress: 0 });
      const result = await renderVideo({
        edit,
        extras: finish.extras,
        brand: finish.brand,
        format,
        music: track,
        style: over.style ?? finish.style,
        hookTitle,
        canvas: canvasRef.current!,
        onProgress: (progress) => setRender({ state: "rendering", progress }),
        signal: ctrl.signal,
      });
      const fresh: Done = { url: URL.createObjectURL(result.blob), ...result, format };
      setResults((all) => {
        if (all[look]) URL.revokeObjectURL(all[look].url);
        return { ...all, [look]: fresh };
      });
      setRender({ state: "idle" });
      onExported?.({ blob: result.blob, seconds: result.seconds, format });
    } catch (e) {
      setRender({ state: "error", message: e instanceof Error ? e.message : "Something went wrong while creating your video." });
    }
  };

  const share = async () => {
    if (!done) return;
    const file = new File([done.blob], fileName(done.mime), { type: done.blob.type });
    try {
      await navigator.share({ files: [file], title: brief.concept, text: caption || undefined });
    } catch {
      // The person closed the share sheet.
    }
  };
  const canShare =
    !!done &&
    typeof navigator !== "undefined" &&
    !!navigator.canShare?.({ files: [new File([done.blob], "v.mp4", { type: done.blob.type })] });

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

  const length = done ? done.seconds : plannedSeconds(plan);
  const other = LOOKS.find((l) => l !== finish.version)!;
  const otherDone = results[other];
  const exporting = render.state === "rendering" ? render.progress : render.state === "preparing" ? 0 : null;
  const formatChips = (
    <div className={s.stack} style={{ gap: 8 }}>
      <span className={s.label}>Format</span>
      <Chips label="Format" options={Object.keys(FORMATS) as FormatKey[]} isOn={(f) => f === format} onToggle={setFormat} />
    </div>
  );

  /** Making the file: progress, the result, download and share. Shared by the page and the phone editor's sheet. */
  const exportControls = (
    <>
      {done && !busy && (
        <video key={done.url} className={s.exportResult} src={done.url} controls playsInline style={{ aspectRatio: done.format === "4:5" ? "4 / 5" : "9 / 16" }} />
      )}
      {busy && (
        <div className={s.stack} style={{ gap: 6 }} aria-live="polite">
          <span className={s.hint}>{render.state === "preparing" ? "Lining up your clips…" : `Making your video · ${Math.round(render.progress * 100)}%`}</span>
          <div className={s.scrubLight}><div style={{ width: `${render.state === "rendering" ? render.progress * 100 : 0}%` }} /></div>
        </div>
      )}
      {render.state === "error" && <p className={s.error} role="alert">{render.message}</p>}
      {aiClips > 0 && <p className={s.hint} role="note"><strong>AI label:</strong> {AI_LABEL_NOTE}</p>}
      {mime && !mime.includes("mp4") && (
        <span className={s.hint}>This browser saves WebM. Instagram needs MP4 — create your video in Chrome, Edge or Safari for MP4.</span>
      )}
      <div className={s.actions}>
        {busy ? (
          <Button variant="outline" size="lg" onClick={() => abortRef.current?.abort()}>Cancel</Button>
        ) : done ? (
          <>
            {canShare && <Button size="lg" icon="share" onClick={share}>Share</Button>}
            <Button variant={canShare ? "secondary" : "primary"} size="lg" icon="download" onClick={() => download(done.url, fileName(done.mime))}>Download video</Button>
            <Button variant="ghost" size="lg" icon="rotate-ccw" onClick={() => create()}>Export again</Button>
          </>
        ) : (
          <Button size="lg" icon="download" onClick={() => create()} disabled={!cut.length || !mime}>
            Export the {finish.version} version
          </Button>
        )}
      </div>
      <div className={s.actions}>
        <Button variant="ghost" size="sm" icon="download" onClick={downloadSrt} disabled={!cut.length || busy}>Captions (.srt)</Button>
        {otherDone && !busy && (
          <Button variant="ghost" size="sm" icon="download" onClick={() => download(otherDone.url, fileName(otherDone.mime, other))}>
            {other} version
          </Button>
        )}
      </div>
    </>
  );

  const postCaption = (
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
  );

  const editor = cut.length ? (
    <Editor
      timeline={timeline}
      plan={editorPlan}
      onPlan={onHandEdit}
      state={finish}
      format={format}
      hookTitle={hookTitle}
      shotTitles={shotTitles}
      onAddFiles={addFiles}
      onCaption={onCaption}
      exporting={exporting}
      compact={compact}
      onClose={() => setEditorOpen(false)}
      sheets={{
        captions: (
          <>
            <LookControls state={finish} hookTitle={hookTitle} disabled={busy} only={["captions"]} />
            <CaptionsCard clips={speaking} state={finish} />
          </>
        ),
        style: (
          <>
            {formatChips}
            <LookControls state={finish} hookTitle={hookTitle} disabled={busy} only={["motion", "title", "brand"]} />
          </>
        ),
        music: <LookControls state={finish} hookTitle={hookTitle} disabled={busy} only={["music"]} />,
        director: (
          <>
            <ImproveCard onImprove={improve} busy={busy} revisions={finish.revisions} />
            <ExtrasCard state={finish} onPlan={askForEdit} planStale={planStale} />
          </>
        ),
        export: (
          <>
            <span className={s.hint}>Makes the file exactly as the preview plays it — 1080p, ready to post. Keep this screen on while it’s made.</span>
            {exportControls}
            {postCaption}
          </>
        ),
      }}
    />
  ) : (
    <div className={s.createCard}>
      <span className={s.hint}>Keep at least one take to start editing your video.</span>
    </div>
  );

  return (
    <main data-screen-label="06 Export" className={s.main}>
      {/* The export draws here at full size; kept outside any sheet so it's always available. */}
      <canvas ref={canvasRef} className={s.exportCanvas} aria-hidden />
      <div className={s.exportWrap}>
        <div className={s.exportHead}>
          <div className={s.stack} style={{ gap: 10 }}>
            <Badge tone={done ? "accent" : ready ? "accent" : "warning"} dot={!!done || ready}>
              {done ? `${finish.version} version ready` : ready ? "Edit, then export" : "Not ready yet"}
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
        </div>

        {compact ? (
          <>
            {editorOpen && editor}
            {cut.length > 0 && (
              <button type="button" className={s.openEditor} onClick={() => setEditorOpen(true)}>
                <span className={s.openEditorIcon}><Icon name="play" size={22} /></span>
                <span className={s.stack} style={{ gap: 2, alignItems: "flex-start" }}>
                  <span className={s.createTitle}>{done ? "Edit again" : "Open the editor"}</span>
                  <span className={s.hint}>Preview, add pictures and text, set the music, then export.</span>
                </span>
                <Icon name="chevron-right" size={20} />
              </button>
            )}
            {done && <div className={s.createCard}>{exportControls}</div>}
          </>
        ) : (
          editor
        )}

        <div className={s.mid}>
        <div className={s.stack} style={{ gap: 28 }}>
          {!compact && (
            <div className={s.createCard}>
              <div className={s.stack} style={{ gap: 4 }}>
                <span className={s.createTitle}>Export</span>
                <span className={s.hint}>
                  Makes the file exactly as the preview plays it — 1080p, ready to post. It plays through once while it’s made, so
                  keep this tab open.
                </span>
              </div>
              {formatChips}
              <LookControls state={finish} hookTitle={hookTitle} disabled={busy} />
              {exportControls}
            </div>
          )}
          {postCaption}
        </div>

        <div className={s.stack} style={{ gap: 28 }}>
          {!compact && <ImproveCard onImprove={improve} busy={busy} revisions={finish.revisions} />}
          {!compact && <CaptionsCard clips={speaking} state={finish} />}
          {!compact && <ExtrasCard state={finish} onPlan={askForEdit} planStale={planStale} />}

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
      </div>
    </main>
  );
}
