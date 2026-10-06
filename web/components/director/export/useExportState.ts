"use client";

import { useCallback, useRef, useState, type SetStateAction } from "react";
import type { MusicStyle } from "@/lib/edit";
import { lookStyle, type EditPlan, type Extra, type Look, type Style } from "@/lib/editPlan";
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

/** One finished version of the video: its edit, its look, and the feedback rounds that shaped it. */
export type Version = { editPlan: PlanState | null; style: Style; revisions: Revision[] };

const fresh = (look: Look): Version => ({ editPlan: null, style: lookStyle(look), revisions: [] });
const freshVersions = (): Record<Look, Version> => ({ Standard: fresh("Standard"), Editorial: fresh("Editorial") });

const apply = <T,>(next: SetStateAction<T>, prev: T): T => (typeof next === "function" ? (next as (p: T) => T)(prev) : next);

/**
 * Finishing state that should survive moving between steps: captions, added content, the music, and two
 * versions of the edit (Standard and Editorial). `editPlan`, `style` and `revisions` belong to the version being
 * worked on; `setVersion` switches, and `update` changes a named version (for edits that finish after a switch).
 */
export function useExportState() {
  const [captionEdits, setCaptionEdits] = useState<Record<string, string>>({});
  const [exact, setExact] = useState<Record<string, TakeTranscript>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [notes, setNotes] = useState("");
  const [brand, setBrand] = useState(true);
  const [music, setMusic] = useState<MusicStyle>("Calm build");
  const [customMusic, setCustomMusic] = useState<MusicTrack | null>(null);
  const [version, setVersionState] = useState<Look>("Standard");
  const [versions, setVersions] = useState<Record<Look, Version>>(freshVersions);
  // The setters below act on the version showing when they're called.
  const versionRef = useRef(version);
  const setVersion = useCallback((v: Look) => {
    versionRef.current = v;
    setVersionState(v);
  }, []);

  const update = useCallback((look: Look, patch: (v: Version) => Partial<Version>) => {
    setVersions((all) => ({ ...all, [look]: { ...all[look], ...patch(all[look]) } }));
  }, []);
  const setEditPlan = useCallback((p: SetStateAction<PlanState | null>) => update(versionRef.current, (v) => ({ editPlan: apply(p, v.editPlan) })), [update]);
  const setStyle = useCallback((p: SetStateAction<Style>) => update(versionRef.current, (v) => ({ style: apply(p, v.style) })), [update]);
  const setRevisions = useCallback((p: SetStateAction<Revision[]>) => update(versionRef.current, (v) => ({ revisions: apply(p, v.revisions) })), [update]);

  const reset = useCallback(() => {
    setExtras((all) => {
      all.forEach((e) => URL.revokeObjectURL(e.url));
      return [];
    });
    setCaptionEdits({});
    setExact({});
    setNotes("");
    setBrand(true);
    setVersions(freshVersions());
    setVersion("Standard");
    // The creator's song and music choice carry over to the next video.
  }, [setVersion]);

  const { editPlan, style, revisions } = versions[version];
  return {
    captionEdits, setCaptionEdits, exact, setExact, extras, setExtras, notes, setNotes, brand, setBrand, music, setMusic,
    customMusic, setCustomMusic, version, setVersion, versions, update,
    editPlan, setEditPlan, style, setStyle, revisions, setRevisions, reset,
  };
}

export type ExportState = ReturnType<typeof useExportState>;
