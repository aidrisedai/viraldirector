"use client";

import type { FormatKey } from "@/lib/edit";
import type { ComposedEdit, Extra, Style } from "@/lib/editPlan";
import { buildScene } from "./compositor";
import { Engine } from "./engine";
import type { MusicTrack } from "./musicTrack";

export { END_CARD_SECONDS, TAGLINE } from "./compositor";

export type RenderOptions = {
  edit: ComposedEdit;
  extras: Extra[];
  format: FormatKey;
  /** The music bed (generated or the creator's own), or null for none. */
  music: MusicTrack | null;
  style: Style;
  /** EdAI opening logo panel and end card. */
  brand: boolean;
  /** The chosen hook; the opening title unless the style overrides it. */
  hookTitle: string;
  canvas: HTMLCanvasElement;
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
};

export type RenderResult = { blob: Blob; mime: string; seconds: number };

// MP4 (H.264 + AAC) first: Instagram and TikTok take it directly. 640028 = High profile, level 4.0 (1080p).
const OUTPUT_TYPES = [
  'video/mp4;codecs="avc1.640028,mp4a.40.2"',
  'video/mp4;codecs="avc1.4D4028,mp4a.40.2"',
  "video/mp4;codecs=avc1",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export const outputType = () =>
  typeof MediaRecorder === "undefined" ? null : (OUTPUT_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null);

/** Renders the edit to a single video file in real time — the same playback the editor previews. */
export async function renderVideo(o: RenderOptions): Promise<RenderResult> {
  const mime = outputType();
  if (!mime) throw new Error("This browser can’t create videos. Try the latest Chrome, Edge or Safari.");
  if (!o.edit.sequence.length) throw new Error("Keep at least one take first.");
  const scene = buildScene(o.edit, o.style, o.brand, o.hookTitle, o.format);
  const engine = new Engine(o.canvas, "record");
  try {
    await engine.setScene(scene, o.extras);
    engine.setMusic(o.music);
    engine.setMusicVolume(o.style.musicVolume);
    const blob = await engine.record(mime, o.onProgress, o.signal);
    return { blob, mime, seconds: scene.total };
  } finally {
    engine.dispose();
  }
}
