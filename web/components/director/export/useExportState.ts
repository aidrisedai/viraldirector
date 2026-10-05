"use client";

import { useCallback, useState } from "react";
import type { MusicStyle } from "@/lib/edit";
import { DEFAULT_STYLE, type EditPlan, type Extra, type Style } from "@/lib/editPlan";
import type { MusicTrack } from "../render/musicTrack";
import type { TakeTranscript } from "../transcribe/transcribe";

export type PlanState = {
  plan: EditPlan;
  /** Which kept takes the plan was made for; a different set means the plan is stale. */
  signature: string;
  /** manual: the creator's own hand edits in the editor. */
  source: "director" | "builtin" | "manual";
};

export type Revision = { feedback: string; summary: string };

/** Finishing state that should survive moving between steps: captions, added content, the edit plan, the look, the music. */
export function useExportState() {
  const [captionEdits, setCaptionEdits] = useState<Record<string, string>>({});
  const [exact, setExact] = useState<Record<string, TakeTranscript>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [notes, setNotes] = useState("");
  const [editPlan, setEditPlan] = useState<PlanState | null>(null);
  const [brand, setBrand] = useState(true);
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [music, setMusic] = useState<MusicStyle>("Calm build");
  const [customMusic, setCustomMusic] = useState<MusicTrack | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);

  const reset = useCallback(() => {
    setExtras((all) => {
      all.forEach((e) => URL.revokeObjectURL(e.url));
      return [];
    });
    setCaptionEdits({});
    setExact({});
    setNotes("");
    setEditPlan(null);
    setBrand(true);
    setStyle(DEFAULT_STYLE);
    setRevisions([]);
    // The creator's song and music choice carry over to the next video.
  }, []);

  return {
    captionEdits, setCaptionEdits, exact, setExact, extras, setExtras, notes, setNotes, editPlan, setEditPlan,
    brand, setBrand, style, setStyle, music, setMusic, customMusic, setCustomMusic, revisions, setRevisions, reset,
  };
}

export type ExportState = ReturnType<typeof useExportState>;
