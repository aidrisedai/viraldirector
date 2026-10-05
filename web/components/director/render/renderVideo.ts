"use client";

import { musicGains } from "@/lib/audioMix";
import { captionChunks, FORMATS, TARGET_RMS, type FormatKey } from "@/lib/edit";
import type { ComposedEdit, ComposedSegment, Extra, Overlay, Style } from "@/lib/editPlan";
import { clamp01, easeInOut, easeOut, easeOutExpo, spring } from "@/lib/motion";
import type { MusicTrack } from "./musicTrack";
import { BRAND, CHUNK_WORDS, CREAM, drawCallout, drawCaptions, drawStaggered, drawTitle, titleSeconds, type TextKit, type Word } from "./text";

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

export const TAGLINE = "Raising Principled and Ambitious Teens as Builders and Founders";
/** The tagline broken at its natural pause, for formats too narrow for one line. */
const TAGLINE_LINES = ["Raising Principled and Ambitious Teens", "as Builders and Founders"];
const LOGO_FOR = 2.6;
export const END_CARD_SECONDS = 3;
const FADE = 0.15;
const TRANSITION = 0.26;

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

// Brand type: Libre Baskerville for large display text (titles, big numbers);
// Outfit for everything smaller, and for captions, which must read at a glance.
function fontFamilies() {
  const css = getComputedStyle(document.documentElement);
  const outfit = css.getPropertyValue("--font-outfit").trim();
  const serif = css.getPropertyValue("--font-baskerville").trim();
  return {
    sans: outfit ? `${outfit}, Outfit, system-ui, sans-serif` : "Outfit, system-ui, sans-serif",
    serif: serif ? `${serif}, "Libre Baskerville", Georgia, serif` : `"Libre Baskerville", Georgia, serif`,
  };
}

type Media = HTMLVideoElement | HTMLImageElement;
const mediaSize = (m: Media) =>
  m instanceof HTMLVideoElement ? [m.videoWidth || 1, m.videoHeight || 1] : [m.naturalWidth || 1, m.naturalHeight || 1];

/** Draws media to fill a rectangle (cropping the excess), scaled around its centre and shifted by dx. */
function drawCover(ctx: CanvasRenderingContext2D, m: Media, x: number, y: number, w: number, h: number, scale = 1, dx = 0) {
  const [mw, mh] = mediaSize(m);
  const s = Math.max(w / mw, h / mh) * scale;
  const dw = mw * s, dh = mh * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(m, x + (w - dw) / 2 + dx, y + (h - dh) / 2, dw, dh);
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
  const style = o.style;
  const punchy = style.energy === "Punchy";

  const canvas = o.canvas;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const { sans: font, serif } = fontFamilies();
  await Promise.all(
    ["800", "700", "600", "500"].map((w) => document.fonts.load(`${w} 80px ${font}`)).concat(document.fonts.load(`700 80px ${serif}`)),
  ).catch(() => {});
  const kit: TextKit = { ctx, W, H, sans: font, serif, style, format: o.format };

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
  // The wordmark names EdAI over the opening; the end card signs off with the brandmark (star over arch).
  const [logoLight, brandmark] = o.brand
    ? await Promise.all([loadImage("/brand/edai-wordmark-black-on-light.jpg"), loadImage("/brand/edai-brandmark-white.png")])
    : [null, null];

  const chunks = seq.map((s) => captionChunks(s.words.map((w, idx) => ({ ...w, idx })), CHUNK_WORDS[style.captions]) as Word[][]);
  const seqSeconds = seq.reduce((t, s) => t + (s.to - s.from), 0);
  const total = seqSeconds + (o.brand ? END_CARD_SECONDS : 0);
  const title = style.showTitle ? (style.title.trim() || o.hookTitle).replace(/^[“"]|[”"]$/g, "") : "";
  const titleFor = title ? titleSeconds(title) : 0;

  // ---------- audio: clips → level match → voice bus; music (measured) → mix level → limiter → recorder ----------
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
  const segGains = videos.map((v) => {
    const g = audio.createGain();
    g.gain.value = 0; // each clip is unmuted when its turn comes
    audio.createMediaElementSource(v).connect(g).connect(voiceBus);
    return g;
  });
  // Warm every clip's decoder (silently) so the next clip starts at once and transitions aren't cut short.
  await Promise.all(
    videos.map(async (v, i) => {
      try {
        await v.play();
        v.pause();
        v.currentTime = seq[i].from;
        await once(v, "seeked", 2000).catch(() => {});
      } catch {}
    }),
  );

  // Music is set from measurements: its loud parts sit 20 dB under the quietest speaking clip
  // while anyone talks and 9 dB under it in the gaps, scaled down by the creator's volume.
  const musicBus = audio.createGain();
  musicBus.gain.value = 0;
  const musicFade = audio.createGain();
  musicFade.connect(musicBus).connect(limiter);
  const voiceLevels = seq.flatMap((s) => (s.voiceLevel ? [s.voiceLevel] : []));
  const voiceRef = voiceLevels.length ? Math.min(...voiceLevels) : TARGET_RMS;
  const mix = o.music ? musicGains(o.music.level, voiceRef, style.musicVolume) : { underSpeech: 0, gaps: 0 };
  let musicSource: AudioBufferSourceNode | null = null;

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
  // around the panel — from the frame edge and before the title.
  const clearSpace = Math.round(panelW * 0.2);
  const margin = Math.max(Math.round(W * 0.06), clearSpace);
  const titleTop = o.brand ? margin + panelH + clearSpace : Math.round(H * 0.1);
  const logoFor = Math.max(LOGO_FOR, titleFor);

  // ---------- drawing ----------
  const drawOverlay = (ov: Overlay, into: number) => {
    const m = overlayMedia.get(overlayKey(ov));
    if (!m) return;
    const t = into - ov.at;
    const alpha = Math.min(clamp01(t / FADE), clamp01((ov.seconds - t) / FADE));
    ctx.save();
    ctx.globalAlpha = alpha;
    if (ov.style === "full") {
      drawCover(ctx, m, 0, 0, W, H, 1.08 - 0.08 * easeOut(t / ov.seconds));
    } else {
      // Picture-in-picture card, springing in with a slight tilt that settles.
      const [mw, mh] = mediaSize(m);
      const aspect = Math.min(1.6, Math.max(0.75, mw / mh));
      const cw = W * 0.64, ch = cw / aspect;
      const sp = spring(t, 2.2, 0.55);
      const exit = easeInOut((t - (ov.seconds - 0.2)) / 0.2);
      const s = (0.7 + 0.3 * sp) * (1 - 0.1 * exit);
      ctx.translate(W / 2, H * 0.17 + ch / 2);
      ctx.rotate(((1 - sp) * -6 * Math.PI) / 180);
      ctx.scale(s, s);
      ctx.shadowColor = "rgba(0,0,0,.4)";
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 16;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.roundRect(-cw / 2 - 10, -ch / 2 - 10, cw + 20, ch + 20, 30);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 22);
      ctx.clip();
      drawCover(ctx, m, -cw / 2, -ch / 2, cw, ch, 1.05 - 0.05 * clamp01(t / ov.seconds));
      ctx.restore();
    }
    ctx.restore();
  };

  /** The camera move for segment i at `local`: drifts, a punch-in on the hook, jump-cut zooms, emphasis pushes. */
  const cameraScale = (i: number, local: number, into: number, p: number) => {
    const seg = seq[i];
    const drift = punchy ? 0.05 : 0.035;
    let scale = i % 2 === 0 ? 1 + drift * p : 1 + drift - drift * p;
    if (i === 0) scale *= 1 + (punchy ? 0.14 : 0.05) * (1 - easeOut(into / 0.5));
    if (punchy && seg.speech) {
      const chunkIdx = chunks[i].findIndex((c) => local < c[c.length - 1].end);
      if (chunkIdx > 0 && chunkIdx % 2 === 1) scale *= 1.06;
    }
    const emph = seg.words.find((w, idx) => seg.emphasis.has(idx) && local >= w.start && local < w.end + 0.3);
    if (emph) scale *= 1 + (punchy ? 0.08 : 0.03) * easeOut((local - emph.start) / 0.14);
    return scale;
  };

  /** The way into segment i from the one before, over the first TRANSITION seconds. */
  const drawTransition = (i: number, into: number, scale: number) => {
    const v = videos[i];
    const prev = videos[i - 1];
    const q = clamp01(into / TRANSITION);
    if (style.transition === "Whip" && prev) {
      // Old shot flies left, new one arrives from the right, with a smeared motion blur.
      const e = easeInOut(q);
      const travel = W * 1.05;
      for (const [m, off] of [[prev, -e * travel], [v, (1 - e) * travel]] as const) {
        const speed = Math.sin(Math.PI * q);
        // One trailing ghost per shot: enough smear to read as speed, cheap enough for any GPU.
        ctx.globalAlpha = 0.35 * speed;
        drawCover(ctx, m, 0, 0, W, H, scale, off + W * 0.09 * speed * (m === prev ? 1 : -1));
        ctx.globalAlpha = 1;
        drawCover(ctx, m, 0, 0, W, H, scale, off);
      }
      ctx.globalAlpha = 1;
      return true;
    }
    if (style.transition === "Zoom" && prev) {
      // Old shot rushes toward the viewer and fades; new one settles from a punch-in.
      const e = easeOutExpo(q);
      drawCover(ctx, v, 0, 0, W, H, scale * (1.35 - 0.35 * e));
      ctx.globalAlpha = 1 - easeOut(q * 1.4);
      drawCover(ctx, prev, 0, 0, W, H, 1 + 0.5 * easeInOut(q));
      ctx.globalAlpha = 1;
      return true;
    }
    return false;
  };

  /** `sinceCut` is wall-clock time since this clip's turn began, so transitions run even while it spins up. */
  const drawFrame = (i: number, local: number, elapsed: number, sinceCut = local - seq[i].from) => {
    const seg = seq[i];
    const v = videos[i];
    const into = local - seg.from;
    const len = seg.to - seg.from;
    const p = len > 0 ? into / len : 0;
    const scale = cameraScale(i, local, into, p);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const transitioning = i > 0 && sinceCut < TRANSITION;
    if (!(transitioning && drawTransition(i, sinceCut, scale))) drawCover(ctx, v, 0, 0, W, H, scale);

    // Cutaways and picture-in-picture over the voice.
    const activeOverlays = seg.overlays.filter((ov) => into >= ov.at && into < ov.at + ov.seconds);
    activeOverlays.filter((ov) => ov.style === "full").forEach((ov) => drawOverlay(ov, into));

    if (style.transition === "Flash" && i > 0 && sinceCut < 0.14) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - sinceCut / 0.14)})`;
      ctx.fillRect(0, 0, W, H);
    }

    activeOverlays.filter((ov) => ov.style === "pip").forEach((ov) => drawOverlay(ov, into));
    const pipUp = activeOverlays.some((ov) => ov.style === "pip");
    seg.callouts.filter((c) => into >= c.at && into < c.at + c.seconds).forEach((c) => drawCallout(kit, c, into, pipUp));

    drawTitle(kit, title, elapsed, titleTop);

    // EdAI logo in a protected panel, top-left, over the opening (above the title scrim).
    if (logoLight && elapsed < logoFor) {
      const a = Math.min(easeOut((elapsed - 0.1) / 0.35), clamp01((logoFor - elapsed) / 0.3));
      const slide = (1 - easeOutExpo((elapsed - 0.1) / 0.5)) * -margin;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(slide, 0);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(margin, margin, panelW, panelH, 18);
      ctx.clip();
      ctx.drawImage(logoLight, margin, margin, panelW, panelH);
      ctx.restore();
      ctx.fillStyle = BRAND;
      ctx.fillRect(margin + 18, margin + panelH - 6, Math.round(panelW * 0.16 * easeInOut((elapsed - 0.35) / 0.4)), 4);
      ctx.restore();
    }


    // Captions wait for the title to clear.
    if (elapsed >= titleFor - 0.15) drawCaptions(kit, chunks[i], local, seg.emphasis);
  };

  /** EdAI end card: white brandmark on black, the call to action, and the tagline bottom-centre. */
  const drawEndCard = (t: number) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (!brandmark) return;
    // The PNG includes its own padding around the mark, which doubles as clear space.
    const lw = W * 0.44, lh = (lw * brandmark.naturalHeight) / brandmark.naturalWidth;
    const s = 0.8 + 0.2 * spring(t, 1.8, 0.6);
    ctx.save();
    ctx.globalAlpha = easeOut(t / 0.35);
    ctx.translate(W / 2, H * 0.38);
    ctx.scale(s, s);
    ctx.drawImage(brandmark, -lw / 2, -lh / 2, lw, lh);
    ctx.restore();

    const ctaSize = Math.round(W * 0.056);
    drawStaggered(kit, o.edit.endCta, W / 2, H * 0.38 + lh / 2 + ctaSize * 0.7, t - 0.35, `600 ${ctaSize}px ${font}`, CREAM, W * 0.84);

    // Tagline in the footer zone, above the platform's on-screen buttons. Set on balanced lines
    // rather than squeezed, so the type is never distorted.
    const tagSize = Math.round(W * 0.034);
    const tagLh = tagSize * 1.45;
    ctx.save();
    ctx.globalAlpha = easeOut((t - 0.8) / 0.45);
    ctx.font = `500 ${tagSize}px ${font}`;
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "1px";
    const tagLines = ctx.measureText(TAGLINE).width > W * 0.84 ? TAGLINE_LINES : [TAGLINE];
    const tagBottom = H * (o.format === "9:16" ? 0.82 : 0.88);
    const tagY = tagBottom - (tagLines.length - 1) * tagLh;
    ctx.fillStyle = BRAND;
    const rule = 56 * easeInOut((t - 0.7) / 0.4);
    ctx.fillRect(W / 2 - rule / 2, tagY - tagSize * 1.4, rule, 4);
    ctx.fillStyle = CREAM;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    tagLines.forEach((line, k) => ctx.fillText(line, W / 2, tagY + k * tagLh));
    ctx.restore();
  };

  // ---------- playback ----------
  let elapsedBefore = 0;
  const start = audio.currentTime + 0.05;
  if (o.music && mix.gaps > 0) {
    musicSource = audio.createBufferSource();
    musicSource.buffer = o.music.buffer;
    musicSource.loop = o.music.buffer.duration < total + 1;
    musicSource.connect(musicFade);
    musicFade.gain.setValueAtTime(0, start);
    musicFade.gain.linearRampToValueAtTime(1, start + 0.8);
    musicSource.start(start);
  }
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
      // Music sits well under speech and comes up a little in the gaps — never to the voice.
      musicBus.gain.setTargetAtTime(seg.speech ? mix.underSpeech : mix.gaps, audio.currentTime, 0.08);
      segGains[i].gain.setValueAtTime(seg.gain, audio.currentTime);

      // Keep drawing while play() starts, so the cut never freezes and the transition always plays out.
      const cutAt = performance.now();
      const started = v.play().catch(() => fail("A clip couldn’t play. Try again."));
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (abortReason) return resolve();
          const local = Math.max(seg.from, v.currentTime);
          syncOverlayPlayback(seg, local - seg.from);
          drawFrame(i, Math.min(local, seg.to), elapsedBefore + (local - seg.from), (performance.now() - cutAt) / 1000);
          o.onProgress(Math.min(0.99, (elapsedBefore + (local - seg.from)) / total));
          if (local >= seg.to - 0.02 || v.ended) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await started;
      v.pause();
      playing.forEach((m) => m.pause());
      playing.clear();
      if (abortReason) break;
      elapsedBefore += seg.to - seg.from;
    }

    if (o.brand && !abortReason) {
      musicBus.gain.setTargetAtTime(mix.gaps, audio.currentTime, 0.1);
      const cardStart = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (abortReason) return resolve();
          const t = (performance.now() - cardStart) / 1000;
          drawEndCard(t);
          o.onProgress(Math.min(0.99, (seqSeconds + t) / total));
          if (t >= END_CARD_SECONDS) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }
    // Let the music tail fade out.
    musicFade.gain.setTargetAtTime(0, audio.currentTime, 0.15);
    await new Promise((r) => setTimeout(r, 500));
  } finally {
    recorder.stop();
    await stopped;
    musicSource?.stop();
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
