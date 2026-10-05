"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { glossaryAnswer, lookup } from "@/lib/glossary";
import { useDirector } from "./DirectorContext";
import s from "./director.module.css";

type Props = { word: string; children?: ReactNode; dark?: boolean };

/** A filmmaking word the creator can tap to see what it means. */
export function Term({ word, children, dark }: Props) {
  const entry = lookup(word);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const { ask } = useDirector();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const label = children ?? word;
  if (!entry) return <>{label}</>;

  return (
    <span ref={ref} className={s.termWrap}>
      <button
        type="button"
        className={`${s.term} ${dark ? s.termDark : ""}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {label}
      </button>
      {open && (
        <span id={id} role="tooltip" className={`${s.termPop} ${dark ? s.termPopUp : ""}`}>
          <strong>{entry.term}</strong>
          <span>{glossaryAnswer(entry)}</span>
          <button
            type="button"
            className={s.termAsk}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              ask(`Can you explain "${entry.term}" for this shot?`);
            }}
          >
            Ask the Director more
          </button>
        </span>
      )}
    </span>
  );
}
