import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { captionText } from "@/lib/edit";
import type { Shot } from "@/lib/plan";
import type { Take } from "@/lib/takes";
import { serverTranscription, transcribe, type TranscribeProgress } from "../transcribe/transcribe";
import type { ExportState } from "./useExportState";
import s from "../director.module.css";

type Clip = { take: Take; shot: Shot; index: number };
type Props = { clips: Clip[]; state: ExportState };

const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Caption text per talking clip: what was actually said, editable, with exact timing on request. */
export function CaptionsCard({ clips, state }: Props) {
  const { captionEdits, setCaptionEdits, exact, setExact } = state;
  const [progress, setProgress] = useState<TranscribeProgress | null>(null);
  const [error, setError] = useState("");
  const [onServer, setOnServer] = useState(false);
  const autoRan = useRef(new Set<string>());

  const run = async (only?: Clip[]) => {
    const targets = only ?? clips;
    if (!targets.length) return;
    setError("");
    setProgress(onServer ? { phase: "transcribe", done: 0, total: targets.length, where: "server" } : { phase: "download", fraction: 0 });
    try {
      const prompts = Object.fromEntries(targets.map((c) => [c.take.id, c.shot.line]));
      const results = await transcribe(targets.map((c) => c.take), prompts, setProgress);
      setExact((prev) => ({ ...prev, ...Object.fromEntries(results) }));
      // Exact text replaces earlier edits for these clips; the creator can still fix any word.
      setCaptionEdits((prev) => {
        const next = { ...prev };
        for (const id of results.keys()) delete next[id];
        return next;
      });
    } catch (e) {
      setError(
        `Exact captions couldn’t run: ${e instanceof Error ? e.message : "unknown error"}.` +
          (onServer ? " Try again." : " On this device they need a one-time download of the speech model (about 80–100 MB) and a recent Chrome, Edge or Safari."),
      );
    } finally {
      setProgress(null);
    }
  };

  // With server transcription there's nothing to download, so exact captions just happen.
  useEffect(() => {
    let live = true;
    serverTranscription().then((server) => {
      if (!live) return;
      setOnServer(server);
      if (!server) return;
      const pending = clips.filter((c) => !exact[c.take.id] && !autoRan.current.has(c.take.id));
      pending.forEach((c) => autoRan.current.add(c.take.id));
      if (pending.length) run(pending);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per new clip
  }, [clips.map((c) => c.take.id).join(",")]);

  if (!clips.length) return null;
  const allExact = clips.every((c) => exact[c.take.id]);

  return (
    <div className={s.createCard}>
      <div className={s.stack} style={{ gap: 4 }}>
        <span className={s.createTitle}>Captions</span>
        <span className={s.hint}>
          Captions follow what you actually said, not the script. Fix any word here.{" "}
          {allExact
            ? "Timing is matched word by word."
            : onServer
              ? "Exact captions with word-by-word timing are made automatically."
              : "For word-perfect timing, get exact captions — it runs on this device; your video isn’t uploaded."}
        </span>
      </div>

      {clips.map(({ take, shot, index }) => {
        const said = exact[take.id];
        const value = captionEdits[take.id] ?? captionText({ ...take, transcript: said?.text ?? take.transcript }, shot);
        const differs = shot.line.trim() && norm(value) !== norm(shot.line);
        return (
          <div key={take.id} className={s.stack} style={{ gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span className={s.label}>{index + 1}. {shot.title}</span>
              <Badge tone={said ? "accent" : "neutral"}>
                {captionEdits[take.id] ? "Edited" : said ? "Exact" : take.transcript ? "Heard by browser" : "From script"}
              </Badge>
            </div>
            <textarea
              className={s.captionInput}
              aria-label={`Captions for shot ${index + 1}`}
              rows={2}
              maxLength={600}
              value={value}
              onChange={(e) => setCaptionEdits((prev) => ({ ...prev, [take.id]: e.target.value }))}
            />
            {differs && <span className={s.hint}>Script said: “{shot.line}”</span>}
          </div>
        );
      })}

      {error && <p className={s.error} role="alert">{error}</p>}
      <div className={s.actions}>
        {progress ? (
          <span className={s.hint} aria-live="polite">
            {progress.phase === "download"
              ? `Downloading the speech model · ${Math.round(progress.fraction * 100)}%`
              : `Listening to your clips${progress.where === "server" ? "" : " on this device"} · ${progress.done} of ${progress.total}`}
          </span>
        ) : (
          <Button variant={allExact ? "ghost" : "outline"} size="md" icon="mic" onClick={() => run()}>
            {allExact ? "Re-run exact captions" : "Get exact captions"}
          </Button>
        )}
      </div>
    </div>
  );
}
