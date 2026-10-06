"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Icon } from "@/components/ds/Icon";
import type { FormatKey, Segment } from "@/lib/edit";
import { ART, ART_IDS } from "@/lib/art";
import {
  CALLOUT_STYLES, clipBounds, composeEdit, LOOKS, normalizePlan, type Callout, type CalloutStyle, type EditPlan, type Extra, type Look, type Style,
} from "@/lib/editPlan";
import {
  addCallout, addCutaway, clipWindow, layout, moveCallout, moveCutaway, removeCallout, removeCutaway, resetTrim, roomAt, setTrim,
  toggleDrop, toVideoTime, updateCallout, updateCutaway,
} from "@/lib/timeline";
import type { ExportState } from "../export/useExportState";
import { buildScene } from "../render/compositor";
import { Engine } from "../render/engine";
import { generatedTrack } from "../render/musicTrack";
import { useThumb } from "./useThumb";
import e from "./editor.module.css";

/** A media thumbnail that works on phones (videos get a real still). */
function Thumb({ url, kind, className }: { url: string; kind: "image" | "video"; className?: string }) {
  const src = useThumb(url, kind);
  // eslint-disable-next-line @next/next/no-img-element -- local blob / data preview
  return src ? <img className={className} src={src} alt="" draggable={false} /> : <span className={className} />;
}

const CALLOUT_NAMES: Record<CalloutStyle, string> = { label: "Label", stat: "Big number", card: "Card", takeaway: "Takeaway", sticker: "Sticker" };
const CALLOUT_HINTS: Record<CalloutStyle, string> = {
  label: "A short tag over the video.",
  stat: "Big numbers count up on screen — try “200 users”.",
  card: "An illustrated paper card replaces the picture while you keep talking. Hold it 1.5–3 s so people can read it.",
  takeaway: "One huge headline over dimmed, blurred footage. Save it for your main point.",
  sticker: "A small paper-cutout picture beside you, away from your face.",
};
const BLOCK_ICON: Record<CalloutStyle, Parameters<typeof Icon>[0]["name"]> = { label: "type", stat: "type", card: "image-plus", takeaway: "zap", sticker: "sparkles" };

/** Text, kind and (for cards and stickers) picture of an on-screen text item. Shared by the inspector and the phone sheet. */
function CalloutFields({ c, phone, onLive, onCommit, onDone }: {
  c: Callout;
  phone: boolean;
  /** Typing: updates the preview without an undo step per letter. */
  onLive: (patch: Partial<Callout>) => void;
  onCommit: (patch: Partial<Callout>) => void;
  onDone?: () => void;
}) {
  const field = phone ? e.mField : e.field;
  const text = (label: string, key: "text" | "highlight" | "support", max: number, placeholder = "") => (
    <label className={e.fieldLabel}>
      <span>{label}</span>
      <input
      className={field}
      aria-label={label}
      placeholder={placeholder || label}
      maxLength={max}
      value={(key === "text" ? c.text : c[key]) ?? ""}
      autoFocus={key === "text" && c.text === "Your text"}
      onFocus={(ev) => key === "text" && c.text === "Your text" && ev.currentTarget.select()}
      onChange={(ev) => onLive(key === "text" ? { text: ev.target.value || " " } : { [key]: ev.target.value })}
      enterKeyHint="done"
      onKeyDown={(ev) => ev.key === "Enter" && onDone?.()}
      />
    </label>
  );
  const hasArt = c.style === "card" || c.style === "sticker";
  return (
    <>
      {text(c.style === "card" ? "Headline" : c.style === "sticker" ? "Label under the picture" : "On-screen text", "text", 48)}
      <div className={`${e.seg} ${e.segWrap}`} role="group" aria-label="Text style">
        {CALLOUT_STYLES.map((st) => (
          <button
            key={st}
            type="button"
            aria-pressed={c.style === st}
            onClick={() => onCommit({ style: st, ...((st === "card" || st === "sticker") && !c.art ? { art: "lightbulb" } : {}) })}
          >
            {CALLOUT_NAMES[st]}
          </button>
        ))}
      </div>
      {c.style === "card" && text("Words to highlight", "highlight", 48, "Copy them from the headline")}
      {c.style === "card" && text("Supporting line", "support", 60, "A short line under the picture")}
      {hasArt && (
        <label className={e.fieldLabel}>
          <span>Picture</span>
          <select className={field} aria-label="Picture" value={c.art ?? "lightbulb"} onChange={(ev) => onCommit({ art: ev.target.value })}>
            {ART_IDS.map((id) => <option key={id} value={id}>{ART[id].label}</option>)}
          </select>
        </label>
      )}
      <p className={phone ? e.mSheetHint : e.hint}>{CALLOUT_HINTS[c.style]}</p>
    </>
  );
}

type Selection = { kind: "cutaway" | "callout"; index: number } | { kind: "clip"; segment: number } | null;
type BinItem = { source: string; name: string; kind: "image" | "video"; url: string; seconds: number | null };
type BlockDrag = { kind: "cutaway" | "callout"; index: number; mode: "move" | "resize"; startX: number; dx: number; start: number; seconds: number };
type BinDrag = { item: BinItem; x: number; y: number; moved: boolean; over: boolean };
/** Bottom sheets in the phone editor. The first five are filled by the Export step. */
export type SheetName = "captions" | "style" | "music" | "director" | "export" | "media" | "text" | "clip";

type Props = {
  timeline: Segment[] | null;
  plan: EditPlan | null;
  /** A hand edit: the new plan becomes the creator's own edit. */
  onPlan: (plan: EditPlan) => void;
  state: ExportState;
  format: FormatKey;
  hookTitle: string;
  shotTitles: string[];
  /** Adds files to the creator's extra content; resolves with the new items. */
  onAddFiles: (files: File[]) => Promise<Extra[]>;
  onCaption: (takeId: string, text: string) => void;
  /** While the final file is being made, the preview pauses and shows progress. */
  exporting: number | null;
  /** Phone layout: a full-screen editor with a scroll-to-scrub timeline and bottom sheets. */
  compact?: boolean;
  onClose?: () => void;
  sheets?: Partial<Record<"captions" | "style" | "music" | "director" | "export", ReactNode>>;
};

/** Phone timeline scale at zoom 1, in pixels per second. */
const MOBILE_PPS = 64;
const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {}
};

const LABEL_W = 76;
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** The editor: a live preview of the finished video, a timeline to arrange it by hand, and an inspector. */
export function Editor({ timeline, plan, onPlan, state, format, hookTitle, shotTitles, onAddFiles, onCaption, exporting, compact = false, onClose, sheets = {} }: Props) {
  const { style, extras, brand, music, customMusic } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);
  const [blockDrag, setBlockDrag] = useState<BlockDrag | null>(null);
  const [binDrag, setBinDrag] = useState<BinDrag | null>(null);
  // Drags are tracked in refs too: pointer events can outrun React's re-renders.
  const blockDragRef = useRef<BlockDrag | null>(null);
  const binDragRef = useRef<BinDrag | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const [notice, setNotice] = useState("");
  const timeRef = useRef(0);
  const ppsRef = useRef(1);
  const playheadRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const overlayLaneRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [width, setWidth] = useState(600);
  const past = useRef<EditPlan[]>([]);
  const future = useRef<EditPlan[]>([]);
  const [history, setHistory] = useState({ past: 0, future: 0 });
  const [zoom, setZoom] = useState(1);
  const [viewW, setViewW] = useState(360);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const expectedScroll = useRef(-1);
  const compactRef = useRef(compact);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const syncHistory = () => setHistory({ past: past.current.length, future: future.current.length });

  /** Shows the other version. Undo history belongs to one version, so it starts afresh. */
  const switchVersion = (v: Look) => {
    if (v === state.version) return;
    engineRef.current?.pause();
    past.current = [];
    future.current = [];
    syncHistory();
    setSelected(null);
    state.setVersion(v);
  };
  const versionTabs = (
    <div className={e.versions} role="group" aria-label="Version">
      {LOOKS.map((v) => (
        <button key={v} type="button" aria-pressed={state.version === v} onClick={() => switchVersion(v)}>
          {v}
          {state.versions[v].editPlan?.source === "director" && <span className={e.versionDot} aria-label="edited by the Director" />}
        </button>
      ))}
    </div>
  );

  // ---------- engine ----------
  const placePlayhead = useCallback(() => {
    // Phone: the playhead stays in the middle and the timeline scrolls under it.
    if (compactRef.current) {
      const el = scrollRef.current;
      if (el) {
        const x = timeRef.current * ppsRef.current;
        expectedScroll.current = x;
        el.scrollLeft = x;
      }
      return;
    }
    if (playheadRef.current) playheadRef.current.style.transform = `translateX(${LABEL_W + timeRef.current * ppsRef.current}px)`;
  }, []);
  useEffect(() => {
    compactRef.current = compact;
  }, [compact]);

  // The engine draws into this layout's canvas; switching layouts (a tablet rotating) makes a new one.
  const [engineId, setEngineId] = useState(0);
  useEffect(() => {
    const engine = new Engine(canvasRef.current!, "preview", 0.5);
    engine.onPlayingChange = setPlaying;
    let last = 0;
    engine.onTime = (t) => {
      timeRef.current = t;
      placePlayhead();
      const now = performance.now();
      if (now - last > 80) {
        last = now;
        setTime(t);
      }
    };
    engineRef.current = engine;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new engine needs its scene and music again
    setEngineId((n) => n + 1);
    setReady(false);
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [placePlayhead, compact]);

  const lookKey = JSON.stringify({ ...style, musicVolume: 0 });
  const look = useMemo(() => JSON.parse(lookKey) as Style, [lookKey]);
  const normalized = useMemo(() => (timeline && plan ? normalizePlan(plan, timeline, extras, { strict: false }) : null), [timeline, plan, extras]);
  const lay = useMemo(() => (timeline && normalized ? layout(timeline, normalized) : null), [timeline, normalized]);
  const scene = useMemo(
    () => (timeline && normalized ? buildScene(composeEdit(timeline, normalized), look, brand, hookTitle, format) : null),
    [timeline, normalized, look, brand, hookTitle, format],
  );
  const total = scene?.total ?? 0;

  useEffect(() => {
    if (!scene) return;
    const id = setTimeout(() => {
      engineRef.current?.setScene(scene, extras).then(() => setReady(true)).catch(() => setNotice("Couldn’t load one of the clips."));
    }, 120);
    return () => clearTimeout(id);
  }, [scene, extras, engineId]);

  // Music: the generated bed is rendered a little longer than the video, in 30 s steps.
  const musicLength = Math.max(60, Math.ceil((total + 2) / 30) * 30);
  useEffect(() => {
    let live = true;
    (async () => {
      const track = music === "My music" ? customMusic : music === "No music" ? null : await generatedTrack(music, musicLength);
      if (live) engineRef.current?.setMusic(track);
    })();
    return () => {
      live = false;
    };
  }, [music, customMusic, musicLength, engineId]);
  useEffect(() => engineRef.current?.setMusicVolume(style.musicVolume), [style.musicVolume, engineId]);

  useEffect(() => {
    if (exporting !== null) engineRef.current?.pause();
  }, [exporting]);

  // ---------- layout ----------
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const laneW = Math.max(100, width - LABEL_W);
  const pps = compact ? MOBILE_PPS * zoom : total > 0 ? laneW / total : 1;
  useEffect(() => {
    ppsRef.current = pps;
    placePlayhead();
  }, [pps, placePlayhead]);

  // ---------- editing ----------
  const commit = useCallback(
    (next: EditPlan) => {
      if (!plan) return;
      past.current.push(plan);
      if (past.current.length > 50) past.current.shift();
      future.current = [];
      syncHistory();
      onPlan(next);
    },
    [plan, onPlan],
  );
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev || !plan) return;
    future.current.push(plan);
    syncHistory();
    setSelected(null);
    onPlan(prev);
  }, [plan, onPlan]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next || !plan) return;
    past.current.push(plan);
    syncHistory();
    setSelected(null);
    onPlan(next);
  }, [plan, onPlan]);

  const seek = useCallback((t: number) => {
    timeRef.current = Math.max(0, Math.min(t, total));
    placePlayhead();
    setTime(timeRef.current);
    engineRef.current?.seek(timeRef.current);
  }, [total, placePlayhead]);

  const toggle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !ready || exporting !== null) return;
    if (engine.isPlaying) engine.pause();
    else engine.play();
  }, [ready, exporting]);

  const removeSelected = useCallback(() => {
    if (!plan || !selected) return;
    if (selected.kind === "cutaway") commit(removeCutaway(plan, selected.index));
    else if (selected.kind === "callout") commit(removeCallout(plan, selected.index));
    else if (selected.kind === "clip") commit(toggleDrop(plan, selected.segment));
    setSelected(null);
  }, [plan, selected, commit]);

  const binItems: BinItem[] = useMemo(() => {
    const items: BinItem[] = extras.map((x) => ({ source: `extra:${x.id}`, name: x.note || x.name, kind: x.kind, url: x.url, seconds: x.seconds }));
    for (const seg of timeline ?? []) {
      if (!seg.speech) items.push({ source: `shot:${seg.shot}`, name: shotTitles[seg.shot] ?? `Shot ${seg.shot + 1}`, kind: "video", url: seg.take.url, seconds: seg.to - seg.from });
    }
    return items;
  }, [extras, timeline, shotTitles]);

  const place = useCallback(
    (item: BinItem, t: number, base: EditPlan | null = plan) => {
      if (!base || !lay) return base;
      const seconds = item.kind === "image" ? 2.5 : Math.min(item.seconds ?? 3, 3);
      const next = addCutaway(base, lay, item.source, t, seconds, item.kind === "image" ? "pip" : "full");
      if (next === base) setNotice(item.source.startsWith("shot:") ? "B-roll goes over a talking clip — drop it on one." : "No room there.");
      return next;
    },
    [plan, lay],
  );

  const addAtPlayhead = (item: BinItem) => {
    const next = place(item, timeRef.current);
    if (next && next !== plan) {
      commit(next);
      setSelected({ kind: "cutaway", index: next.cutaways.length - 1 });
    }
  };

  const addText = () => {
    if (!plan || !lay) return;
    const next = addCallout(plan, lay, "Your text", Math.min(timeRef.current, lay.seconds - 1), "label");
    if (next === plan) return;
    commit(next);
    setSelected({ kind: "callout", index: next.callouts.length - 1 });
  };

  const addFiles = async (files: File[], at: number | null) => {
    setNotice("");
    // Freeze the current edit first, so new items aren't auto-placed as well as placed by hand.
    const base = plan;
    try {
      const added = await onAddFiles(files);
      if (at === null || !base) return;
      let next: EditPlan | null = base;
      let t = at;
      for (const x of added) {
        next = place({ source: `extra:${x.id}`, name: x.name, kind: x.kind, url: x.url, seconds: x.seconds }, t, next);
        t += x.kind === "image" ? 2.5 : Math.min(x.seconds ?? 3, 3);
      }
      if (next && next !== base) commit(next);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn’t add that file.");
    }
  };

  // Keyboard: space plays, arrows step, delete removes, ⌘Z undoes.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (isTyping(ev.target)) return;
      if (ev.key === " ") {
        ev.preventDefault();
        toggle();
      } else if ((ev.key === "Delete" || ev.key === "Backspace") && selected) {
        ev.preventDefault();
        removeSelected();
      } else if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        if (ev.shiftKey) redo();
        else undo();
      } else if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
        ev.preventDefault();
        seek(timeRef.current + (ev.key === "ArrowLeft" ? -1 : 1) * (ev.shiftKey ? 1 : 0.1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, selected, removeSelected, undo, redo, seek]);

  // ---------- pointer: scrubbing ----------
  const scrubFrom = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    seek(((ev.clientX - rect.left) / rect.width) * total);
  };

  // ---------- pointer: moving and trimming blocks ----------
  const startBlock = (ev: ReactPointerEvent, kind: "cutaway" | "callout", index: number, mode: "move" | "resize", start: number, seconds: number) => {
    ev.stopPropagation();
    ev.preventDefault();
    setSelected({ kind, index });
    blockDragRef.current = { kind, index, mode, startX: ev.clientX, dx: 0, start, seconds };
    setBlockDrag(blockDragRef.current);
  };
  const endBlock = (clientX: number) => {
    const d = blockDragRef.current && { ...blockDragRef.current, dx: clientX - blockDragRef.current.startX };
    blockDragRef.current = null;
    setBlockDrag(null);
    if (!d || !plan || !lay || Math.abs(d.dx) < 3) return;
    const delta = d.dx / pps;
    if (d.mode === "move") {
      commit(d.kind === "cutaway" ? moveCutaway(plan, lay, d.index, d.start + delta) : moveCallout(plan, lay, d.index, d.start + delta));
    } else {
      const item = d.kind === "cutaway" ? plan.cutaways[d.index] : plan.callouts[d.index];
      const seconds = Math.round(Math.max(0.8, Math.min(d.seconds + delta, roomAt(lay, item.segment, item.at))) * 100) / 100;
      commit(d.kind === "cutaway" ? updateCutaway(plan, d.index, { seconds }) : updateCallout(plan, d.index, { seconds }));
    }
  };
  // While a block is held, follow the pointer anywhere on the page.
  useEffect(() => {
    if (!blockDrag) return;
    const onMove = (ev: PointerEvent) => {
      const d = blockDragRef.current;
      if (!d) return;
      blockDragRef.current = { ...d, dx: ev.clientX - d.startX };
      setBlockDrag(blockDragRef.current);
    };
    const onUp = (ev: PointerEvent) => endBlock(ev.clientX);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once per drag
  }, [blockDrag === null]);
  const dragged = (kind: "cutaway" | "callout", index: number, start: number, seconds: number) => {
    const d = blockDrag;
    if (!d || d.kind !== kind || d.index !== index) return { start, seconds };
    const delta = d.dx / pps;
    return d.mode === "move" ? { start: Math.max(0, start + delta), seconds } : { start, seconds: Math.max(0.8, seconds + delta) };
  };

  // ---------- pointer: dragging from the media bin ----------
  useEffect(() => {
    if (!binDrag) return;
    const overLane = (x: number, y: number) => {
      const r = overlayLaneRef.current?.getBoundingClientRect();
      return !!r && x >= r.left && x <= r.right && y >= r.top - 12 && y <= r.bottom + 12;
    };
    const onMove = (ev: PointerEvent) => {
      const d = binDragRef.current;
      if (!d) return;
      binDragRef.current = { ...d, x: ev.clientX, y: ev.clientY, moved: d.moved || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6, over: overLane(ev.clientX, ev.clientY) };
      setBinDrag(binDragRef.current);
    };
    const onUp = (ev: PointerEvent) => {
      const d = binDragRef.current;
      binDragRef.current = null;
      setBinDrag(null);
      if (!d) return;
      const r = overlayLaneRef.current?.getBoundingClientRect();
      if (!d.moved || !r || !overLane(ev.clientX, ev.clientY)) return;
      const next = place(d.item, ((ev.clientX - r.left) / r.width) * total);
      if (next && next !== plan) {
        commit(next);
        setSelected({ kind: "cutaway", index: next.cutaways.length - 1 });
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // Re-subscribe only when a drag starts or ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binDrag === null]);

  // ---------- phone: scroll to scrub, pinch to zoom, sheets ----------
  useEffect(() => {
    const el = scrollRef.current;
    if (!compact || !el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    // Two fingers on the timeline zoom it, keeping the playhead's moment in place.
    let start: { d: number; z: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (ev: TouchEvent) => {
      if (ev.touches.length === 2) start = { d: dist(ev.touches), z: zoomRef.current };
    };
    const onMove = (ev: TouchEvent) => {
      if (ev.touches.length !== 2 || !start) return;
      ev.preventDefault();
      setZoom(Math.min(4, Math.max(0.35, start.z * (dist(ev.touches) / start.d))));
    };
    const onEnd = (ev: TouchEvent) => {
      if (ev.touches.length < 2) start = null;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    return () => {
      ro.disconnect();
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [compact]);
  /** The creator scrolled the timeline: pause and show that moment. */
  const onTimelineScroll = () => {
    const el = scrollRef.current;
    if (!el || Math.abs(el.scrollLeft - expectedScroll.current) < 1.5) return;
    expectedScroll.current = -1;
    const engine = engineRef.current;
    if (engine?.isPlaying) engine.pause();
    const t = Math.max(0, Math.min(el.scrollLeft / ppsRef.current, total));
    timeRef.current = t;
    setTime(t);
    engine?.seek(t);
  };

  // While the editor fills the phone screen, the page behind it doesn't scroll.
  useEffect(() => {
    if (!compact) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [compact]);

  const openSheet = (name: SheetName | null) => {
    engineRef.current?.pause();
    setSheet(name);
  };

  // ---------- trimming clips ----------
  // A slider drag is one undo step: the plan before the drag is pushed when it ends.
  const trimBase = useRef<EditPlan | null>(null);
  const trimLive = (segment: number, from: number, to: number, edge: "from" | "to") => {
    if (!plan || !timeline || !lay) return;
    trimBase.current ??= plan;
    onPlan(setTrim(plan, timeline, segment, from, to));
    // Show the frame at the edge being moved.
    const start = lay.clips.find((c) => c.segment === segment)?.start ?? 0;
    seek(edge === "from" ? start : start + Math.max(0, to - from - 0.05));
  };
  const trimDone = () => {
    if (!trimBase.current) return;
    past.current.push(trimBase.current);
    future.current = [];
    trimBase.current = null;
    syncHistory();
  };
  const trimControls = (segment: number) => {
    if (!plan || !timeline?.[segment]) return null;
    const seg = timeline[segment];
    const { max } = clipBounds(seg);
    const w = clipWindow(plan, timeline, segment);
    const trimmed = plan.trims.some((t) => t.segment === segment);
    const nudge = (from: number, to: number) => commit(setTrim(plan, timeline, segment, from, to));
    const row = (edge: "from" | "to", label: string) => (
      <div className={e.trimRow}>
        <span className={e.trimLabel}>{label}</span>
        <button type="button" className={e.trimNudge} aria-label={`${label} 0.1 seconds earlier`} onClick={() => (edge === "from" ? nudge(w.from - 0.1, w.to) : nudge(w.from, w.to - 0.1))}>−</button>
        <input
          type="range"
          min={0}
          max={Math.round(max * 100) / 100}
          step={0.05}
          value={edge === "from" ? w.from : w.to}
          aria-label={`Clip ${label.toLowerCase()}`}
          onChange={(ev) => {
            const v = Number(ev.target.value);
            if (edge === "from") trimLive(segment, v, w.to, "from");
            else trimLive(segment, w.from, v, "to");
          }}
          onPointerUp={trimDone}
          onKeyUp={trimDone}
          onBlur={trimDone}
        />
        <button type="button" className={e.trimNudge} aria-label={`${label} 0.1 seconds later`} onClick={() => (edge === "from" ? nudge(w.from + 0.1, w.to) : nudge(w.from, w.to + 0.1))}>+</button>
        <span className={e.trimVal}>{(edge === "from" ? w.from : w.to).toFixed(1)}s</span>
      </div>
    );
    return (
      <div className={e.trim}>
        <div className={e.trimHead}>
          <span>Clip length <strong>{(w.to - w.from).toFixed(1)}s</strong> <span className={e.trimOf}>of {max.toFixed(1)}s recorded</span></span>
          {trimmed && <button type="button" className={e.toolBtn} onClick={() => commit(resetTrim(plan, segment))}>Auto trim</button>}
        </div>
        {row("from", "Start")}
        {row("to", "End")}
      </div>
    );
  };

  // ---------- render ----------
  // Label spacing that never crowds: the smallest step at least 48 px apart.
  const ticks = useMemo(() => {
    const step = [1, 2, 5, 10, 15, 30, 60].find((x) => x * pps >= 48) ?? 60;
    return Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step);
  }, [total, pps]);

  const sel = selected;
  const selCutaway = sel?.kind === "cutaway" ? plan?.cutaways[sel.index] : undefined;
  const selCallout = sel?.kind === "callout" ? plan?.callouts[sel.index] : undefined;
  const selClip = sel?.kind === "clip" && timeline ? timeline[sel.segment] : undefined;
  const nameOf = (source: string) => binItems.find((b) => b.source === source);
  const dropped = (plan?.drop ?? []).filter((d) => timeline?.[d]);

  if (compact) {
    const pad = viewW / 2;
    const trackW = pad * 2 + total * pps;
    const x = (t: number) => pad + t * pps;
    const fileInput = (
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(ev) => {
          const files = Array.from(ev.target.files ?? []);
          ev.target.value = "";
          setSheet(null);
          if (files.length) addFiles(files, timeRef.current);
        }}
      />
    );
    const step = (dir: -1 | 1) => (dur: number) => Math.round(Math.max(0.8, dur + dir * 0.5) * 10) / 10;
    const tools: { name: SheetName | "text-add"; icon: Parameters<typeof Icon>[0]["name"]; label: string }[] = [
      { name: "media", icon: "image-plus", label: "Media" },
      { name: "text-add", icon: "type", label: "Text" },
      { name: "captions", icon: "message", label: "Captions" },
      { name: "style", icon: "sparkles", label: "Style" },
      { name: "music", icon: "volume", label: "Music" },
      { name: "director", icon: "zap", label: "Director" },
    ];
    const sheetTitle: Record<SheetName, string> = {
      media: "Pictures & clips", text: "Text", captions: "Captions", style: "Style", music: "Music", director: "Ask the Director",
      export: "Export", clip: "This clip",
    };

    return (
      <section className={e.m} aria-label="Video editor">
        <header className={e.mTop}>
          <button type="button" className={e.mIcon} onClick={onClose} aria-label="Close editor"><Icon name="x" size={20} /></button>
          <span className={e.mTitle}>{versionTabs}</span>
          <button type="button" className={e.mIcon} onClick={undo} disabled={!history.past} aria-label="Undo"><Icon name="undo" size={18} /></button>
          <button type="button" className={e.mIcon} onClick={redo} disabled={!history.future} aria-label="Redo"><Icon name="redo" size={18} /></button>
          <button type="button" className={e.mExport} onClick={() => openSheet("export")}>Export</button>
        </header>

        <div className={e.mStage} onClick={toggle}>
          <div className={e.mScreen} style={{ aspectRatio: format === "4:5" ? "4 / 5" : "9 / 16" }}>
            <canvas ref={canvasRef} aria-label="Preview of your video" />
            {!ready && <div className={e.screenNote}>Lining up your clips…</div>}
            {exporting !== null && <div className={e.screenNote}>Making the final file · {Math.round(exporting * 100)}%<br />Keep this screen on.</div>}
            {ready && !playing && exporting === null && (
              <span className={e.mBigPlay} aria-hidden><Icon name="play" size={30} /></span>
            )}
          </div>
        </div>

        <div className={e.mTransport}>
          <span className={e.clock}>{fmt(time)} <span className={e.mClockTotal}>/ {fmt(total)}</span></span>
          <button type="button" className={e.playBtn} onClick={toggle} disabled={!ready || exporting !== null} aria-label={playing ? "Pause" : "Play"}>
            <Icon name={playing ? "pause" : "play"} size={20} />
          </button>
          <span className={e.mZoom}>
            <button type="button" className={e.mIcon} onClick={() => setZoom((z) => Math.max(0.35, z / 1.5))} aria-label="Zoom out">−</button>
            <button type="button" className={e.mIcon} onClick={() => setZoom((z) => Math.min(4, z * 1.5))} aria-label="Zoom in">+</button>
          </span>
        </div>

        <div className={e.mTimelineWrap}>
          <div ref={scrollRef} className={e.mTimeline} onScroll={onTimelineScroll} aria-label="Timeline — swipe to move through your video">
            <div className={e.mTrack} style={{ width: trackW }}>
              <div className={e.mRuler}>
                {ticks.map((t) => (
                  <span key={t} className={e.tickLabel} style={{ left: x(t) }}>{fmt(t).replace(/\.\d$/, "")}</span>
                ))}
              </div>
              <div className={e.mLane}>
                {lay?.clips.map((c) => (
                  <button
                    type="button"
                    key={c.segment}
                    className={`${e.mBlock} ${e.clipBlock} ${c.speech ? e.clipSpeech : ""} ${sel?.kind === "clip" && sel.segment === c.segment ? e.blockSel : ""}`}
                    style={{ left: x(c.start) + 1, width: Math.max(6, (c.end - c.start) * pps - 2) }}
                    onClick={() => {
                      buzz();
                      setSelected({ kind: "clip", segment: c.segment });
                    }}
                  >
                    {shotTitles[c.shot] ?? `Shot ${c.shot + 1}`}
                  </button>
                ))}
                {scene && brand && (
                  <div className={`${e.mBlock} ${e.endBlock}`} style={{ left: x(scene.seqSeconds) + 1, width: Math.max(6, (total - scene.seqSeconds) * pps - 2) }}>End card</div>
                )}
              </div>
              <div className={e.mLane}>
                {plan && lay && plan.cutaways.map((c, i) => {
                  const at = toVideoTime(lay, c.segment, c.at);
                  if (at === null) return null;
                  const pos = dragged("cutaway", i, at, c.seconds);
                  const item = nameOf(c.source);
                  const on = sel?.kind === "cutaway" && sel.index === i;
                  return (
                    <div
                      key={`${c.source}-${i}`}
                      className={`${e.mBlock} ${e.overlayBlock} ${c.style === "pip" ? e.pipBlock : ""} ${on ? `${e.blockSel} ${e.mGrab}` : ""}`}
                      style={{ left: x(pos.start), width: Math.max(10, pos.seconds * pps) }}
                      onPointerDown={on ? (ev) => startBlock(ev, "cutaway", i, "move", at, c.seconds) : undefined}
                      onClick={() => {
                        if (!on) buzz();
                        setSelected({ kind: "cutaway", index: i });
                      }}
                    >
                      {item?.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                        <img className={e.thumbMini} src={item.url} alt="" />
                      ) : (
                        <Icon name="video" size={12} />
                      )}
                      {item?.name ?? "Overlay"}
                      {on && <span className={e.mHandle} onPointerDown={(ev) => startBlock(ev, "cutaway", i, "resize", at, c.seconds)} />}
                    </div>
                  );
                })}
              </div>
              <div className={e.mLane}>
                {plan && lay && plan.callouts.map((c, i) => {
                  const at = toVideoTime(lay, c.segment, c.at);
                  if (at === null) return null;
                  const pos = dragged("callout", i, at, c.seconds);
                  const on = sel?.kind === "callout" && sel.index === i;
                  return (
                    <div
                      key={`${c.text}-${i}`}
                      className={`${e.mBlock} ${e.textBlock} ${c.style === "stat" ? e.statBlock : ""} ${c.style === "card" || c.style === "takeaway" ? e.cardBlock : ""} ${on ? `${e.blockSel} ${e.mGrab}` : ""}`}
                      style={{ left: x(pos.start), width: Math.max(10, pos.seconds * pps) }}
                      onPointerDown={on ? (ev) => startBlock(ev, "callout", i, "move", at, c.seconds) : undefined}
                      onClick={() => {
                        if (!on) buzz();
                        setSelected({ kind: "callout", index: i });
                      }}
                    >
                      <Icon name={BLOCK_ICON[c.style]} size={12} /> {c.text}
                      {on && <span className={e.mHandle} onPointerDown={(ev) => startBlock(ev, "callout", i, "resize", at, c.seconds)} />}
                    </div>
                  );
                })}
              </div>
              <div className={`${e.mLane} ${e.mMusicLane}`} style={{ left: pad, width: total * pps }}>
                <Icon name="volume" size={12} /> {music === "No music" ? "No music" : music === "My music" ? (customMusic?.name ?? "Choose a song") : music} · {Math.round(style.musicVolume * 100)}%
              </div>
            </div>
          </div>
          <div className={e.mPlayhead} aria-hidden />
        </div>

        {notice && <div className={e.mNotice} role="status" onClick={() => setNotice("")}>{notice}</div>}

        <nav className={e.mBar} aria-label={sel ? "Edit selected" : "Tools"}>
          {selCutaway && sel?.kind === "cutaway" && lay ? (
            <>
              <button type="button" className={e.mTool} onClick={() => commit(updateCutaway(plan!, sel.index, { style: selCutaway.style === "pip" ? "full" : "pip" }))}>
                <Icon name="scan-face" size={20} />{selCutaway.style === "pip" ? "Make full" : "Make card"}
              </button>
              <button type="button" className={e.mTool} onClick={() => commit(updateCutaway(plan!, sel.index, { seconds: step(-1)(selCutaway.seconds) }))}>
                <span className={e.mToolGlyph}>−</span>Shorter
              </button>
              <span className={e.mToolValue}>{selCutaway.seconds.toFixed(1)}s</span>
              <button type="button" className={e.mTool} onClick={() => commit(updateCutaway(plan!, sel.index, { seconds: Math.min(step(1)(selCutaway.seconds), roomAt(lay, selCutaway.segment, selCutaway.at)) }))}>
                <span className={e.mToolGlyph}>+</span>Longer
              </button>
              <button type="button" className={`${e.mTool} ${e.mDanger}`} onClick={removeSelected}><Icon name="trash" size={20} />Delete</button>
              <button type="button" className={`${e.mTool} ${e.mDone}`} onClick={() => setSelected(null)}><Icon name="check" size={20} />Done</button>
            </>
          ) : selCallout && sel?.kind === "callout" && lay ? (
            <>
              <button type="button" className={e.mTool} onClick={() => openSheet("text")}><Icon name="pencil" size={20} />Edit</button>
              {(selCallout.style === "stat" || selCallout.style === "label") && (
                <button type="button" className={e.mTool} onClick={() => commit(updateCallout(plan!, sel.index, { style: selCallout.style === "stat" ? "label" : "stat" }))}>
                  <Icon name="type" size={20} />{selCallout.style === "stat" ? "Label" : "Number"}
                </button>
              )}
              <button type="button" className={e.mTool} onClick={() => commit(updateCallout(plan!, sel.index, { seconds: step(-1)(selCallout.seconds) }))}>
                <span className={e.mToolGlyph}>−</span>Shorter
              </button>
              <button type="button" className={e.mTool} onClick={() => commit(updateCallout(plan!, sel.index, { seconds: Math.min(step(1)(selCallout.seconds), roomAt(lay, selCallout.segment, selCallout.at)) }))}>
                <span className={e.mToolGlyph}>+</span>Longer
              </button>
              <button type="button" className={`${e.mTool} ${e.mDanger}`} onClick={removeSelected}><Icon name="trash" size={20} />Delete</button>
              <button type="button" className={`${e.mTool} ${e.mDone}`} onClick={() => setSelected(null)}><Icon name="check" size={20} />Done</button>
            </>
          ) : selClip && sel?.kind === "clip" ? (
            <>
              <button type="button" className={e.mTool} onClick={() => openSheet("clip")}><Icon name="scissors" size={20} />Trim</button>
              {selClip.speech && <button type="button" className={e.mTool} onClick={() => openSheet("clip")}><Icon name="message" size={20} />Captions</button>}
              <button type="button" className={`${e.mTool} ${e.mDanger}`} onClick={removeSelected}><Icon name="trash" size={20} />Remove clip</button>
              {dropped.length > 0 && (
                <button type="button" className={e.mTool} onClick={() => commit(toggleDrop(plan!, dropped[dropped.length - 1]))}><Icon name="undo" size={20} />Put back</button>
              )}
              <button type="button" className={`${e.mTool} ${e.mDone}`} onClick={() => setSelected(null)}><Icon name="check" size={20} />Done</button>
            </>
          ) : (
            <>
              {tools.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  className={e.mTool}
                  onClick={() => {
                    if (t.name === "text-add") {
                      addText();
                      openSheet("text");
                    } else openSheet(t.name);
                  }}
                >
                  <Icon name={t.icon} size={20} />
                  {t.label}
                </button>
              ))}
              {dropped.length > 0 && (
                <button type="button" className={e.mTool} onClick={() => commit(toggleDrop(plan!, dropped[dropped.length - 1]))}><Icon name="undo" size={20} />Put back</button>
              )}
            </>
          )}
        </nav>
        {fileInput}

        {sheet && (
          <>
            <div className={e.mScrim} onClick={() => setSheet(null)} />
            <div className={e.mSheet} role="dialog" aria-label={sheetTitle[sheet]}>
              <div className={e.mSheetHead}>
                <span className={e.mGrabber} aria-hidden />
                <span className={e.mSheetTitle}>{sheetTitle[sheet]}</span>
                <button type="button" className={e.mSheetDone} onClick={() => setSheet(null)}>Done</button>
              </div>
              <div className={e.mSheetBody}>
                {sheet === "media" && (
                  <div className={e.mMediaGrid}>
                    <button type="button" className={e.mMediaNew} onClick={() => fileRef.current?.click()}>
                      <Icon name="plus" size={22} />Add from your phone
                    </button>
                    {binItems.map((item) => (
                      <button
                        type="button"
                        key={item.source}
                        className={e.mMediaItem}
                        onClick={() => {
                          addAtPlayhead(item);
                          setSheet(null);
                          buzz();
                        }}
                      >
                        <Thumb url={item.url} kind={item.kind} />
                        <span>{item.name}</span>
                      </button>
                    ))}
                    <p className={e.mSheetHint}>Tap one to put it at the playhead ({fmt(time)}). Then drag it on the timeline, or use Shorter / Longer.</p>
                  </div>
                )}
                {sheet === "text" && selCallout && sel?.kind === "callout" && (
                  <div className={e.mForm}>
                    <CalloutFields
                      c={selCallout}
                      phone
                      onLive={(patch) => onPlan(updateCallout(plan!, sel.index, patch))}
                      onCommit={(patch) => commit(updateCallout(plan!, sel.index, patch))}
                      onDone={() => setSheet(null)}
                    />
                  </div>
                )}
                {sheet === "text" && !selCallout && <p className={e.mSheetHint}>No room for text here — move the playhead onto a clip.</p>}
                {sheet === "clip" && selClip && (
                  <div className={e.mForm}>
                    {sel?.kind === "clip" && trimControls(sel.segment)}
                    {selClip.speech && <textarea
                      className={e.mField}
                      aria-label="Captions for this clip"
                      rows={3}
                      defaultValue={selClip.words.map((w) => w.word).join(" ")}
                      key={selClip.take.id}
                      onBlur={(ev) => onCaption(selClip.take.id, ev.target.value)}
                    />}
                    {selClip.speech && <p className={e.mSheetHint}>Fix any word — the timing stays matched to your voice.</p>}
                  </div>
                )}
                {(sheet === "captions" || sheet === "style" || sheet === "music" || sheet === "director" || sheet === "export") && (
                  <div className={e.mLight}>{sheets[sheet]}</div>
                )}
              </div>
            </div>
          </>
        )}

      </section>
    );
  }

  return (
    <section className={e.editor} aria-label="Video editor">
      <div className={e.stage}>
        {versionTabs}
        <div className={e.screen} style={{ aspectRatio: format === "4:5" ? "4 / 5" : "9 / 16" }}>
          <canvas ref={canvasRef} aria-label="Preview of your video" onClick={toggle} />
          {!ready && <div className={e.screenNote}>Lining up your clips…</div>}
          {exporting !== null && <div className={e.screenNote}>Making the final file · {Math.round(exporting * 100)}%<br />Keep this tab open.</div>}
        </div>
        <div className={e.transport}>
          <button type="button" className={e.playBtn} onClick={toggle} disabled={!ready || exporting !== null} aria-label={playing ? "Pause" : "Play"}>
            <Icon name={playing ? "pause" : "play"} size={20} />
          </button>
          <span className={e.clock}>{fmt(time)} / {fmt(total)}</span>
        </div>
      </div>

      <div className={e.workArea}>
        <div className={e.toolbar}>
          <button type="button" className={e.toolBtn} onClick={addText} disabled={!lay}><Icon name="type" size={14} /> Add text</button>
          <button type="button" className={e.toolBtn} onClick={() => fileRef.current?.click()}><Icon name="image-plus" size={14} /> Add pictures or clips</button>
          <span className={e.spacer} />
          <button type="button" className={e.toolBtn} onClick={undo} disabled={!history.past} aria-label="Undo"><Icon name="undo" size={14} /></button>
          <button type="button" className={e.toolBtn} onClick={redo} disabled={!history.future} aria-label="Redo"><Icon name="redo" size={14} /></button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(ev) => {
              const files = Array.from(ev.target.files ?? []);
              ev.target.value = "";
              if (files.length) addFiles(files, timeRef.current);
            }}
          />
        </div>

        <div className={e.timeline} ref={bodyRef}>
          <div className={e.ruler} onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); scrubFrom(ev); }} onPointerMove={(ev) => ev.buttons && scrubFrom(ev)} aria-label="Scrub">
            {ticks.map((t) => (
              <span key={t}>
                <span className={e.tick} style={{ left: t * pps }} />
                <span className={e.tickLabel} style={{ left: t * pps }}>{fmt(t).replace(/\.\d$/, "")}</span>
              </span>
            ))}
          </div>

          <div className={e.lane}>
            <span className={e.laneLabel}>Clips</span>
            <div className={e.laneBody}>
              {lay?.clips.map((c) => (
                <div
                  key={c.segment}
                  className={`${e.block} ${e.clipBlock} ${c.speech ? e.clipSpeech : ""} ${sel?.kind === "clip" && sel.segment === c.segment ? e.blockSel : ""}`}
                  style={{ left: c.start * pps + 1, width: Math.max(4, (c.end - c.start) * pps - 2) }}
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    setSelected({ kind: "clip", segment: c.segment });
                    seek(c.start + (ev.clientX - (ev.currentTarget as HTMLElement).getBoundingClientRect().left) / pps);
                  }}
                  title={shotTitles[c.shot]}
                >
                  {shotTitles[c.shot] ?? `Shot ${c.shot + 1}`}
                </div>
              ))}
              {scene && brand && (
                <div className={`${e.block} ${e.endBlock}`} style={{ left: scene.seqSeconds * pps + 1, width: Math.max(4, (total - scene.seqSeconds) * pps - 2) }}>
                  End card
                </div>
              )}
            </div>
          </div>

          <div className={e.lane}>
            <span className={e.laneLabel}>Overlays</span>
            <div
              ref={overlayLaneRef}
              className={`${e.laneBody} ${binDrag?.over || fileOver ? e.laneDrop : ""}`}
              onDragOver={(ev) => {
                if (ev.dataTransfer.types.includes("Files")) {
                  ev.preventDefault();
                  setFileOver(true);
                }
              }}
              onDragLeave={() => setFileOver(false)}
              onDrop={(ev) => {
                ev.preventDefault();
                setFileOver(false);
                const r = ev.currentTarget.getBoundingClientRect();
                const files = Array.from(ev.dataTransfer.files).filter((f) => /^(image|video)\//.test(f.type));
                if (files.length) addFiles(files, ((ev.clientX - r.left) / r.width) * total);
              }}
            >
              {plan && lay && plan.cutaways.map((c, i) => {
                const at = toVideoTime(lay, c.segment, c.at);
                if (at === null) return null;
                const pos = dragged("cutaway", i, at, c.seconds);
                const item = nameOf(c.source);
                return (
                  <div
                    key={`${c.source}-${i}`}
                    className={`${e.block} ${e.overlayBlock} ${c.style === "pip" ? e.pipBlock : ""} ${sel?.kind === "cutaway" && sel.index === i ? e.blockSel : ""}`}
                    style={{ left: pos.start * pps, width: Math.max(8, pos.seconds * pps) }}
                    onPointerDown={(ev) => startBlock(ev, "cutaway", i, "move", at, c.seconds)}
                    title={item?.name}
                  >
                    {item?.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                      <img className={e.thumbMini} src={item.url} alt="" />
                    ) : (
                      <Icon name="video" size={12} />
                    )}
                    {c.style === "pip" ? "Card" : "Full"} · {item?.name ?? c.source}
                    <span className={e.handle} onPointerDown={(ev) => startBlock(ev, "cutaway", i, "resize", at, c.seconds)} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className={e.lane}>
            <span className={e.laneLabel}>Text</span>
            <div className={e.laneBody}>
              {plan && lay && plan.callouts.map((c, i) => {
                const at = toVideoTime(lay, c.segment, c.at);
                if (at === null) return null;
                const pos = dragged("callout", i, at, c.seconds);
                return (
                  <div
                    key={`${c.text}-${i}`}
                    className={`${e.block} ${e.textBlock} ${c.style === "stat" ? e.statBlock : ""} ${c.style === "card" || c.style === "takeaway" ? e.cardBlock : ""} ${sel?.kind === "callout" && sel.index === i ? e.blockSel : ""}`}
                    style={{ left: pos.start * pps, width: Math.max(8, pos.seconds * pps) }}
                    onPointerDown={(ev) => startBlock(ev, "callout", i, "move", at, c.seconds)}
                  >
                    <Icon name={BLOCK_ICON[c.style]} size={12} /> {c.style === "card" ? "Card · " : ""}{c.text}
                    <span className={e.handle} onPointerDown={(ev) => startBlock(ev, "callout", i, "resize", at, c.seconds)} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className={e.lane}>
            <span className={e.laneLabel}>Music</span>
            <div className={`${e.laneBody} ${e.musicBody}`}>
              <Icon name="volume" size={14} />
              <span className={e.musicName}>
                {music === "My music" ? (customMusic?.name ?? "Choose a song below") : music}
              </span>
              {music !== "No music" && (
                <>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(style.musicVolume * 100)}
                    onChange={(ev) => state.setStyle((x) => ({ ...x, musicVolume: Number(ev.target.value) / 100 }))}
                    aria-label="Music volume (live)"
                  />
                  <span style={{ minWidth: 34, textAlign: "right" }}>{Math.round(style.musicVolume * 100)}%</span>
                </>
              )}
            </div>
          </div>

          <div ref={playheadRef} className={e.playhead} style={{ left: 0, transform: `translateX(${LABEL_W + time * pps}px)` }} />
        </div>

        <div className={e.bin} aria-label="Your pictures and clips">
          {binItems.map((item) => (
            <div
              key={item.source}
              className={e.binItem}
              onPointerDown={(ev) => {
                if ((ev.target as HTMLElement).closest("button")) return;
                ev.preventDefault();
                binDragRef.current = { item, x: ev.clientX, y: ev.clientY, moved: false, over: false };
                setBinDrag(binDragRef.current);
              }}
              title="Drag onto the Overlays row, or add at the playhead"
            >
              <Thumb className={e.binThumb} url={item.url} kind={item.kind} />
              <span className={e.binName}>{item.name}</span>
              <button type="button" className={e.binAdd} onClick={() => addAtPlayhead(item)}>+ At playhead</button>
            </div>
          ))}
          <button type="button" className={e.binNew} onClick={() => fileRef.current?.click()}>
            <Icon name="plus" size={18} /> Add pictures or clips
          </button>
        </div>

        <div className={e.inspector} aria-live="polite">
          {selCutaway && sel?.kind === "cutaway" && lay ? (
            <>
              <span className={e.inspectorTitle}>{nameOf(selCutaway.source)?.name ?? "Overlay"}</span>
              <div className={e.inspectorRow}>
                <div className={e.seg} role="group" aria-label="Overlay style">
                  <button type="button" aria-pressed={selCutaway.style === "full"} onClick={() => commit(updateCutaway(plan!, sel.index, { style: "full" }))}>Full screen</button>
                  <button type="button" aria-pressed={selCutaway.style === "pip"} onClick={() => commit(updateCutaway(plan!, sel.index, { style: "pip" }))}>Card</button>
                </div>
                <label className={e.inspectorRow} style={{ gap: 6 }}>
                  Seconds
                  <input
                    className={e.field}
                    type="number"
                    min={0.8}
                    step={0.1}
                    max={roomAt(lay, selCutaway.segment, selCutaway.at)}
                    value={selCutaway.seconds}
                    style={{ width: 80 }}
                    onChange={(ev) => commit(updateCutaway(plan!, sel.index, { seconds: Math.max(0.8, Math.min(Number(ev.target.value) || 0.8, roomAt(lay, selCutaway.segment, selCutaway.at))) }))}
                  />
                </label>
                <button type="button" className={`${e.toolBtn} ${e.danger}`} onClick={removeSelected}><Icon name="trash" size={14} /> Remove</button>
              </div>
            </>
          ) : selCallout && sel?.kind === "callout" && lay ? (
            <>
              <CalloutFields
                c={selCallout}
                phone={false}
                onLive={(patch) => onPlan(updateCallout(plan!, sel.index, patch))}
                onCommit={(patch) => commit(updateCallout(plan!, sel.index, patch))}
              />
              <div className={e.inspectorRow}>
                <label className={e.inspectorRow} style={{ gap: 6 }}>
                  Seconds
                  <input
                    className={e.field}
                    type="number"
                    min={0.8}
                    step={0.1}
                    value={selCallout.seconds}
                    style={{ width: 80 }}
                    onChange={(ev) => commit(updateCallout(plan!, sel.index, { seconds: Math.max(0.8, Math.min(Number(ev.target.value) || 0.8, roomAt(lay, selCallout.segment, selCallout.at))) }))}
                  />
                </label>
                <button type="button" className={`${e.toolBtn} ${e.danger}`} onClick={removeSelected}><Icon name="trash" size={14} /> Remove</button>
              </div>
            </>
          ) : selClip && sel?.kind === "clip" ? (
            <>
              <span className={e.inspectorTitle}>{shotTitles[selClip.shot] ?? `Shot ${selClip.shot + 1}`}</span>
              {sel?.kind === "clip" && trimControls(sel.segment)}
              {selClip.speech && (
                <textarea
                  className={e.field}
                  aria-label="Captions for this clip"
                  rows={2}
                  defaultValue={selClip.words.map((w) => w.word).join(" ")}
                  key={selClip.take.id}
                  onBlur={(ev) => onCaption(selClip.take.id, ev.target.value)}
                />
              )}
              <div className={e.inspectorRow}>
                {selClip.speech && <span className={e.hint}>Fix any caption word, then click away.</span>}
                <button type="button" className={`${e.toolBtn} ${e.danger}`} onClick={removeSelected}><Icon name="trash" size={14} /> Remove this clip</button>
              </div>
            </>
          ) : (
            <span className={e.hint}>
              Drag a picture or clip onto <strong>Overlays</strong> (or tap <strong>+ At playhead</strong>), drop files straight from your computer, or
              add text. Drag blocks to move them, drag their right edge to make them longer. Space plays, ⌘/Ctrl+Z undoes.
            </span>
          )}
          {dropped.length > 0 && (
            <div className={e.inspectorRow}>
              <span className={e.hint}>Removed:</span>
              {dropped.map((d) => (
                <button key={d} type="button" className={e.toolBtn} onClick={() => commit(toggleDrop(plan!, d))}>
                  <Icon name="undo" size={12} /> {shotTitles[timeline![d].shot] ?? `Shot ${d + 1}`}
                </button>
              ))}
            </div>
          )}
          {notice && <span className={e.hint} role="status">{notice}</span>}
        </div>
      </div>

      {binDrag?.moved && (
        <div className={e.ghost} style={{ left: binDrag.x, top: binDrag.y }}>
          {binDrag.item.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={binDrag.item.url} alt="" />
          ) : (
            <video src={`${binDrag.item.url}#t=0.5`} muted playsInline />
          )}
        </div>
      )}
    </section>
  );
}
