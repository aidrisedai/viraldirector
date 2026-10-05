import { useState } from "react";
import { Button } from "@/components/ds/Button";
import { FEEDBACK_MAX } from "@/lib/editPlan";
import type { Revision } from "./useExportState";
import s from "../director.module.css";

const SUGGESTIONS = [
  "Make the captions bigger",
  "Music is too loud",
  "More energy",
  "Calmer and cleaner",
  "Captions are covering my face",
  "Try Bold captions",
  "Add a callout for the key number",
];

type Props = {
  /** Re-edits and re-renders; resolves with a message to show (empty when it went fine). */
  onImprove: (feedback: string) => Promise<string>;
  busy: boolean;
  revisions: Revision[];
};

/** After the video is made: tell the Director what to change, and it re-edits and re-renders. */
export function ImproveCard({ onImprove, busy, revisions }: Props) {
  const [feedback, setFeedback] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    const text = feedback.trim();
    if (!text || busy || working) return;
    setWorking(true);
    setMessage("");
    try {
      const msg = await onImprove(text);
      setMessage(msg);
      if (!msg) setFeedback("");
    } finally {
      setWorking(false);
    }
  };

  const add = (sug: string) => setFeedback((f) => (f.trim() ? `${f.trim().replace(/[.,]$/, "")}, ${sug.charAt(0).toLowerCase()}${sug.slice(1)}` : sug));

  return (
    <section className={`${s.createCard} ${s.improveCard}`} aria-label="Improve this video">
      <div className={s.stack} style={{ gap: 4 }}>
        <span className={s.createTitle}>Ask the Director to change it</span>
        <span className={s.hint}>
          Rather say it than drag it? Describe the change — the Director re-edits and the preview updates. Times help: “at 0:12
          the text covers my face”.
        </span>
      </div>
      <textarea
        className={s.captionInput}
        aria-label="What should change?"
        placeholder="e.g. The captions are hard to read and the music is distracting. Make the start punchier."
        rows={3}
        maxLength={FEEDBACK_MAX}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        disabled={working}
      />
      <div className={s.suggestRow}>
        {SUGGESTIONS.map((sug) => (
          <button key={sug} type="button" className={s.suggestChip} onClick={() => add(sug)} disabled={working}>
            {sug}
          </button>
        ))}
      </div>
      {message && <p className={s.hint} role="status">{message}</p>}
      <div className={s.actions}>
        <Button icon="sparkles" onClick={submit} disabled={!feedback.trim() || busy || working}>
          {working ? "The Director is re-editing…" : "Re-edit my video"}
        </Button>
      </div>
      {revisions.length > 0 && (
        <ol className={s.revisionList}>
          {revisions.map((r, i) => (
            <li key={i}>
              <span className={s.revisionAsk}>“{r.feedback}”</span>
              <span>{r.summary}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
