import { useRef, useState } from "react";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Icon } from "@/components/ds/Icon";
import { EXTRAS_MAX, NOTES_MAX, type EditPlan } from "@/lib/editPlan";
import { extraFromFile } from "../render/media";
import type { ExportState } from "./useExportState";
import s from "../director.module.css";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

type Props = {
  state: ExportState;
  /** Asks the Director for an edit plan; resolves with a message to show (or empty). */
  onPlan: () => Promise<string>;
  planStale: boolean;
};

/** Added pictures, clips and notes, and the Director's edit plan that uses them. */
const cards = (p: EditPlan) => p.callouts.filter((c) => c.style === "card").length;

export function ExtrasCard({ state, onPlan, planStale }: Props) {
  const { extras, setExtras, notes, setNotes, editPlan, version, versions } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const add = async (files: FileList | null) => {
    setError("");
    for (const file of Array.from(files ?? [])) {
      if (extras.length >= EXTRAS_MAX) return setError(`You can add up to ${EXTRAS_MAX} items.`);
      const limit = file.type.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > limit) {
        setError(`${file.name} is too large (max ${Math.round(limit / 1024 / 1024)} MB).`);
        continue;
      }
      try {
        const extra = await extraFromFile(file);
        setExtras((all) => (all.length >= EXTRAS_MAX ? all : [...all, extra]));
      } catch (e) {
        setError(e instanceof Error ? e.message : `Couldn’t read ${file.name}.`);
      }
    }
  };

  const remove = (id: string) =>
    setExtras((all) => {
      const gone = all.find((e) => e.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return all.filter((e) => e.id !== id);
    });

  const plan = async () => {
    setBusy(true);
    setMessage("");
    try {
      setMessage(await onPlan());
    } finally {
      setBusy(false);
    }
  };

  const p = editPlan?.plan;
  const counts = p && [
    p.cutaways.length && `${p.cutaways.length} cutaway${p.cutaways.length === 1 ? "" : "s"}`,
    cards(p) && `${cards(p)} illustrated card${cards(p) === 1 ? "" : "s"}`,
    p.callouts.length - cards(p) && `${p.callouts.length - cards(p)} callout${p.callouts.length - cards(p) === 1 ? "" : "s"}`,
    p.emphasis.length && `${p.emphasis.length} emphasised word${p.emphasis.length === 1 ? "" : "s"}`,
  ].filter(Boolean).join(" · ");

  return (
    <div className={s.createCard}>
      <div className={s.stack} style={{ gap: 4 }}>
        <span className={s.createTitle}>Extra content</span>
        <span className={s.hint}>
          Add screenshots, photos, a logo or extra clips, plus anything you want mentioned. The Director decides where each
          one goes, and makes three versions to choose from: <strong>Standard</strong> (bold captions and callouts),{" "}
          <strong>Editorial</strong> (illustrated paper cards, calm captions, a takeaway headline) and <strong>Cinematic</strong>{" "}
          (a dark dramatic build with huge serif words, a montage, then a warm human payoff).
        </span>
      </div>

      {extras.length > 0 && (
        <div className={s.extraList}>
          {extras.map((e) => (
            <div key={e.id} className={s.extraItem}>
              <div className={s.extraThumb}>
                {e.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                  <img src={e.url} alt="" />
                ) : (
                  <video src={e.url} muted playsInline preload="metadata" />
                )}
              </div>
              <div className={s.stack} style={{ gap: 6, flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span className={s.extraName}>{e.name}</span>
                  <button type="button" className={s.panelClose} onClick={() => remove(e.id)} aria-label={`Remove ${e.name}`}>
                    <Icon name="x" size={16} />
                  </button>
                </div>
                <input
                  className={s.extraNote}
                  aria-label={`Note for ${e.name}`}
                  placeholder={e.kind === "image" ? "What is it? e.g. our first sale screenshot" : "What is it? e.g. me presenting at demo day"}
                  maxLength={300}
                  value={e.note}
                  onChange={(ev) => setExtras((all) => all.map((x) => (x.id === e.id ? { ...x, note: ev.target.value } : x)))}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={s.actions}>
        <Button variant="outline" size="md" icon="upload" onClick={() => fileRef.current?.click()} disabled={extras.length >= EXTRAS_MAX}>
          Add pictures or clips
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <textarea
        className={s.captionInput}
        aria-label="Notes for the Director"
        placeholder="Anything else? e.g. “Mention the EdAI Summit, Aug 29–30” or “Show the 4th idea as a big number”"
        rows={3}
        maxLength={NOTES_MAX}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <p className={s.error} role="alert">{error}</p>}

      {p && (
        <div className={s.planSummary}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Badge tone={planStale ? "warning" : "accent"} dot={!planStale}>
              {version} · {planStale ? "Out of date — your takes changed" : editPlan.source === "director" ? "Director’s edit" : editPlan.source === "manual" ? "Your edit" : "Built-in edit"}
            </Badge>
            {counts && <span className={s.hint}>{counts}</span>}
          </div>
          {p.summary && <span style={{ fontSize: 15, lineHeight: 1.5 }}>{p.summary}</span>}
          {!!p.altHooks?.length && (
            <div className={s.stack} style={{ gap: 4 }}>
              <span className={s.label}>Other ways to open</span>
              <ol className={s.revisionList}>
                {p.altHooks.map((h) => <li key={h}><span>{h}</span></li>)}
              </ol>
            </div>
          )}
        </div>
      )}
      {message && <span className={s.hint}>{message}</span>}

      <div className={s.actions}>
        <Button size="md" icon="sparkles" onClick={plan} disabled={busy}>
          {busy ? "The Director is making all three versions…" : Object.values(versions).some((v) => v.editPlan) ? "Make all three versions again" : "Let the Director make all three versions"}
        </Button>
      </div>
    </div>
  );
}
