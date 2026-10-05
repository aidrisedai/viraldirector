"use client";

import { captionChunks, FORMATS, type FormatKey, type MusicStyle, type TimedWord } from "@/lib/edit";
import type { ComposedEdit, ComposedSegment, Overlay, Extra } from "@/lib/editPlan";
import { scheduleMusic } from "./music";

export type RenderOptions = {
  edit: ComposedEdit;
  extras: Extra[];
  format: FormatKey;
  music: MusicStyle;
  captions: boolean;
  /** EdAI opening logo panel and end card. */
  brand: boolean;
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

export const TAGLINE = "Raising Muslim Teens as Builders and Founders";
const BRAND = "#1FA67A";
const CREAM = "#F4EEE3";
const HOOK_FOR = 2.6;
export const END_CARD_SECONDS = 2.8;
const FADE = 0.15;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - (1 - clamp01(x)) ** 3;
/** Ease-out with a small overshoot, for things that pop in. */
const back = (x: number) => {
  const t = clamp01(x) - 1;
  return 1 + 2.2 * t * t * t + 1.2 * t * t;
};

function once(target: EventTarget, event: string, timeoutMs = 8000) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    target.addEventListener(event, () => (clearTimeout(t), resolve()), { once: true });
  });
}

async function prepareVideo(url: string, at: number, muted = false): Promise<HTMLVideoElement> {
  const v = document.createElement("video");
  v.playsInline = true;
  v.preload = "auto";
  v.muted = muted;
  v.src = url;
  await once(v, "loadedmetadata");
  if (!Number.isFinite(v.duration)) {
    // MediaRecorder WebM has no duration until seeked to the end.
    v.currentTime = 1e9;
    await once(v, "seeked").catch(() => {});
  }
  v.currentTime = at;
  // Some browsers skip "seeked" when already at that time; the frame is ready either way.
  await once(v, "seeked", 3000).catch(() => {});
  return v;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
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

type Media = HTMLVideoElement | HTMLImageElement;
const mediaSize = (m: Media) =>
  m instanceof HTMLVideoElement ? [m.videoWidth || 1, m.videoHeight || 1] : [m.naturalWidth || 1, m.naturalHeight || 1];

/** Draws media to fill a rectangle (cropping the excess), scaled around its centre. */
function drawCover(ctx: CanvasRenderingContext2D, m: Media, x: number, y: number, w: number, h: number, scale = 1) {
  const [mw, mh] = mediaSize(m);
  const s = Math.max(w / mw, h / mh) * scale;
  const dw = mw * s, dh = mh * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(m, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

const overlayKey = (o: Overlay) => (o.kind === "extra" ? `extra:${o.extraId}` : `shot:${o.from.shot}`);

/** Renders the edit to a single video file in real time. */
export async function renderVideo(o: RenderOptions): Promise<RenderResult> {
  const { width: W, height: H } = FORMATS[o.format];
  const seq = o.edit.sequence;
  const mime = outputType();
  if (!mime) throw new Error("This browser can’t create videos. Try the latest Chrome, Edge or Safari.");
  if (!seq.length) throw new Error("Keep at least one take first.");

  const canvas = o.canvas;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = fontFamily();
  await document.fonts.load(`800 80px ${font}`).catch(() => {});

  // ---------- media ----------
  const videos = await Promise.all(seq.map((s) => prepareVideo(s.take.url, s.from)));
  const overlayMedia = new Map<string, Media>();
  for (const s of seq) {
    for (const ov of s.overlays) {
      const key = overlayKey(ov);
      if (overlayMedia.has(key)) continue;
      if (ov.kind === "segment") overlayMedia.set(key, await prepareVideo(ov.from.take.url, ov.from.from, true));
      else {
        const extra = o.extras.find((e) => e.id === ov.extraId);
        if (!extra) continue;
        overlayMedia.set(key, extra.kind === "image" ? await loadImage(extra.url) : await prepareVideo(extra.url, 0, true));
      }
    }
  }
  const [logoLight, logoDark] = o.brand
    ? await Promise.all([loadImage("/brand/edai-wordmark-black-on-light.jpg"), loadImage("/brand/edai-wordmark-white-on-dark.jpg")])
    : [null, null];

  const chunks = seq.map((s) => {
    const indexed = s.words.map((w, idx) => ({ ...w, idx }));
    return captionChunks(indexed) as (TimedWord & { idx: number })[][];
  });
  const seqSeconds = seq.reduce((t, s) => t + (s.to - s.from), 0);
  const total = seqSeconds + (o.brand ? END_CARD_SECONDS : 0);

  // ---------- audio: clips → level match → voice bus; music → ducking; both → peak limiter → recorder ----------
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
    g.gain.value = seq[i].gain;
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

  // ---------- layout ----------
  const panelW = Math.round(W * 0.3);
  const panelH = logoLight ? Math.round((panelW * logoLight.naturalHeight) / logoLight.naturalWidth) : 0;
  // Brand clear space: at least one capital "E" height of the wordmark (about 18% of the panel width)
  // around the panel — from the frame edge and before the hook title.
  const clearSpace = Math.round(panelW * 0.2);
  const margin = Math.max(Math.round(W * 0.06), clearSpace);
  const hookTop = o.brand ? margin + panelH + clearSpace : Math.round(H * 0.12);
  const captionY = H * (o.format === "9:16" ? 0.7 : 0.78);

  // ---------- drawing helpers ----------
  const drawOverlay = (ov: Overlay, into: number) => {
    const m = overlayMedia.get(overlayKey(ov));
    if (!m) return;
    const t = into - ov.at;
    const alpha = Math.min(clamp01(t / FADE), clamp01((ov.seconds - t) / FADE));
    ctx.save();
    ctx.globalAlpha = alpha;
    if (ov.style === "full") {
      drawCover(ctx, m, 0, 0, W, H, 1.06 - 0.06 * clamp01(t / ov.seconds));
    } else {
      // Picture-in-picture card, springing in.
      const [mw, mh] = mediaSize(m);
      const aspect = Math.min(1.6, Math.max(0.75, mw / mh));
      const cw = W * 0.64, ch = cw / aspect;
      const s = 0.82 + 0.18 * back(t / 0.35);
      const cx = W / 2, cy = H * 0.17 + ch / 2;
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowBlur = 40;
      ctx.fillStyle = "#fff";
      roundRect(ctx, -cw / 2 - 10, -ch / 2 - 10, cw + 20, ch + 20, 30);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.save();
      roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 22);
      ctx.clip();
      drawCover(ctx, m, -cw / 2, -ch / 2, cw, ch, 1.04 - 0.04 * clamp01(t / ov.seconds));
      ctx.restore();
    }
    ctx.restore();
  };

  const drawCallout = (c: ComposedSegment["callouts"][number], into: number, lower: boolean) => {
    const t = into - c.at;
    const s = back(t / 0.28);
    const alpha = clamp01((c.seconds - t) / 0.2);
    const stat = c.style === "stat";
    const size = Math.round(W * (stat ? 0.085 : 0.045));
    ctx.save();
    ctx.font = `800 ${size}px ${font}`;
    const text = stat ? c.text : c.text.toUpperCase();
    const tw = Math.min(ctx.measureText(text).width, W * 0.8);
    const padX = size * (stat ? 0.55 : 0.6), padY = size * (stat ? 0.35 : 0.45);
    const y = lower ? H * 0.55 : H * (stat ? 0.3 : 0.27);
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, y);
    ctx.scale(s, s);
    ctx.fillStyle = stat ? BRAND : "#fff";
    roundRect(ctx, -tw / 2 - padX, -size / 2 - padY, tw + padX * 2, size + padY * 2, stat ? size * 0.4 : size);
    ctx.fill();
    ctx.fillStyle = stat ? "#fff" : "#0B0B0A";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0, W * 0.8);
    ctx.restore();
  };

  const drawCaptions = (i: number, local: number) => {
    const seg = seq[i];
    const active = chunks[i].find((c) => local < c[c.length - 1].end);
    if (!active || local < active[0].start - 0.05) return;
    let size = Math.round(W * (o.format === "9:16" ? 0.074 : 0.062));
    ctx.font = `800 ${size}px ${font}`;
    const words = active.map((w) => w.word.toUpperCase().replace(/[“”"]/g, ""));
    const gap = size * 0.28;
    let widths = words.map((w) => ctx.measureText(w).width);
    let lineW = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
    if (lineW > W * 0.86) {
      size = Math.floor((size * (W * 0.86)) / lineW);
      ctx.font = `800 ${size}px ${font}`;
      widths = words.map((w) => ctx.measureText(w).width);
      lineW = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
    }
    let x = (W - lineW) / 2;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    active.forEach((w, k) => {
      const on = local >= w.start && local < w.end;
      const emph = seg.emphasis.has(w.idx);
      const pop = on ? 1 + (emph ? 0.3 : 0.16) * (1 - ease((local - w.start) / 0.16)) : 1;
      ctx.save();
      ctx.translate(x + widths[k] / 2, captionY);
      ctx.scale(pop, pop);
      if (on) {
        // The current word sits on a brand pill so it reads on any footage.
        const padX = size * 0.22, padY = size * 0.14;
        ctx.fillStyle = BRAND;
        roundRect(ctx, -widths[k] / 2 - padX, -size / 2 - padY, widths[k] + padX * 2, size + padY * 2, size * 0.22);
        ctx.fill();
        ctx.fillStyle = "#fff";
      } else {
        ctx.lineWidth = size * 0.16;
        ctx.strokeStyle = "rgba(0,0,0,.9)";
        ctx.strokeText(words[k], -widths[k] / 2, 0);
        ctx.fillStyle = emph ? BRAND : "#fff";
      }
      ctx.fillText(words[k], -widths[k] / 2, 0);
      ctx.restore();
      x += widths[k] + gap;
    });
  };

  const drawFrame = (i: number, local: number, elapsed: number) => {
    const seg = seq[i];
    const v = videos[i];
    const into = local - seg.from;
    const len = seg.to - seg.from;
    const p = len > 0 ? into / len : 0;

    // Camera: slow push in/out, a punch-in on the hook and on emphasised words, jump-cut zoom between phrases.
    const chunkIdx = chunks[i].findIndex((c) => local < c[c.length - 1].end);
    let scale = i % 2 === 0 ? 1 + 0.05 * p : 1.05 - 0.05 * p;
    if (i === 0) scale *= 1 + 0.14 * (1 - ease(into / 0.4));
    if (seg.speech && chunkIdx > 0 && chunkIdx % 2 === 1) scale *= 1.06;
    const emphWord = seg.words.find((w, idx) => seg.emphasis.has(idx) && local >= w.start && local < w.end + 0.25);
    if (emphWord) scale *= 1 + 0.08 * ease((local - emphWord.start) / 0.12);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawCover(ctx, v, 0, 0, W, H, scale);

    // Cutaways and picture-in-picture over the voice.
    const activeOverlays = seg.overlays.filter((ov) => into >= ov.at && into < ov.at + ov.seconds);
    activeOverlays.filter((ov) => ov.style === "full").forEach((ov) => drawOverlay(ov, into));

    // Flash on each cut.
    if (i > 0 && into < 0.12) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - into / 0.12)})`;
      ctx.fillRect(0, 0, W, H);
    }

    activeOverlays.filter((ov) => ov.style === "pip").forEach((ov) => drawOverlay(ov, into));
    const pipUp = activeOverlays.some((ov) => ov.style === "pip");
    seg.callouts.filter((c) => into >= c.at && into < c.at + c.seconds).forEach((c) => drawCallout(c, into, pipUp));

    // EdAI logo in a protected panel, top-left, over the opening.
    if (logoLight && elapsed < HOOK_FOR) {
      const a = Math.min(ease((elapsed - 0.15) / 0.3), clamp01((HOOK_FOR - elapsed) / 0.25));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.save();
      roundRect(ctx, margin, margin, panelW, panelH, 18);
      ctx.clip();
      ctx.drawImage(logoLight, margin, margin, panelW, panelH);
      ctx.restore();
      ctx.fillStyle = BRAND;
      ctx.fillRect(margin + 18, margin + panelH - 6, Math.round(panelW * 0.16), 4);
      ctx.restore();
    }

    // Hook title over the opening.
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
      const y = hookTop - 40 * (1 - inP);
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

    // Word-by-word captions (held back while the hook title is up).
    const titleUp = Boolean(o.hookTitle) && elapsed < HOOK_FOR;
    if (o.captions && !titleUp) drawCaptions(i, local);
  };

  /** EdAI end card: white wordmark on black, the call to action, and the tagline bottom-centre. */
  const drawEndCard = (t: number) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (!logoDark) return;
    const lw = W * 0.7, lh = (lw * logoDark.naturalHeight) / logoDark.naturalWidth;
    const s = 0.94 + 0.06 * ease(t / 0.5);
    ctx.save();
    ctx.globalAlpha = ease(t / 0.4);
    ctx.translate(W / 2, H * 0.4);
    ctx.scale(s, s);
    ctx.drawImage(logoDark, -lw / 2, -lh / 2, lw, lh);
    ctx.restore();

    const ctaSize = Math.round(W * 0.052);
    ctx.save();
    ctx.globalAlpha = ease((t - 0.35) / 0.4);
    ctx.font = `600 ${ctaSize}px ${font}`;
    ctx.fillStyle = CREAM;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(o.edit.endCta, W / 2, H * 0.4 + lh / 2 + ctaSize * 0.6 + 24 * (1 - ease((t - 0.35) / 0.4)), W * 0.86);
    ctx.restore();

    // Tagline in the footer zone, above the platform's on-screen buttons.
    const tagSize = Math.round(W * 0.034);
    const tagY = H * (o.format === "9:16" ? 0.8 : 0.86);
    ctx.save();
    ctx.globalAlpha = ease((t - 0.7) / 0.4);
    ctx.fillStyle = BRAND;
    ctx.fillRect(W / 2 - 28, tagY - tagSize * 1.4, 56, 4);
    ctx.font = `500 ${tagSize}px ${font}`;
    ctx.fillStyle = CREAM;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "1px";
    ctx.fillText(TAGLINE, W / 2, tagY, W * 0.9);
    ctx.restore();
  };

  // ---------- playback ----------
  let elapsedBefore = 0;
  scheduleMusic(audio, musicBus, audio.currentTime + 0.05, total + 1, o.music);
  drawFrame(0, seq[0].from, 0);
  recorder.start(1000);

  const playing = new Set<HTMLVideoElement>();
  const syncOverlayPlayback = (seg: ComposedSegment, into: number) => {
    for (const ov of seg.overlays) {
      const m = overlayMedia.get(overlayKey(ov));
      if (!(m instanceof HTMLVideoElement)) continue;
      const on = into >= ov.at && into < ov.at + ov.seconds;
      if (on && !playing.has(m)) {
        playing.add(m);
        m.currentTime = ov.kind === "segment" ? ov.from.from : 0;
        m.play().catch(() => {});
      } else if (!on && playing.has(m) && !seg.overlays.some((x) => x !== ov && overlayKey(x) === overlayKey(ov) && into >= x.at && into < x.at + x.seconds)) {
        playing.delete(m);
        m.pause();
      }
    }
  };

  try {
    for (let i = 0; i < seq.length; i++) {
      const seg = seq[i];
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
          syncOverlayPlayback(seg, local - seg.from);
          drawFrame(i, Math.min(local, seg.to), elapsedBefore + (local - seg.from));
          o.onProgress(Math.min(0.99, (elapsedBefore + (local - seg.from)) / total));
          if (local >= seg.to - 0.02 || v.ended) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      v.pause();
      playing.forEach((m) => m.pause());
      playing.clear();
      if (abortReason) break;
      elapsedBefore += seg.to - seg.from;
    }

    if (o.brand && !abortReason) {
      musicBus.gain.setTargetAtTime(o.music === "No music" ? 0 : 1, audio.currentTime, 0.1);
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (abortReason) return resolve();
          const t = (performance.now() - start) / 1000;
          drawEndCard(t);
          o.onProgress(Math.min(0.99, (seqSeconds + t) / total));
          if (t >= END_CARD_SECONDS) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }
    // Let the music tail settle.
    musicBus.gain.setTargetAtTime(0, audio.currentTime, 0.15);
    await new Promise((r) => setTimeout(r, 400));
  } finally {
    recorder.stop();
    await stopped;
    document.removeEventListener("visibilitychange", onHidden);
    stream.getTracks().forEach((t) => t.stop());
    [...videos, ...overlayMedia.values()].forEach((m) => {
      if (m instanceof HTMLVideoElement) {
        m.removeAttribute("src");
        m.load();
      }
    });
    audio.close().catch(() => {});
  }

  if (abortReason) throw new Error(abortReason);
  o.onProgress(1);
  return { blob: new Blob(parts, { type: mime.split(";")[0] }), mime, seconds: total };
}
