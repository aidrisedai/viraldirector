"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Icon } from "@/components/ds/Icon";
import { QUESTION_MAX } from "@/lib/chat";
import { termsIn } from "@/lib/glossary";
import { SHOT_TYPE_LABEL, type Plan } from "@/lib/plan";
import type { PanelMessage } from "./useDirectorChat";
import s from "./director.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  messages: PanelMessage[];
  busy: boolean;
  plan: Plan | null;
  shot: number;
  onAsk: (q: string) => void;
  onApplyLine: (shot: number, line: string) => void;
  onClear: () => void;
};

function suggestions(plan: Plan | null, shot: number): string[] {
  if (!plan) return ["What is a hook?", "What is B-roll?", "What is a beat?"];
  const cur = plan.shots[shot];
  const words = termsIn(`${SHOT_TYPE_LABEL[cur.type]} ${cur.size} ${cur.framing} ${cur.delivery}`).slice(0, 2);
  return [
    ...words.map((w) => `What does “${w.term}” mean?`),
    cur.line ? "How should I deliver this line?" : "How do I film this shot?",
    "How do I set up my light for this shot?",
  ];
}

export function DirectorPanel({ open, onClose, messages, busy, plan, shot, onAsk, onApplyLine, onClear }: Props) {
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, busy]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const send = () => {
    if (!draft.trim() || busy) return;
    onAsk(draft);
    setDraft("");
  };
  const cur = plan?.shots[shot];

  return (
    <aside className={s.panel} role="dialog" aria-label="Ask the Director">
      <div className={s.panelHead}>
        <div className={s.stack} style={{ gap: 2 }}>
          <span className={s.panelTitle}>Ask the Director</span>
          <span className={s.small}>{cur ? `Shot ${shot + 1} · ${cur.title}` : "Words, framing, delivery — ask anything"}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {messages.length > 0 && <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>}
          <button type="button" className={s.panelClose} onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>

      <div className={s.panelBody} aria-live="polite">
        {messages.length === 0 && (
          <p className={s.hint}>
            Ask what a word means, how to frame or light a shot, or how to say a line. You can also ask for feedback on an
            edited line or on any take.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? s.msgUser : `${s.msgDirector} ${m.error ? s.msgError : ""}`}>
            {m.verdict && m.verdict !== "none" && (
              <Badge tone={m.verdict === "keep" ? "accent" : "warning"} dot={m.verdict === "keep"}>
                {m.verdict === "keep" ? "Keep it" : "Retake"}
              </Badge>
            )}
            <span>{m.text}</span>
            {m.local && <span className={s.msgMeta}>From the glossary</span>}
            {m.suggestedLine && m.shot !== undefined && (
              <div className={s.suggestion}>
                <span className={s.msgMeta}>Suggested line</span>
                <span className={s.suggestionLine}>{m.suggestedLine}</span>
                <div>
                  <Button
                    size="sm"
                    variant={applied.has(m.id) ? "ghost" : "secondary"}
                    icon={applied.has(m.id) ? "check" : undefined}
                    disabled={applied.has(m.id)}
                    onClick={() => {
                      onApplyLine(m.shot!, m.suggestedLine!);
                      setApplied((a) => new Set(a).add(m.id));
                    }}
                  >
                    {applied.has(m.id) ? "Applied" : `Use for shot ${m.shot + 1}`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {busy && <div className={`${s.msgDirector} ${s.msgPending}`}>The Director is thinking…</div>}
        <div ref={endRef} />
      </div>

      <div className={s.panelFoot}>
        <div className={s.suggestRow}>
          {suggestions(plan, shot).map((q) => (
            <button key={q} type="button" className={s.suggestChip} onClick={() => onAsk(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>
        <form
          className={s.askRow}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={inputRef}
            className={s.askInput}
            aria-label="Your question"
            placeholder="Ask the Director…"
            rows={2}
            maxLength={QUESTION_MAX}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button type="submit" size="sm" disabled={!draft.trim() || busy}>Ask</Button>
        </form>
      </div>
    </aside>
  );
}
