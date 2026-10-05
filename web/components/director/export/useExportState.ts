"use client";

import { useCallback, useState } from "react";
import type { EditPlan, Extra } from "@/lib/editPlan";
import type { TakeTranscript } from "../transcribe/transcribe";

export type PlanState = {
  plan: EditPlan;
  /** Which kept takes the plan was made for; a different set means the plan is stale. */
  signature: string;
  source: "director" | "builtin";
};

/** Finishing state that should survive moving between steps: captions, added content, the edit plan. */
export function useExportState() {
  const [captionEdits, setCaptionEdits] = useState<Record<string, string>>({});
  const [exact, setExact] = useState<Record<string, TakeTranscript>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [notes, setNotes] = useState("");
  const [editPlan, setEditPlan] = useState<PlanState | null>(null);
  const [brand, setBrand] = useState(true);

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
  }, []);

  return { captionEdits, setCaptionEdits, exact, setExact, extras, setExtras, notes, setNotes, editPlan, setEditPlan, brand, setBrand, reset };
}

export type ExportState = ReturnType<typeof useExportState>;
