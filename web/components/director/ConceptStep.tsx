import { Button } from "@/components/ds/Button";
import { Icon } from "@/components/ds/Icon";
import { AUDIENCES, CONCEPT_MAX, FORMATS, GOALS, LENGTHS, PLATFORMS, SAMPLE_CONCEPT, type Brief } from "@/lib/plan";
import { Chips } from "./Chips";
import { StoryWriter, storyReady, useStoryWriter } from "./StoryWriter";
import { useDictation } from "./useDictation";
import s from "./director.module.css";

type Props = {
  brief: Brief;
  onChange: (patch: Partial<Brief>) => void;
  /** Plan the video; `patch` is applied to the brief first (the story, in story mode). */
  onNext: (patch: Partial<Brief>) => void;
  loading: boolean;
  error: string;
};

export function ConceptStep({ brief, onChange, onNext, loading, error }: Props) {
  const dictation = useDictation(brief.concept, (concept) => onChange({ concept }), CONCEPT_MAX);
  const { goal, length, platform, audience, format } = brief;
  const writer = useStoryWriter({ goal, length, platform, audience, format });
  const storyMode = writer.mode === "story";

  const options = [
    { label: "Goal", key: "goal", values: GOALS },
    { label: "Length", key: "length", values: LENGTHS },
    { label: "Platform", key: "platform", values: PLATFORMS },
    { label: "Audience", key: "audience", values: AUDIENCES },
  ] as const;

  const ready = storyMode ? storyReady(writer) && !writer.busy : brief.concept.trim().length >= 3;
  const submit = () => {
    if (!ready || loading) return;
    if (storyMode && writer.story) onNext({ concept: writer.story.logline.trim(), story: writer.story.script.trim() });
    else onNext({ story: "" });
  };

  return (
    <main data-screen-label="01 Concept" className={`${s.main} ${s.conceptMain}`}>
      <form
        className={s.conceptCol}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className={s.stack} style={{ gap: 12 }}>
          <span className={s.eyebrow}>NEW VIDEO</span>
          <h1 className={s.conceptTitle}>What’s your video about?</h1>
          <div className={s.modeSwitch} role="group" aria-label="How do you want to start?">
            <button type="button" aria-pressed={!storyMode} className={`${s.chip} ${!storyMode ? s.chipOn : ""}`} onClick={() => writer.patch({ mode: "idea" })}>
              Quick idea
            </button>
            <button type="button" aria-pressed={storyMode} className={`${s.chip} ${storyMode ? s.chipOn : ""}`} onClick={() => writer.patch({ mode: "story" })}>
              Tell the full story
            </button>
          </div>
          <p className={s.lede}>
            {storyMode
              ? "Explain what happened in your own words and pick a writer. They’ll ask a few questions, write your story, and you approve it before the Director plans the shots."
              : "One sentence is enough. The Director writes the hook, script and shot list."}
          </p>
        </div>

        {storyMode ? (
          <StoryWriter w={writer} brief={brief} />
        ) : (
          <div className={s.ideaBox}>
            <textarea
              className={s.ideaInput}
              aria-label="Video concept"
              placeholder={SAMPLE_CONCEPT}
              rows={1}
              maxLength={CONCEPT_MAX}
              value={brief.concept}
              onChange={(e) => onChange({ concept: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              autoFocus
            />
            <div className={s.ideaFoot}>
              <span>{dictation.listening ? "Listening…" : dictation.supported ? "Type or dictate" : "Type your idea"}</span>
              {dictation.supported && (
                <Button variant="outline" size="sm" icon="mic" onClick={dictation.toggle} aria-pressed={dictation.listening}>
                  {dictation.listening ? "Stop" : "Dictate"}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className={s.optionGrid}>
          {options.map(({ label, key, values }) => (
            <div key={key} className={s.stack} style={{ gap: 10 }}>
              <span className={s.label}>{label}</span>
              <Chips label={label} options={values} isOn={(v) => brief[key] === v} onToggle={(v) => onChange({ [key]: v })} />
            </div>
          ))}
        </div>

        <div className={s.stack} style={{ gap: 10 }}>
          <span className={s.label}>Format</span>
          <div className={s.formatGrid} role="group" aria-label="Format">
            {FORMATS.map((f) => {
              const on = brief.format === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  className={`${s.format} ${on ? s.formatOn : ""}`}
                  onClick={() => onChange({ format: f })}
                >
                  {f === "Director picks" && <Icon name="sparkles" size={16} color="var(--emerald-600)" />}
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        <div className={s.submitRow}>
          {error && <p className={s.error} role="alert">{error}</p>}
          {storyMode && !writer.story && <p className={s.hint}>Once your story is written and you’re happy with it, hand it to the Director.</p>}
          <Button type="submit" size="lg" iconRight={loading ? undefined : "arrow-right"} disabled={!ready || loading}>
            {loading ? "Directing your video…" : storyMode ? "Give my story to the Director" : "Direct my video"}
          </Button>
        </div>
        {loading && <p className={s.hint} aria-live="polite">The Director is writing hooks, a beat sheet and your shot list. This takes up to a minute.</p>}
      </form>
    </main>
  );
}
