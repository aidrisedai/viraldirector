"use client";

import { useCallback, useRef, useState } from "react";
import { HISTORY_MAX, type ChatRequest, type ChatResponse } from "@/lib/chat";
import { definitionQuestion, glossaryAnswer } from "@/lib/glossary";
import type { Brief, Plan } from "@/lib/plan";
import type { Take } from "@/lib/takes";
import { takeFrames } from "./frames";

export type PanelMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Answered from the built-in glossary, not the API. */
  local?: boolean;
  error?: boolean;
  verdict?: "keep" | "retake" | "none";
  suggestedLine?: string;
  /** The shot a line suggestion applies to. */
  shot?: number;
};

export type StepName = ChatRequest["context"]["step"];

type Options = {
  brief: Brief;
  plan: Plan | null;
  /** The plan as the Director wrote it (with the chosen hook), before the creator's edits. */
  basePlan: Plan | null;
  hook: number;
  step: StepName;
  shot: number;
};

const uid = () => crypto.randomUUID();

export function useDirectorChat({ brief, plan, basePlan, hook, step, shot }: Options) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const push = (m: PanelMessage) => setMessages((all) => [...all, m]);

  const request = useCallback(
    async (mode: ChatRequest["mode"], message: string, display: string, extra: { take?: ChatRequest["take"]; forShot?: number } = {}) => {
      if (!plan || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setOpen(true);
      const questionId = uid();
      push({ id: questionId, role: "user", text: display });
      // A question whose request fails is left out of later history, like its error reply.
      const markFailed = () => setMessages((all) => all.map((m) => (m.id === questionId ? { ...m, error: true } : m)));

      // Only real exchanges go back to the API; glossary answers and errors stay local.
      const history = messages
        .filter((m) => !m.local && !m.error)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }))
        .slice(-HISTORY_MAX);
      const forShot = extra.forShot ?? shot;
      const body: ChatRequest = {
        mode,
        message,
        history,
        context: {
          brief,
          plan,
          hook,
          step,
          shot: forShot,
          originalLine: mode === "line" ? (basePlan?.shots[forShot]?.line ?? null) : null,
        },
        take: extra.take ?? null,
      };
      try {
        const res = await fetch("/api/director", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({ error: "The Director didn’t respond. Try again." }))) as ChatResponse;
        if ("error" in data) {
          markFailed();
          push({ id: uid(), role: "assistant", text: data.error, error: true });
        }
        else push({ id: uid(), role: "assistant", text: data.reply, verdict: data.verdict, suggestedLine: data.suggestedLine || undefined, shot: forShot });
      } catch {
        markFailed();
        push({ id: uid(), role: "assistant", text: "Couldn’t reach the Director. Check your connection and try again.", error: true });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [brief, plan, basePlan, hook, step, shot, messages],
  );

  /** A free-form question. Word definitions are answered instantly from the glossary. */
  const ask = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q) return;
      setOpen(true);
      const entry = definitionQuestion(q);
      if (entry || !plan) {
        push({ id: uid(), role: "user", text: q, local: true });
        push({
          id: uid(),
          role: "assistant",
          local: true,
          text: entry
            ? `${entry.term}: ${glossaryAnswer(entry)}`
            : "I can answer questions about your video once I’ve written your plan. Until then, ask me what a word means — like “What is B-roll?”",
        });
        return;
      }
      request("ask", q, q);
    },
    [plan, request],
  );

  const askLine = useCallback(
    (shotIndex: number) => {
      const line = plan?.shots[shotIndex]?.line ?? "";
      request(
        "line",
        `Give me feedback on my line for shot ${shotIndex + 1}: "${line || "(no line)"}"`,
        `Feedback on my line for shot ${shotIndex + 1}: “${line || "no line"}”`,
        { forShot: shotIndex },
      );
    },
    [plan, request],
  );

  const askTake = useCallback(
    async (take: Take, takeNumber: number) => {
      if (busyRef.current) return;
      setOpen(true);
      let frames: string[] = [];
      try {
        frames = await takeFrames(take);
      } catch {
        // Feedback still works from the numbers and transcript alone.
      }
      request("take", "Review this take. Should I keep it or retake it, and what should I fix?", `Review take ${takeNumber} of shot ${take.shot + 1}`, {
        forShot: take.shot,
        take: {
          takeNumber,
          source: take.source,
          seconds: take.seconds,
          peak: take.peak,
          clipped: take.clipped,
          voiced: take.voiced,
          transcript: take.transcript,
          frames,
        },
      });
    },
    [request],
  );

  const clear = useCallback(() => setMessages([]), []);

  return { open, setOpen, messages, busy, ask, askLine, askTake, clear };
}
