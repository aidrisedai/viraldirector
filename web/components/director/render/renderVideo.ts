"use client";

import { captionChunks, FORMATS, timelineSeconds, type FormatKey, type MusicStyle, type Segment, type TimedWord } from "@/lib/edit";
import { scheduleMusic } from "./music";

export type RenderOptions = {
  segments: Segment[];
  format: FormatKey;
  music: MusicStyle;
  captions: boolean;
  /** Shown as an animated title over the opening seconds. */
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

const BRAND = "#1FA67A";
const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

function once(target: EventTarget, event: string, timeoutMs = 8000) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    target.addEventListener(event, () => (clearTimeout(t), resolve()), { once: true });
  });
}

async function prepareVideo(seg: Segment): Promise<HTMLVideoElement> {
  const v = document.createElement("video");
  v.playsInline = true;
  v.preload = "auto";
  v.src = seg.take.url;
  await once(v, "loadedmetadata");
  if (!Number.isFinite(v.duration)) {
    // MediaRecorder WebM has no duration until seeked to the end.
    v.currentTime = 1e9;
    await once(v, "seeked").catch(() => {});
  }
  v.currentTime = seg.from;
  // Some browsers skip "seeked" when already at that time; the frame is ready either way.
  await once(v, "seeked", 3000).catch(() => {});
  return v;
}

function fontFamily() {
  const f = getComputedStyle(document.documentElement).getPropertyValue("--font-outfit").trim();
  return f ? `${f}, Outfit, system-ui, sans-serif` : "Outfit, system-ui, sans-serif";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Renders the edit to a single video file in real time. */
export async function renderVideo(o: RenderOptions): Promise<RenderResult> {
  const { width: W, height: H } = FORMATS[o.format];
  const mime = outputType();
  if (!mime) throw new Error("This browser can’t create videos. Try the latest Chrome, Edge or Safari.");
  if (!o.segments.length) throw new Error("Keep at least one take first.");

  const canvas = o.canvas;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = fontFamily();
  await document.fonts.load(`800 80px ${font}`).catch(() => {});

  const total = timelineSeconds(o.segments);
  const videos = await Promise.all(o.segments.map(prepareVideo));
  const chunks = o.segments.map((s) => captionChunks(s.words));

  // Audio: every clip → its level-matching gain → voice bus; music → ducking gain; both → recorder.
  const audio = new AudioContext({ sampleRate: 48000 });
  await audio.resume();
  const dest = audio.createMediaStreamDestination();
  // Loudness comes from per-clip level matching (see buildTimeline); this limiter only catches peaks.
  // (A DynamicsCompressorNode adds its own automatic make-up gain, so a high threshold keeps that small.)
  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  limiter.connect(dest);
  const voiceBus = audio.createGain();
  voiceBus.connect(limiter);
  const segGains = videos.map((v, i) => {
    const g = audio.createGain();
    g.gain.value = o.segments[i].gain;
    audio.createMediaElementSource(v).connect(g).connect(voiceBus);
    return g;
  });
  const musicBus = audio.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(limiter);

  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 192_000 });
  const parts: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const stopped = new Promise<void>((r) => (recorder.onstop = () => r()));

  let abortReason = "";
  const fail = (why: string) => (abortReason ||= why);
  const onHidden = () => document.hidden && fail("Rendering stopped because the tab was hidden. Keep this tab open and try again.");
  document.addEventListener("visibilitychange", onHidden);
  o.signal.addEventListener("abort", () => fail("Cancelled."), { once: true });

  // ---------- drawing ----------
  const drawFrame = (i: number, local: number, elapsed: number) => {
    const seg = o.segments[i];
    const v = videos[i];
    const into = local - seg.from; // seconds into this segment
    const p = (seg.to - seg.from) > 0 ? into / (seg.to - seg.from) : 0;
    const segChunks = chunks[i];
    const chunkIdx = segChunks.findIndex((c) => local < c[c.length - 1].end);
    const activeChunk = chunkIdx >= 0 ? segChunks[chunkIdx] : null;

    // Slow push in/out, a punch-in on the hook, and jump-cut style zoom on alternate caption chunks.
    let scale = i % 2 === 0 ? 1 + 0.05 * p : 1.05 - 0.05 * p;
    if (i === 0) scale *= 1 + 0.14 * (1 - ease(into / 0.4));
    if (seg.speech && chunkIdx > 0 && chunkIdx % 2 === 1) scale *= 1.06;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const vw = v.videoWidth || W, vh = v.videoHeight || H;
    const cover = Math.max(W / vw, H / vh) * scale;
    const dw = vw * cover, dh = vh * cover;
    ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);

    // Flash on each cut.
    if (i > 0 && into < 0.12) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - into / 0.12)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Hook title over the opening.
    const HOOK_FOR = 2.6;
    if (o.hookTitle && elapsed < HOOK_FOR) {
      const inP = ease(elapsed / 0.35);
      const outP = elapsed > HOOK_FOR - 0.25 ? 1 - (elapsed - (HOOK_FOR - 0.25)) / 0.25 : 1;
      const size = Math.round(W * 0.062);
      ctx.font = `800 ${size}px ${font}`;
      const lines = wrap(ctx, o.hookTitle, W * 0.78);
      const lh = size * 1.18;
      const boxW = Math.min(W * 0.88, Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.4);
      const boxH = lines.length * lh + size * 1.1;
      const x = (W - boxW) / 2;
      const y = H * 0.12 - 40 * (1 - inP);
      ctx.save();
      ctx.globalAlpha = inP * outP;
      ctx.fillStyle = "rgba(11,11,10,.82)";
      roundRect(ctx, x, y, boxW, boxH, 28);
      ctx.fill();
      ctx.fillStyle = BRAND;
      ctx.fillRect(x + size * 0.7, y + boxH - 8, 64, 6);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      lines.forEach((l, k) => ctx.fillText(l, W / 2, y + size * 0.55 + k * lh));
      ctx.restore();
    }

    // Word-by-word captions: the current word pops in the brand colour.
    const titleUp = Boolean(o.hookTitle) && elapsed < HOOK_FOR;
    if (o.captions && !titleUp && activeChunk && local >= activeChunk[0].start - 0.05) {
      let size = Math.round(W * (o.format === "9:16" ? 0.074 : 0.062));
      ctx.font = `800 ${size}px ${font}`;
      const words = activeChunk.map((w) => w.word.toUpperCase().replace(/[“”"]/g, ""));
      const gap = size * 0.28;
      let widths = words.map((w) => ctx.measureText(w).width);
      let lineW = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
      if (lineW > W * 0.86) {
        size = Math.floor(size * (W * 0.86) / lineW);
        ctx.font = `800 ${size}px ${font}`;
        widths = words.map((w) => ctx.measureText(w).width);
        lineW = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
      }
      const y = H * (o.format === "9:16" ? 0.7 : 0.78);
      let x = (W - lineW) / 2;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      activeChunk.forEach((w: TimedWord, k) => {
        const active = local >= w.start && local < w.end;
        const pop = active ? 1 + 0.16 * (1 - ease((local - w.start) / 0.14)) : 1;
        ctx.save();
        ctx.translate(x + widths[k] / 2, y);
        ctx.scale(pop, pop);
        if (active) {
          // The current word sits on a brand pill so it reads on any footage.
          const padX = size * 0.22, padY = size * 0.14;
          ctx.fillStyle = BRAND;
          roundRect(ctx, -widths[k] / 2 - padX, -size / 2 - padY, widths[k] + padX * 2, size + padY * 2, size * 0.22);
          ctx.fill();
        } else {
          ctx.lineWidth = size * 0.16;
          ctx.strokeStyle = "rgba(0,0,0,.9)";
          ctx.strokeText(words[k], -widths[k] / 2, 0);
        }
        ctx.fillStyle = "#fff";
        ctx.fillText(words[k], -widths[k] / 2, 0);
        ctx.restore();
        x += widths[k] + gap;
      });
    }
  };

  // ---------- playback ----------
  let elapsedBefore = 0;
  const musicStart = audio.currentTime + 0.05;
  scheduleMusic(audio, musicBus, musicStart, total + 1, o.music);

  drawFrame(0, o.segments[0].from, 0);
  recorder.start(1000);

  try {
    for (let i = 0; i < o.segments.length; i++) {
      const seg = o.segments[i];
      const v = videos[i];
      // Music sits under speech and comes up in the gaps.
      const level = o.music === "No music" ? 0 : seg.speech ? 0.35 : 1;
      musicBus.gain.setTargetAtTime(level, audio.currentTime, 0.08);
      segGains[i].gain.setValueAtTime(seg.gain, audio.currentTime);

      await v.play();
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (abortReason) return resolve();
          const local = v.currentTime;
          drawFrame(i, Math.min(local, seg.to), elapsedBefore + (local - seg.from));
          o.onProgress(Math.min(0.99, (elapsedBefore + (local - seg.from)) / total));
          if (local >= seg.to - 0.02 || v.ended) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      v.pause();
      if (abortReason) break;
      elapsedBefore += seg.to - seg.from;
    }
    // Let the last frame and the music tail settle.
    musicBus.gain.setTargetAtTime(0, audio.currentTime, 0.15);
    await new Promise((r) => setTimeout(r, 400));
  } finally {
    recorder.stop();
    await stopped;
    document.removeEventListener("visibilitychange", onHidden);
    stream.getTracks().forEach((t) => t.stop());
    videos.forEach((v) => (v.removeAttribute("src"), v.load()));
    audio.close().catch(() => {});
  }

  if (abortReason) throw new Error(abortReason);
  o.onProgress(1);
  return { blob: new Blob(parts, { type: mime.split(";")[0] }), mime, seconds: total };
}
