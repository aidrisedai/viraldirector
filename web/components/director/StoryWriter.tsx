import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ds/Button";
import { CONCEPT_MAX, targetSeconds, type Brief } from "@/lib/plan";
import { loadStory, saveStory, type SavedStory } from "@/lib/storage";
import {
  ANSWER_MAX, NOTE_MAX, SCENARIO_MAX, SCENARIO_MIN, SCRIPT_MAX, spokenSeconds, WRITERS, writerName,
  type Story, type WriterRequest, type WriterResponse,
} from "@/lib/story";
import { useDictation } from "./useDictation";
import s from "./director.module.css";

type Settings = WriterRequest["settings"];
type Busy = "" | WriterRequest["action"];

const EMPTY: SavedStory = { mode: "idea", scenario: "", writer: "screenwriter", questions: [], answers: [], story: null };

/** Story-mode state for the Concept step, kept in localStorage so a refresh doesn't lose the draft. */
export function useStoryWriter(settings: Settings) {
  const [saved, setSaved] = useState<SavedStory>(EMPTY);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState<Busy>("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const prev = loadStory();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
    if (prev) setSaved(prev);
    setRestored(true);
  }, []);
  useEffect(() => {
    if (restored) saveStory(saved);
  }, [restored, saved]);

  const patch = useCallback((p: Partial<SavedStory>) => setSaved((x) => ({ ...x, ...p })), []);

  const call = async (action: WriterRequest["action"], extra: Partial<WriterRequest> = {}) => {
    setBusy(action);
    setError("");
    try {
      const body: WriterRequest = {
        action,
        writer: saved.writer,
        scenario: saved.scenario,
        settings,
        answers: saved.questions.map((question, i) => ({ question, answer: saved.answers[i] ?? "" })),
        draft: null,
        note: "",
        ...extra,
      };
      const res = await fetch("/api/writer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({ error: "The writer didn’t respond. Try again." }))) as WriterResponse;
      if ("error" in data) throw new Error(data.error);
      return data;
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn’t reach the writer. Check your connection and try again.");
      return null;
    } finally {
      setBusy("");
    }
  };

  const write = async (withAnswers = true) => {
    const data = await call("draft", withAnswers ? {} : { answers: [] });
    if (data && "story" in data) patch({ story: data.story });
  };

  const askQuestions = async () => {
    const data = await call("questions", { answers: [] });
    if (!data || !("questions" in data)) return;
    if (data.questions.length) patch({ questions: data.questions, answers: data.questions.map(() => ""), story: null });
    else {
      patch({ questions: [], answers: [] });
      const draft = await call("draft", { answers: [] });
      if (draft && "story" in draft) patch({ story: draft.story });
    }
  };

  const revise = async () => {
    if (!saved.story) return;
    const data = await call("revise", { draft: saved.story, note });
    if (data && "story" in data) {
      patch({ story: data.story });
      setNote("");
    }
  };

  const startOver = () => {
    patch({ questions: [], answers: [], story: null });
    setNote("");
    setError("");
  };

  return { ...saved, patch, busy, error, note, setNote, askQuestions, write, revise, startOver };
}

export type StoryWriterState = ReturnType<typeof useStoryWriter>;

/** The approved story is good to hand to the Director. */
export const storyReady = (w: StoryWriterState): w is StoryWriterState & { story: Story } =>
  Boolean(w.story && w.story.logline.trim().length >= 3 && w.story.script.trim());

export function StoryWriter({ w, brief }: { w: StoryWriterState; brief: Brief }) {
  const dictation = useDictation(w.scenario, (scenario) => w.patch({ scenario }), SCENARIO_MAX);
  const name = writerName(w.writer);
  const lower = name.toLowerCase();
  const scenarioReady = w.scenario.trim().length >= SCENARIO_MIN;
  const stage = w.story ? "draft" : w.questions.length ? "questions" : "start";
  const target = targetSeconds(brief);

  const editStory = (p: Partial<Story>) => w.story && w.patch({ story: { ...w.story, ...p } });
  const seconds = w.story ? spokenSeconds(w.story.script) : 0;

  return (
    <>
      <div className={s.ideaBox}>
        <label className={s.label} htmlFor="scenario">What happened? Tell the whole story.</label>
        <textarea
          id="scenario"
          className={s.scenarioInput}
          placeholder="Who was there, what you were trying to do, what went wrong, what changed, how it ended — and why it matters to you. Messy is fine; the writer will shape it."
          rows={6}
          maxLength={SCENARIO_MAX}
          value={w.scenario}
          onChange={(e) => w.patch({ scenario: e.target.value })}
          autoFocus
        />
        <div className={s.ideaFoot}>
          <span>{dictation.listening ? "Listening…" : `${w.scenario.length.toLocaleString()} / ${SCENARIO_MAX.toLocaleString()}`}</span>
          {dictation.supported && (
            <Button variant="outline" size="sm" icon="mic" onClick={dictation.toggle} aria-pressed={dictation.listening}>
              {dictation.listening ? "Stop" : "Dictate"}
            </Button>
          )}
        </div>
      </div>

      <div className={s.stack} style={{ gap: 10 }}>
        <span className={s.label}>Who should write it?</span>
        <div className={s.writerGrid} role="group" aria-label="Writer">
          {WRITERS.map((x) => {
            const on = w.writer === x.id;
            return (
              <button key={x.id} type="button" aria-pressed={on} className={`${s.writer} ${on ? s.formatOn : ""}`} onClick={() => w.patch({ writer: x.id })}>
                <span className={s.writerName}>{x.name}</span>
                <span className={s.writerBlurb}>{x.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>

      {stage === "start" && (
        <div className={s.actions}>
          <Button variant="secondary" icon="pencil" onClick={w.askQuestions} disabled={!scenarioReady || Boolean(w.busy)}>
            {w.busy ? `The ${lower} is reading…` : `Give it to the ${lower}`}
          </Button>
          {!scenarioReady && w.scenario.trim() && <span className={s.hint}>Tell the writer a bit more first.</span>}
        </div>
      )}

      {stage === "questions" && (
        <section className={`${s.card} ${s.storyCard}`} aria-label={`Questions from the ${lower}`}>
          <span className={s.eyebrow}>THE {name.toUpperCase()} ASKS</span>
          {w.questions.map((q, i) => (
            <label key={q} className={s.stack} style={{ gap: 8 }}>
              <span className={s.questionText}>{q}</span>
              <textarea
                className={s.answerInput}
                rows={2}
                maxLength={ANSWER_MAX}
                value={w.answers[i] ?? ""}
                onChange={(e) => w.patch({ answers: w.answers.map((a, j) => (j === i ? e.target.value : a)) })}
              />
            </label>
          ))}
          <div className={s.actions}>
            <Button variant="secondary" icon="pencil" onClick={() => w.write(true)} disabled={Boolean(w.busy)}>
              {w.busy === "draft" ? `The ${lower} is writing…` : "Write my story"}
            </Button>
            <Button variant="ghost" onClick={() => w.write(false)} disabled={Boolean(w.busy)}>Skip questions</Button>
          </div>
        </section>
      )}

      {stage === "draft" && w.story && (
        <section className={`${s.card} ${s.storyCard}`} aria-label="Your story">
          <div className={s.storyHead}>
            <span className={s.eyebrow}>WRITTEN BY THE {name.toUpperCase()}</span>
            <span className={seconds > target * 1.1 ? s.warnText : s.hint}>
              About {seconds}s spoken · target {target}s
            </span>
          </div>
          <input
            className={s.storyTitle}
            aria-label="Story title"
            maxLength={80}
            value={w.story.title}
            onChange={(e) => editStory({ title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          />
          <label className={s.stack} style={{ gap: 6 }}>
            <span className={s.label}>In one line</span>
            <textarea className={s.answerInput} rows={2} maxLength={CONCEPT_MAX} value={w.story.logline} onChange={(e) => editStory({ logline: e.target.value })} />
          </label>
          <label className={s.stack} style={{ gap: 6 }}>
            <span className={s.label}>Script <span className={s.muted}>· [brackets] are things to film</span></span>
            <textarea className={s.scriptInput} rows={12} maxLength={SCRIPT_MAX} value={w.story.script} onChange={(e) => editStory({ script: e.target.value })} />
          </label>
          {w.story.note && <p className={s.writerNote}><strong>{name}:</strong> {w.story.note}</p>}
          <div className={s.reviseRow}>
            <input
              className={s.askInput}
              aria-label={`What should the ${lower} change?`}
              placeholder={`Ask the ${lower} for changes — “make the ending punchier”`}
              maxLength={NOTE_MAX}
              value={w.note}
              onChange={(e) => w.setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (w.note.trim() && !w.busy) w.revise();
                }
              }}
            />
            <Button variant="outline" icon="rotate-ccw" onClick={w.revise} disabled={!w.note.trim() || Boolean(w.busy)}>
              {w.busy === "revise" ? "Revising…" : "Revise"}
            </Button>
          </div>
          <div className={s.actions}>
            <Button variant="ghost" size="sm" onClick={w.startOver} disabled={Boolean(w.busy)}>Start the story again</Button>
          </div>
        </section>
      )}

      {w.error && <p className={s.error} role="alert">{w.error}</p>}
    </>
  );
}
