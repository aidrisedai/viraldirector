import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ds/Button";
import { Icon } from "@/components/ds/Icon";
import { AUDIENCES, CONCEPT_MAX, FORMATS, GOALS, LENGTHS, PLATFORMS, SAMPLE_CONCEPT, type Brief } from "@/lib/plan";
import { Chips } from "./Chips";
import s from "./director.module.css";

type Props = {
  brief: Brief;
  onChange: (patch: Partial<Brief>) => void;
  onNext: () => void;
  loading: boolean;
  error: string;
};

// Minimal typing for the Web Speech API, which TypeScript's DOM lib doesn't ship everywhere.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function speechRecognition(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noSubscribe = () => () => {};

export function ConceptStep({ brief, onChange, onNext, loading, error }: Props) {
  const canDictate = useSyncExternalStore(noSubscribe, () => Boolean(speechRecognition()), () => false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const conceptRef = useRef(brief.concept);

  useEffect(() => {
    conceptRef.current = brief.concept;
  }, [brief.concept]);
  useEffect(() => () => recognition.current?.stop(), []);

  const toggleDictation = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = speechRecognition();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text) onChange({ concept: `${conceptRef.current} ${text.trim()}`.trim().slice(0, CONCEPT_MAX) });
    };
    r.onend = r.onerror = () => setListening(false);
    recognition.current = r;
    r.start();
    setListening(true);
  };

  const options = [
    { label: "Goal", key: "goal", values: GOALS },
    { label: "Length", key: "length", values: LENGTHS },
    { label: "Platform", key: "platform", values: PLATFORMS },
    { label: "Audience", key: "audience", values: AUDIENCES },
  ] as const;

  const ready = brief.concept.trim().length >= 3;

  return (
    <main data-screen-label="01 Concept" className={`${s.main} ${s.conceptMain}`}>
      <form
        className={s.conceptCol}
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !loading) onNext();
        }}
      >
        <div className={s.stack} style={{ gap: 12 }}>
          <span className={s.eyebrow}>NEW VIDEO</span>
          <h1 className={s.conceptTitle}>What’s your video about?</h1>
          <p className={s.lede}>One sentence is enough. The Director writes the hook, script and shot list.</p>
        </div>

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
            <span>{listening ? "Listening…" : canDictate ? "Type or dictate" : "Type your idea"}</span>
            {canDictate && (
              <Button variant="outline" size="sm" icon="mic" onClick={toggleDictation} aria-pressed={listening}>
                {listening ? "Stop" : "Dictate"}
              </Button>
            )}
          </div>
        </div>

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
          <Button type="submit" size="lg" iconRight={loading ? undefined : "arrow-right"} disabled={!ready || loading}>
            {loading ? "Directing your video…" : "Direct my video"}
          </Button>
        </div>
        {loading && <p className={s.hint} aria-live="polite">The Director is writing hooks, a beat sheet and your shot list. This takes up to a minute.</p>}
      </form>
    </main>
  );
}
