"use client";

import type { FormatKey, TimedWord } from "@/lib/edit";
import type { Callout, Style } from "@/lib/editPlan";
import { clamp01, countUp, easeInOut, easeOut, easeOutExpo, lerp, spring } from "@/lib/motion";

// Animated type for the finished video: four caption styles, the kinetic opening title and callouts.
// Everything is a pure function of time, so a frame always looks the same however it's reached.

export const BRAND = "#1FA67A";
export const CREAM = "#F4EEE3";
const INK = "#0B0B0A";

export type Word = TimedWord & { idx: number };

export type TextKit = {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  sans: string;
  serif: string;
  style: Style;
  format: FormatKey;
};

const SIZE = { S: 0.82, M: 1, L: 1.2 } as const;

/** Words per on-screen caption chunk, per style. */
export const CHUNK_WORDS: Record<Style["captions"], number> = { Pop: 3, Karaoke: 6, Bold: 2, Minimal: 6, Editorial: 4, Off: 3 };

export function captionCenterY(k: Pick<TextKit, "H" | "format" | "style">) {
  const tall = k.format === "9:16";
  const lower = k.style.captionPosition === "Lower";
  // Editorial captions sit around chest height, a little below the usual eyeline spot.
  if (k.style.captions === "Editorial") return k.H * (lower ? (tall ? 0.79 : 0.85) : tall ? 0.71 : 0.77);
  return k.H * (lower ? (tall ? 0.78 : 0.84) : tall ? 0.67 : 0.74);
}

const clean = (w: string) => w.replace(/[“”"]/g, "");

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

function softShadow(ctx: CanvasRenderingContext2D, size: number, strength = 0.55) {
  ctx.shadowColor = `rgba(0,0,0,${strength})`;
  ctx.shadowBlur = size * 0.22;
  ctx.shadowOffsetY = size * 0.05;
}
function noShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Splits words into lines that fit `max` wide; returns each word's line and x offset. */
function layout(ctx: CanvasRenderingContext2D, words: string[], gap: number, max: number, maxLines: number) {
  const widths = words.map((w) => ctx.measureText(w).width);
  const lines: { start: number; end: number; width: number }[] = [];
  let start = 0, width = 0;
  words.forEach((_, i) => {
    const add = (i > start ? gap : 0) + widths[i];
    if (i > start && width + add > max && lines.length < maxLines - 1) {
      lines.push({ start, end: i, width });
      start = i;
      width = widths[i];
    } else width += add;
  });
  lines.push({ start, end: words.length, width });
  const pos = words.map((_, i) => {
    const line = lines.findIndex((l) => i >= l.start && i < l.end);
    const l = lines[line];
    let x = -l.width / 2;
    for (let j = l.start; j < i; j++) x += widths[j] + gap;
    return { line, x, w: widths[i] };
  });
  return { lines, pos, widest: Math.max(...lines.map((l) => l.width)) };
}

/** The chunk on screen at `local`, and when it appeared. */
export function activeChunk(chunks: Word[][], local: number): Word[] | null {
  const c = chunks.find((ch) => local < ch[ch.length - 1].end + 0.05);
  if (!c || local < c[0].start - 0.08) return null;
  return c;
}

// ---------- Captions ----------

export function drawCaptions(k: TextKit, chunks: Word[][], local: number, emphasis: Set<number>) {
  const chunk = activeChunk(chunks, local);
  if (!chunk || k.style.captions === "Off") return;
  const { ctx } = k;
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  if (k.style.captions === "Pop") pop(k, chunk, local, emphasis);
  else if (k.style.captions === "Karaoke") karaoke(k, chunk, local, emphasis);
  else if (k.style.captions === "Bold") bold(k, chunk, local, emphasis);
  else if (k.style.captions === "Editorial") editorial(k, chunk, local, emphasis);
  else minimal(k, chunk, local, emphasis);
  ctx.restore();
}

/** Current word on an emerald pill that glides from word to word; the chunk springs in. */
function pop(k: TextKit, chunk: Word[], local: number, emphasis: Set<number>) {
  const { ctx, W } = k;
  let size = Math.round(W * (k.format === "9:16" ? 0.074 : 0.064) * SIZE[k.style.captionSize]);
  const words = chunk.map((w) => clean(w.word).toUpperCase());
  ctx.font = `800 ${size}px ${k.sans}`;
  let gap = size * 0.3;
  let lay = layout(ctx, words, gap, W * 0.86, 1);
  if (lay.widest > W * 0.86) {
    size = Math.floor((size * W * 0.86) / lay.widest);
    ctx.font = `800 ${size}px ${k.sans}`;
    gap = size * 0.3;
    lay = layout(ctx, words, gap, W * 0.86, 1);
  }
  const cy = captionCenterY(k);
  const t0 = chunk[0].start - 0.08;

  // Which word the pill is on: the one being said, else the last one said.
  let a = chunk.findIndex((w) => local >= w.start && local < w.end);
  if (a < 0) a = chunk.reduce((last, w, i) => (local >= w.start ? i : last), -1);

  ctx.translate(W / 2, cy);
  if (a >= 0) {
    const q = easeOutExpo((local - chunk[a].start) / 0.16);
    const from = a > 0 ? lay.pos[a - 1] : { x: lay.pos[0].x + lay.pos[0].w / 2, w: 0 };
    const to = lay.pos[a];
    const x = lerp(from.x, to.x, q), w = lerp(from.w, to.w, q);
    const padX = size * 0.24, padY = size * 0.16;
    const emph = emphasis.has(chunk[a].idx);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = size * 0.3;
    ctx.fillStyle = emph ? CREAM : BRAND;
    ctx.beginPath();
    ctx.roundRect(x - padX, -size / 2 - padY, w + padX * 2, size + padY * 2, size * 0.26);
    ctx.fill();
    ctx.restore();
  }

  chunk.forEach((w, i) => {
    const t = local - t0 - i * 0.035;
    const rise = (1 - spring(t, 3, 0.55)) * size * 0.55;
    const alpha = clamp01(t / 0.08);
    const on = i === a;
    const emph = emphasis.has(w.idx);
    const pulse = on ? 1 + (emph ? 0.24 : 0.12) * (1 - easeOut((local - w.start) / 0.2)) : emph ? 1.08 : 1;
    const p = lay.pos[i];
    ctx.save();
    ctx.globalAlpha = alpha * (local < w.start ? 0.9 : 1);
    ctx.translate(p.x + p.w / 2, rise);
    ctx.scale(pulse, pulse);
    if (!on) {
      softShadow(ctx, size);
      ctx.lineWidth = size * 0.12;
      ctx.strokeStyle = "rgba(0,0,0,.85)";
      ctx.strokeText(words[i], -p.w / 2, 0);
      noShadow(ctx);
    }
    ctx.fillStyle = on ? (emph ? BRAND : "#fff") : emph ? BRAND : "#fff";
    ctx.fillText(words[i], -p.w / 2, 0);
    ctx.restore();
  });
}

/** The whole line on a soft panel; each word fills with emerald as it's spoken. */
function karaoke(k: TextKit, chunk: Word[], local: number, emphasis: Set<number>) {
  const { ctx, W } = k;
  const size = Math.round(W * (k.format === "9:16" ? 0.064 : 0.056) * SIZE[k.style.captionSize]);
  const words = chunk.map((w) => clean(w.word));
  ctx.font = `700 ${size}px ${k.sans}`;
  const gap = size * 0.28;
  const lay = layout(ctx, words, gap, W * 0.8, 2);
  const lh = size * 1.32;
  const blockH = lay.lines.length * lh;
  const cy = captionCenterY(k);
  const t = local - (chunk[0].start - 0.1);
  const s = 0.94 + 0.06 * spring(t, 2.6, 0.6);

  ctx.translate(W / 2, cy);
  ctx.scale(s, s);
  ctx.globalAlpha = clamp01(t / 0.12);
  const padX = size * 0.7, padY = size * 0.45;
  ctx.fillStyle = "rgba(11,11,10,.62)";
  ctx.beginPath();
  ctx.roundRect(-lay.widest / 2 - padX, -blockH / 2 - padY, lay.widest + padX * 2, blockH + padY * 2, size * 0.5);
  ctx.fill();

  chunk.forEach((w, i) => {
    const p = lay.pos[i];
    const y = -blockH / 2 + lh * (p.line + 0.5);
    const progress = clamp01((local - w.start) / Math.max(0.08, w.end - w.start));
    ctx.fillStyle = "rgba(255,255,255,.42)";
    ctx.fillText(words[i], p.x, y);
    if (progress > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x - 2, y - size, (p.w + 4) * progress, size * 2);
      ctx.clip();
      ctx.fillStyle = progress < 1 || emphasis.has(w.idx) ? BRAND : "#fff";
      ctx.fillText(words[i], p.x, y);
      ctx.restore();
    }
    if (emphasis.has(w.idx) && progress > 0) {
      ctx.fillStyle = BRAND;
      ctx.fillRect(p.x, y + size * 0.62, p.w * easeOut(progress * 1.5), Math.max(3, size * 0.07));
    }
  });
}

/** One or two huge words, stacked, each slamming in as it's said. */
function bold(k: TextKit, chunk: Word[], local: number, emphasis: Set<number>) {
  const { ctx, W } = k;
  const base = Math.round(W * (k.format === "9:16" ? 0.12 : 0.1) * SIZE[k.style.captionSize]);
  const shown = chunk.filter((w) => local >= w.start - 0.03);
  if (!shown.length) return;
  const cy = captionCenterY(k);
  const lines = chunk.map((w) => {
    const text = clean(w.word).toUpperCase();
    ctx.font = `800 ${base}px ${k.sans}`;
    const width = ctx.measureText(text).width;
    const size = width > W * 0.86 ? Math.floor((base * W * 0.86) / width) : base;
    return { w, text, size };
  });
  const totalH = lines.reduce((h, l) => h + l.size * 1.02, 0);
  let y = cy - totalH / 2;

  lines.forEach(({ w, text, size }) => {
    const lineY = y + size * 0.51;
    y += size * 1.02;
    if (local < w.start - 0.03) return;
    const t = local - (w.start - 0.03);
    const s = 1.55 - 0.55 * spring(t, 3.4, 0.5);
    const emph = emphasis.has(w.idx);
    ctx.save();
    ctx.font = `800 ${size}px ${k.sans}`;
    ctx.textAlign = "center";
    ctx.translate(W / 2, lineY);
    if (emph) ctx.rotate((-3 * Math.PI) / 180);
    // Motion blur while it lands: a couple of fading, larger ghosts.
    if (t < 0.14) {
      for (const [g, a] of [[1.14, 0.18], [1.3, 0.08]] as const) {
        ctx.save();
        ctx.globalAlpha = a * (1 - t / 0.14);
        ctx.scale(s * g, s * g);
        ctx.fillStyle = emph ? BRAND : "#fff";
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }
    ctx.globalAlpha = clamp01(t / 0.05);
    ctx.scale(s, s);
    softShadow(ctx, size, 0.6);
    ctx.lineWidth = size * 0.1;
    ctx.strokeStyle = INK;
    ctx.strokeText(text, 0, 0);
    noShadow(ctx);
    ctx.fillStyle = emph ? BRAND : "#fff";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  });
}

/** Clean sentence-case lines that drift up into place; emphasised words in emerald. */
function minimal(k: TextKit, chunk: Word[], local: number, emphasis: Set<number>) {
  const { ctx, W } = k;
  const size = Math.round(W * (k.format === "9:16" ? 0.06 : 0.053) * SIZE[k.style.captionSize]);
  const words = chunk.map((w) => clean(w.word));
  ctx.font = `600 ${size}px ${k.sans}`;
  const gap = size * 0.27;
  const lay = layout(ctx, words, gap, W * 0.8, 2);
  const lh = size * 1.3;
  const blockH = lay.lines.length * lh;
  const t = local - (chunk[0].start - 0.12);
  const e = easeOutExpo(t / 0.4);
  ctx.translate(W / 2, captionCenterY(k) + (1 - e) * size * 0.5);
  ctx.globalAlpha = clamp01(t / 0.2);
  softShadow(ctx, size, 0.7);
  chunk.forEach((w, i) => {
    const p = lay.pos[i];
    ctx.fillStyle = emphasis.has(w.idx) ? "#5FD3A8" : "#fff";
    ctx.fillText(words[i], p.x, -blockH / 2 + lh * (p.line + 0.5));
  });
  noShadow(ctx);
}

/**
 * Short phrases revealed word by word on a discreet translucent backing; emphasised words get an emerald
 * strip rather than a bounce. The backing is sized to the whole phrase up front so it never jumps.
 */
function editorial(k: TextKit, chunk: Word[], local: number, emphasis: Set<number>) {
  const { ctx, W } = k;
  const size = Math.round(W * (k.format === "9:16" ? 0.056 : 0.05) * SIZE[k.style.captionSize]);
  const words = chunk.map((w) => clean(w.word));
  ctx.font = `600 ${size}px ${k.sans}`;
  const gap = size * 0.26;
  const lay = layout(ctx, words, gap, W * 0.8, 2);
  const lh = size * 1.3;
  const blockH = lay.lines.length * lh;
  const t = local - (chunk[0].start - 0.08);
  ctx.translate(W / 2, captionCenterY(k));
  const padX = size * 0.5, padY = size * 0.32;
  ctx.globalAlpha = clamp01(t / 0.14);
  ctx.fillStyle = "rgba(11,11,10,.44)";
  ctx.beginPath();
  ctx.roundRect(-lay.widest / 2 - padX, -blockH / 2 - padY, lay.widest + padX * 2, blockH + padY * 2, size * 0.28);
  ctx.fill();
  chunk.forEach((w, i) => {
    const p = lay.pos[i];
    const wt = local - (w.start - 0.04);
    if (wt < 0) return;
    const y = -blockH / 2 + lh * (p.line + 0.5);
    const e = easeOutExpo(wt / 0.22);
    ctx.globalAlpha = clamp01(wt / 0.1);
    if (emphasis.has(w.idx)) {
      ctx.fillStyle = BRAND;
      ctx.fillRect(p.x - size * 0.12, y - size * 0.56, (p.w + size * 0.24) * easeOutExpo(wt / 0.25), size * 1.1);
    }
    ctx.fillStyle = "#fff";
    ctx.fillText(words[i], p.x, y + (1 - e) * size * 0.18);
  });
}

// ---------- Opening title ----------

/** How long the opening title stays up, from its length. */
export const titleSeconds = (title: string) => Math.min(3.4, Math.max(2.4, 0.9 + title.split(/\s+/).length * 0.22));

/** Kinetic title: words rise out of a mask one by one over a soft scrim, an emerald rule draws in, then it lifts away. */
export function drawTitle(k: TextKit, title: string, elapsed: number, top: number) {
  const dur = titleSeconds(title);
  if (!title || elapsed >= dur) return;
  const { ctx, W, H } = k;
  const out = easeInOut((elapsed - (dur - 0.32)) / 0.32);
  const scrim = Math.min(easeOut(elapsed / 0.3), 1 - out);

  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  g.addColorStop(0, `rgba(0,0,0,${0.62 * scrim})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.5);

  const size = Math.round(W * (k.format === "9:16" ? 0.078 : 0.068));
  ctx.font = `700 ${size}px ${k.serif}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const words = title.replace(/^[“"]|[”"]$/g, "").split(/\s+/);
  const lay = layout(ctx, words, size * 0.26, W * 0.82, 4);
  const lh = size * 1.2;
  const y0 = top + lh / 2 - out * size * 0.6;

  words.forEach((word, i) => {
    const p = lay.pos[i];
    const t = elapsed - 0.12 - i * 0.07;
    const e = easeOutExpo(t / 0.5);
    const y = y0 + p.line * lh;
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x + W / 2 - 4, y - lh / 2, p.w + 8, lh);
    ctx.clip();
    ctx.globalAlpha = (1 - out) * clamp01(t / 0.1);
    softShadow(ctx, size, 0.45);
    ctx.fillStyle = "#fff";
    ctx.fillText(word, W / 2 + p.x, y + (1 - e) * lh);
    ctx.restore();
  });

  const lastLine = lay.lines.length - 1;
  const ruleT = elapsed - 0.25 - words.length * 0.07;
  const lineW = lay.lines[lastLine].width;
  ctx.globalAlpha = 1 - out;
  ctx.fillStyle = BRAND;
  ctx.fillRect(W / 2 - lineW / 2, y0 + lastLine * lh + size * 0.72, Math.min(lineW, size * 2.2) * easeInOut(ruleT / 0.4), Math.max(5, size * 0.08));
  ctx.restore();
}

// ---------- Callouts ----------

/** Stat: an emerald card wipes open and the number counts up. Label: a tag slides in behind an emerald bar. */
export function drawCallout(k: TextKit, c: Callout, into: number, lower: boolean) {
  const { ctx, W, H } = k;
  const t = into - c.at;
  const exit = easeInOut((t - (c.seconds - 0.22)) / 0.22);
  ctx.save();
  ctx.textBaseline = "middle";
  if (c.style === "stat") {
    const size = Math.round(W * 0.095);
    ctx.font = `700 ${size}px ${k.serif}`;
    const full = ctx.measureText(c.text).width;
    const tw = Math.min(full, W * 0.78);
    const padX = size * 0.55, padY = size * 0.36;
    const y = lower ? H * 0.55 : H * 0.3;
    const open = easeOutExpo(t / 0.35);
    ctx.translate(W / 2, y - exit * size * 0.4);
    ctx.globalAlpha = 1 - exit;
    ctx.save();
    ctx.scale(open, 1);
    ctx.shadowColor = "rgba(0,0,0,.3)";
    ctx.shadowBlur = size * 0.5;
    ctx.fillStyle = BRAND;
    ctx.beginPath();
    ctx.roundRect(-tw / 2 - padX, -size / 2 - padY, tw + padX * 2, size + padY * 2, size * 0.38);
    ctx.fill();
    ctx.restore();
    const s = 0.7 + 0.3 * spring(t - 0.12, 2.8, 0.5);
    ctx.scale(s, s);
    ctx.globalAlpha = (1 - exit) * clamp01((t - 0.12) / 0.1);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(countUp(c.text, (t - 0.1) / 0.9), 0, 0, W * 0.78);
  } else {
    const size = Math.round(W * 0.056);
    ctx.font = `700 ${size}px ${k.sans}`;
    setSpacing(ctx, size * 0.08);
    const text = c.text.toUpperCase();
    const tw = Math.min(ctx.measureText(text).width, W * 0.74);
    const padX = size * 0.7, padY = size * 0.5;
    const boxW = tw + padX * 2, boxH = size + padY * 2;
    const x = (W - boxW) / 2 - exit * W * 0.15;
    const y = (lower ? H * 0.55 : H * 0.27) - boxH / 2;
    const bar = easeOutExpo(t / 0.22);
    const wipe = easeOutExpo((t - 0.08) / 0.4);
    ctx.globalAlpha = 1 - exit;
    ctx.fillStyle = BRAND;
    ctx.fillRect(x - size * 0.35, y + boxH * (1 - bar), size * 0.22, boxH * bar);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, boxW * wipe, boxH);
    ctx.clip();
    ctx.shadowColor = "rgba(0,0,0,.25)";
    ctx.shadowBlur = size * 0.6;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, boxW, boxH);
    noShadow(ctx);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.fillText(text, x + padX - (1 - wipe) * size, y + boxH / 2, W * 0.74);
    ctx.restore();
  }
  ctx.restore();
}

// ---------- End card text ----------

/** Words rise in one after another, starting at `delay`. */
export function drawStaggered(k: TextKit, text: string, cx: number, cy: number, t: number, font: string, color: string, maxW: number) {
  const { ctx } = k;
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const words = text.split(/\s+/);
  const size = parseInt(font.match(/(\d+)px/)?.[1] ?? "40", 10);
  const lay = layout(ctx, words, size * 0.28, maxW, 2);
  const lh = size * 1.25;
  const top = cy - ((lay.lines.length - 1) * lh) / 2;
  ctx.fillStyle = color;
  words.forEach((w, i) => {
    const wt = t - i * 0.06;
    const p = lay.pos[i];
    ctx.globalAlpha = clamp01(wt / 0.25);
    ctx.fillText(w, cx + p.x, top + p.line * lh + (1 - easeOutExpo(wt / 0.5)) * size * 0.6);
  });
  ctx.restore();
}
