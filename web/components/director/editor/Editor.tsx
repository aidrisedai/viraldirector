"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "@/components/ds/Icon";
import type { FormatKey, Segment } from "@/lib/edit";
import { composeEdit, normalizePlan, type EditPlan, type Extra, type Style } from "@/lib/editPlan";
import {
  addCallout, addCutaway, layout, moveCallout, moveCutaway, removeCallout, removeCutaway, roomAt, toggleDrop, toVideoTime,
  updateCallout, updateCutaway,
} from "@/lib/timeline";
import type { ExportState } from "../export/useExportState";
import { buildScene } from "../render/compositor";
import { Engine } from "../render/engine";
import { generatedTrack } from "../render/musicTrack";
import e from "./editor.module.css";

type Selection = { kind: "cutaway" | "callout"; index: number } | { kind: "clip"; segment: number } | null;
type BinItem = { source: string; name: string; kind: "image" | "video"; url: string; seconds: number | null };
type BlockDrag = { kind: "cutaway" | "callout"; index: number; mode: "move" | "resize"; startX: number; dx: number; start: number; seconds: number };
type BinDrag = { item: BinItem; x: number; y: number; moved: boolean; over: boolean };

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
};

const LABEL_W = 76;
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** The editor: a live preview of the finished video, a timeline to arrange it by hand, and an inspector. */
export function Editor({ timeline, plan, onPlan, state, format, hookTitle, shotTitles, onAddFiles, onCaption, exporting }: Props) {
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
  const syncHistory = () => setHistory({ past: past.current.length, future: future.current.length });

  // ---------- engine ----------
  const placePlayhead = useCallback(() => {
    if (playheadRef.current) playheadRef.current.style.transform = `translateX(${LABEL_W + timeRef.current * ppsRef.current}px)`;
  }, []);

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
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [placePlayhead]);

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
  }, [scene, extras]);

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
  }, [music, customMusic, musicLength]);
  useEffect(() => engineRef.current?.setMusicVolume(style.musicVolume), [style.musicVolume]);

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
  const pps = total > 0 ? laneW / total : 1;
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

  return (
    <section className={e.editor} aria-label="Video editor">
      <div className={e.stage}>
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
                    className={`${e.block} ${e.textBlock} ${c.style === "stat" ? e.statBlock : ""} ${sel?.kind === "callout" && sel.index === i ? e.blockSel : ""}`}
                    style={{ left: pos.start * pps, width: Math.max(8, pos.seconds * pps) }}
                    onPointerDown={(ev) => startBlock(ev, "callout", i, "move", at, c.seconds)}
                  >
                    <Icon name="type" size={12} /> {c.text}
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
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img className={e.binThumb} src={item.url} alt="" draggable={false} />
              ) : (
                <video className={e.binThumb} src={`${item.url}#t=0.5`} muted playsInline preload="metadata" />
              )}
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
              <input
                className={e.field}
                aria-label="On-screen text"
                maxLength={48}
                value={selCallout.text}
                autoFocus={selCallout.text === "Your text"}
                onFocus={(ev) => selCallout.text === "Your text" && ev.currentTarget.select()}
                onChange={(ev) => onPlan(updateCallout(plan!, sel.index, { text: ev.target.value || " " }))}
              />
              <div className={e.inspectorRow}>
                <div className={e.seg} role="group" aria-label="Text style">
                  <button type="button" aria-pressed={selCallout.style === "label"} onClick={() => commit(updateCallout(plan!, sel.index, { style: "label" }))}>Label</button>
                  <button type="button" aria-pressed={selCallout.style === "stat"} onClick={() => commit(updateCallout(plan!, sel.index, { style: "stat" }))}>Big number</button>
                </div>
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
              <span className={e.inspectorTitle}>{shotTitles[selClip.shot] ?? `Shot ${selClip.shot + 1}`} · {(selClip.to - selClip.from).toFixed(1)}s</span>
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
