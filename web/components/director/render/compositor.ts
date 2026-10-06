"use client";

import { captionChunks, FORMATS, type FormatKey } from "@/lib/edit";
import { FULL_FRAME, type ComposedEdit, type ComposedSegment, type Overlay, type Style } from "@/lib/editPlan";
import { clamp01, easeInOut, easeOut, easeOutExpo, spring } from "@/lib/motion";
import { drawCard, drawLightLeak, drawSticker, drawTakeaway } from "./editorial";
import { BRAND, CHUNK_WORDS, CREAM, drawCallout, drawCaptions, drawStaggered, drawTitle, titleSeconds, type TextKit, type Word } from "./text";

// Draws any moment of the edit. The live editor preview and the exported file both use this,
// so what the creator sees while editing is exactly what they get.

export const TAGLINE = "Raising Principled and Ambitious Teens as Builders and Founders";
/** The tagline broken at its natural pause, for formats too narrow for one line. */
const TAGLINE_LINES = ["Raising Principled and Ambitious Teens", "as Builders and Founders"];
const LOGO_FOR = 2.6;
export const END_CARD_SECONDS = 3;
const FADE = 0.15;
export const TRANSITION = 0.26;
const SOFT = 0.22;
const LEAK = 0.6;

export type Media = HTMLVideoElement | HTMLImageElement;

/** A clip's colour correction: a canvas filter (exposure, contrast) and a multiply tint (white balance). */
export type Grade = { filter: string; tint: string | null };

/** Where the pixels come from: main clips by take, overlays by key, brand marks. */
export type MediaSource = {
  clip: (takeId: string) => HTMLVideoElement | undefined;
  overlay: (key: string) => Media | undefined;
  logoLight: HTMLImageElement | null;
  brandmark: HTMLImageElement | null;
  /** Colour correction measured for a take, if any. */
  grade?: (takeId: string) => Grade | undefined;
};

/** Canvas filters aren't in every browser (Safari); without them clips are drawn as recorded. */
const canFilter = () => typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;

export const overlayKey = (o: Overlay) => (o.kind === "extra" ? `extra:${o.extraId}` : `shot:${o.from.shot}`);

/** Everything about the edit that drawing needs, precomputed once per change. */
export type Scene = {
  seq: ComposedSegment[];
  /** Start of each segment in the video, seconds. */
  starts: number[];
  seqSeconds: number;
  total: number;
  chunks: Word[][][];
  style: Style;
  brand: boolean;
  title: string;
  titleFor: number;
  endCta: string;
  format: FormatKey;
};

export function buildScene(edit: ComposedEdit, style: Style, brand: boolean, hookTitle: string, format: FormatKey): Scene {
  const seq = edit.sequence;
  const starts: number[] = [];
  let t = 0;
  for (const s of seq) {
    starts.push(t);
    t += s.to - s.from;
  }
  const title = style.showTitle ? (style.title.trim() || hookTitle).replace(/^[“"]|[”"]$/g, "") : "";
  return {
    seq,
    starts,
    seqSeconds: t,
    total: t + (brand ? END_CARD_SECONDS : 0),
    chunks: seq.map((s) => captionChunks(s.words.map((w, idx) => ({ ...w, idx })), CHUNK_WORDS[style.captions]) as Word[][]),
    style,
    brand,
    title,
    titleFor: title ? titleSeconds(title) : 0,
    endCta: edit.endCta,
    format,
  };
}

/** Which segment plays at time t (clamped to the sequence). */
export function segmentAt(scene: Scene, t: number): number {
  let i = 0;
  while (i + 1 < scene.seq.length && t >= scene.starts[i + 1]) i++;
  return i;
}

type MediaSize = [number, number];
const mediaSize = (m: Media): MediaSize =>
  m instanceof HTMLVideoElement ? [m.videoWidth || 1, m.videoHeight || 1] : [m.naturalWidth || 1, m.naturalHeight || 1];

/** Draws media to fill a rectangle (cropping the excess), scaled around its centre and shifted by dx. */
export function drawCover(ctx: CanvasRenderingContext2D, m: Media, x: number, y: number, w: number, h: number, scale = 1, dx = 0) {
  if (m instanceof HTMLVideoElement && m.readyState < 2) return;
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

export function fontFamilies() {
  const css = getComputedStyle(document.documentElement);
  const outfit = css.getPropertyValue("--font-outfit").trim();
  const serif = css.getPropertyValue("--font-baskerville").trim();
  return {
    sans: outfit ? `${outfit}, Outfit, system-ui, sans-serif` : "Outfit, system-ui, sans-serif",
    serif: serif ? `${serif}, "Libre Baskerville", Georgia, serif` : `"Libre Baskerville", Georgia, serif`,
  };
}

export async function loadFonts() {
  const { sans, serif } = fontFamilies();
  await Promise.all(["800", "700", "600", "500"].map((w) => document.fonts.load(`${w} 80px ${sans}`)).concat(document.fonts.load(`700 80px ${serif}`))).catch(() => {});
}

/** Draws frames of `scene` into a context whose coordinate space is the full output size. */
export function makeCompositor(ctx: CanvasRenderingContext2D, scene: Scene, media: MediaSource) {
  const { width: W, height: H } = FORMATS[scene.format];
  const { sans, serif } = fontFamilies();
  const style = scene.style;
  const punchy = style.energy === "Punchy";
  const editorialLook = style.look === "Editorial";
  const grading = !!style.grade && !!media.grade && canFilter();

  /** Draws a main clip, with its colour correction when that's on. */
  const cover = (takeId: string, m: Media, scale: number, dx = 0) => {
    const g = grading ? media.grade!(takeId) : undefined;
    if (g) ctx.filter = g.filter;
    drawCover(ctx, m, 0, 0, W, H, scale, dx);
    if (g) ctx.filter = "none";
  };
  const kit: TextKit = { ctx, W, H, sans, serif, style, format: scene.format };
  const { logoLight, brandmark } = media;

  const panelW = Math.round(W * 0.3);
  const panelH = logoLight ? Math.round((panelW * logoLight.naturalHeight) / logoLight.naturalWidth) : 0;
  // Brand clear space: at least one capital "E" height of the wordmark (about 18% of the panel width)
  // around the panel — from the frame edge and before the title.
  const clearSpace = Math.round(panelW * 0.2);
  const margin = Math.max(Math.round(W * 0.06), clearSpace);
  const titleTop = scene.brand ? margin + panelH + clearSpace : Math.round(H * 0.1);
  const logoFor = Math.max(LOGO_FOR, scene.titleFor);

  const drawOverlay = (ov: Overlay, into: number) => {
    const m = media.overlay(overlayKey(ov));
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

  /** The camera move for segment i: drifts, a punch-in on the hook, jump-cut zooms, emphasis pushes. */
  const cameraScale = (i: number, local: number, into: number, p: number) => {
    const seg = scene.seq[i];
    if (editorialLook) {
      // Subtle: most clips sit a touch closer with a slow push; every third is framed wider for variety.
      let scale = (i % 3 === 2 ? 1 : 1.06) + 0.02 * p;
      const emph = seg.words.find((w, idx) => seg.emphasis.has(idx) && local >= w.start && local < w.end + 0.6);
      if (emph) scale *= 1 + 0.045 * easeInOut((local - emph.start) / 0.3) * (1 - easeInOut((local - emph.end - 0.3) / 0.3));
      return scale;
    }
    const drift = punchy ? 0.05 : 0.035;
    let scale = i % 2 === 0 ? 1 + drift * p : 1 + drift - drift * p;
    if (i === 0) scale *= 1 + (punchy ? 0.14 : 0.05) * (1 - easeOut(into / 0.5));
    if (punchy && seg.speech) {
      const chunkIdx = scene.chunks[i].findIndex((c) => local < c[c.length - 1].end);
      if (chunkIdx > 0 && chunkIdx % 2 === 1) scale *= 1.06;
    }
    const emph = seg.words.find((w, idx) => seg.emphasis.has(idx) && local >= w.start && local < w.end + 0.3);
    if (emph) scale *= 1 + (punchy ? 0.08 : 0.03) * easeOut((local - emph.start) / 0.14);
    return scale;
  };

  /** The way into segment i from the one before, over the first TRANSITION seconds. */
  const drawTransition = (i: number, into: number, scale: number) => {
    const v = media.clip(scene.seq[i].take.id);
    const prev = media.clip(scene.seq[i - 1].take.id);
    if (!v || !prev) return false;
    const q = clamp01(into / TRANSITION);
    if (style.transition === "Soft") {
      // A quick, soft crossfade.
      const prevId = scene.seq[i - 1].take.id;
      cover(prevId, prev, cameraScale(i - 1, scene.seq[i - 1].to, scene.seq[i - 1].to - scene.seq[i - 1].from, 1));
      ctx.globalAlpha = easeInOut(clamp01(into / SOFT));
      cover(scene.seq[i].take.id, v, scale);
      ctx.globalAlpha = 1;
      return true;
    }
    if (style.transition === "Whip") {
      // Old shot flies left, new one arrives from the right, with a smeared motion blur.
      const e = easeInOut(q);
      const travel = W * 1.05;
      const speed = Math.sin(Math.PI * q);
      for (const [m, off] of [[prev, -e * travel], [v, (1 - e) * travel]] as const) {
        // One trailing ghost per shot: enough smear to read as speed, cheap enough for any GPU.
        ctx.globalAlpha = 0.35 * speed;
        const id = scene.seq[m === prev ? i - 1 : i].take.id;
        cover(id, m, scale, off + W * 0.09 * speed * (m === prev ? 1 : -1));
        ctx.globalAlpha = 1;
        cover(id, m, scale, off);
      }
      return true;
    }
    if (style.transition === "Zoom") {
      // Old shot rushes toward the viewer and fades; new one settles from a punch-in.
      const e = easeOutExpo(q);
      cover(scene.seq[i].take.id, v, scale * (1.35 - 0.35 * e));
      ctx.globalAlpha = 1 - easeOut(q * 1.4);
      cover(scene.seq[i - 1].take.id, prev, 1 + 0.5 * easeInOut(q));
      ctx.globalAlpha = 1;
      return true;
    }
    return false;
  };

  /**
   * One frame of segment i at source time `local`. `elapsed` is the time in the video; `sinceCut` is how long
   * this clip has been on screen (wall clock while playing, so transitions run even while a clip spins up).
   */
  const drawFrame = (i: number, local: number, elapsed: number, sinceCut = local - scene.seq[i].from) => {
    const seg = scene.seq[i];
    const v = media.clip(seg.take.id);
    const into = local - seg.from;
    const len = seg.to - seg.from;
    const p = len > 0 ? into / len : 0;
    const scale = cameraScale(i, local, into, p);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const transitioning = i > 0 && sinceCut < (style.transition === "Soft" ? SOFT : TRANSITION) && style.transition !== "Cut" && style.transition !== "Flash";
    if (!(transitioning && drawTransition(i, sinceCut, scale)) && v) cover(seg.take.id, v, scale);
    // White balance: a gentle multiply tint measured for this clip.
    const tint = grading ? media.grade!(seg.take.id)?.tint : null;
    if (tint) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Cutaways and picture-in-picture over the voice.
    const activeOverlays = seg.overlays.filter((ov) => into >= ov.at && into < ov.at + ov.seconds);
    activeOverlays.filter((ov) => ov.style === "full").forEach((ov) => drawOverlay(ov, into));

    if (style.transition === "Flash" && i > 0 && sinceCut < 0.14) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - sinceCut / 0.14)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // An occasional gentle light leak on a cut (every third one) in the Soft transition.
    if (style.transition === "Soft" && i > 0 && i % 3 === 1 && sinceCut < LEAK) drawLightLeak(ctx, W, H, sinceCut / LEAK, i);

    activeOverlays.filter((ov) => ov.style === "pip").forEach((ov) => drawOverlay(ov, into));
    const pipUp = activeOverlays.some((ov) => ov.style === "pip");
    const activeCallouts = seg.callouts.filter((c) => into >= c.at && into < c.at + c.seconds);
    for (const c of activeCallouts) {
      if (c.style === "sticker") drawSticker(kit, c, into);
      else if (!FULL_FRAME.has(c.style)) drawCallout(kit, c, into, pipUp);
    }
    // Cards and the takeaway take over the picture (the voice carries on), so they go on top.
    for (const c of activeCallouts) {
      if (c.style === "takeaway") drawTakeaway(kit, c, into);
      else if (c.style === "card") drawCard(kit, c, into, scene.brand ? logoLight : null);
    }
    const fullFrame = activeCallouts.some((c) => FULL_FRAME.has(c.style) && into < c.at + c.seconds - 0.12);

    drawTitle(kit, scene.title, elapsed, titleTop);

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
    if (elapsed >= scene.titleFor - 0.15 && !fullFrame) drawCaptions(kit, scene.chunks[i], local, seg.emphasis);
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
    drawStaggered(kit, scene.endCta, W / 2, H * 0.38 + lh / 2 + ctaSize * 0.7, t - 0.35, `600 ${ctaSize}px ${sans}`, CREAM, W * 0.84);

    // Tagline in the footer zone, above the platform's on-screen buttons. Set on balanced lines
    // rather than squeezed, so the type is never distorted.
    const tagSize = Math.round(W * 0.034);
    const tagLh = tagSize * 1.45;
    ctx.save();
    ctx.globalAlpha = easeOut((t - 0.8) / 0.45);
    ctx.font = `500 ${tagSize}px ${sans}`;
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "1px";
    const tagLines = ctx.measureText(TAGLINE).width > W * 0.84 ? TAGLINE_LINES : [TAGLINE];
    const tagBottom = H * (scene.format === "9:16" ? 0.82 : 0.88);
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

  /** Draws whatever is on screen at time t (paused or scrubbing). */
  const drawAt = (t: number) => {
    if (t >= scene.seqSeconds && scene.brand) return drawEndCard(t - scene.seqSeconds);
    const i = segmentAt(scene, t);
    const seg = scene.seq[i];
    const local = Math.min(seg.to, seg.from + Math.max(0, t - scene.starts[i]));
    drawFrame(i, local, t);
  };

  return { W, H, drawFrame, drawEndCard, drawAt };
}

export type Compositor = ReturnType<typeof makeCompositor>;
