"use client";

import { ART, isArt } from "@/lib/art";
import type { Callout } from "@/lib/editPlan";
import { clamp01, easeInOut, easeOut, easeOutExpo, lerp, spring } from "@/lib/motion";
import { BRAND, CREAM, type TextKit } from "./text";

// The Editorial look: illustrated cards on warm ivory graph paper, a takeaway headline over blurred
// footage, paper-cutout stickers and gentle light leaks. Pure functions of time, like the rest of the
// renderer, so the preview and the exported file match frame for frame.

export const IVORY = "#F6F0E2";
const INK = "#1A1714";

/** Deterministic noise, so the paper texture is the same in every frame and every export. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const paperCache = new Map<string, HTMLCanvasElement>();

/** Warm ivory paper with faint graph lines, a fine grain and a soft vignette, drawn once per size. */
function paper(W: number, H: number): HTMLCanvasElement {
  const key = `${W}x${H}`;
  const hit = paperCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = IVORY;
  g.fillRect(0, 0, W, H);
  const cell = Math.round(W / 27);
  g.lineWidth = 1;
  for (let x = 0, n = 0; x <= W; x += cell, n++) {
    g.strokeStyle = n % 5 === 0 ? "rgba(52,96,84,.13)" : "rgba(52,96,84,.065)";
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, H);
    g.stroke();
  }
  for (let y = 0, n = 0; y <= H; y += cell, n++) {
    g.strokeStyle = n % 5 === 0 ? "rgba(52,96,84,.13)" : "rgba(52,96,84,.065)";
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(W, y + 0.5);
    g.stroke();
  }
  // Grain: tiny specks of darker and lighter fibre.
  const rand = rng(7);
  for (let i = 0; i < (W * H) / 260; i++) {
    const dark = rand() < 0.6;
    g.fillStyle = dark ? `rgba(90,70,40,${0.04 + rand() * 0.06})` : `rgba(255,255,255,${0.15 + rand() * 0.2})`;
    g.fillRect(rand() * W, rand() * H, 1 + rand() * 1.6, 1 + rand() * 1.6);
  }
  const v = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(120,90,40,0)");
  v.addColorStop(1, "rgba(120,90,40,.16)");
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  paperCache.set(key, c);
  return c;
}

/** Parallel ink lines across the 100 × 100 box at `angle` degrees (the caller clips them to a shape). */
function hatch(ctx: CanvasRenderingContext2D, angle: number, spacing: number, width: number) {
  ctx.save();
  ctx.translate(50, 50);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.beginPath();
  for (let y = -75; y <= 75; y += spacing) {
    ctx.moveTo(-75, y);
    ctx.lineTo(75, y);
  }
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

const pathCache = new Map<string, Path2D>();
const path = (d: string) => {
  let p = pathCache.get(d);
  if (!p) pathCache.set(d, (p = new Path2D(d)));
  return p;
};

/**
 * An illustration as a vintage engraving: each shape is filled with paper, hatched, given a cross-hatched shadow
 * on its lower right, and outlined in ink. `reveal` (0–1) draws the lines on, then lets the hatching settle in.
 */
export function drawArt(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, size: number, reveal = 1, paperFill = IVORY) {
  if (!isArt(id) || reveal <= 0) return;
  const art = ART[id];
  const s = size / 100;
  const base = ctx.globalAlpha;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;

  // A hatched shadow on the ground.
  ctx.save();
  ctx.globalAlpha = base * 0.5 * easeOut(reveal);
  ctx.beginPath();
  ctx.ellipse(52, 97, 34, 3.6, 0, 0, Math.PI * 2);
  ctx.clip();
  hatch(ctx, 0, 1.6, 0.6);
  ctx.restore();

  const ink = easeOut((reveal - 0.35) / 0.65);
  const dash = 420;
  for (const d of art.body) {
    const p = path(d);
    ctx.save();
    ctx.fillStyle = paperFill;
    ctx.fill(p, "evenodd");
    ctx.clip(p, "evenodd");
    ctx.globalAlpha = base * 0.55 * ink;
    hatch(ctx, 45, 4.2, 0.55);
    // Shadow: the part of the shape not covered by itself nudged up and to the left.
    const shade = new Path2D();
    shade.addPath(p);
    shade.addPath(p, new DOMMatrix().translate(-8, -8));
    ctx.clip(shade, "evenodd");
    ctx.globalAlpha = base * 0.85 * ink;
    hatch(ctx, -45, 2.3, 0.7);
    hatch(ctx, 45, 2.3, 0.45);
    ctx.restore();
    ctx.save();
    ctx.setLineDash([dash, dash]);
    ctx.lineDashOffset = dash * (1 - easeInOut(reveal / 0.7));
    ctx.lineWidth = 2.4;
    ctx.stroke(p);
    ctx.restore();
  }
  ctx.globalAlpha = base * ink;
  ctx.lineWidth = 1.8;
  for (const d of art.lines) ctx.stroke(path(d));
  ctx.restore();
}

/** Words laid out on centred lines no wider than `max`; returns each word's line and x offset from centre. */
function lines(ctx: CanvasRenderingContext2D, words: string[], gap: number, max: number) {
  const widths = words.map((w) => ctx.measureText(w).width);
  const rows: { start: number; end: number; width: number }[] = [];
  let start = 0, width = 0;
  words.forEach((_, i) => {
    const add = (i > start ? gap : 0) + widths[i];
    if (i > start && width + add > max) {
      rows.push({ start, end: i, width });
      start = i;
      width = widths[i];
    } else width += add;
  });
  rows.push({ start, end: words.length, width });
  const pos = words.map((_, i) => {
    const r = rows.findIndex((l) => i >= l.start && i < l.end);
    let x = -rows[r].width / 2;
    for (let j = rows[r].start; j < i; j++) x += widths[j] + gap;
    return { row: r, x, w: widths[i] };
  });
  return { rows, pos };
}

/** Which words of `text` belong to the highlighted phrase. */
function highlighted(words: string[], phrase: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!phrase) return out;
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const target = phrase.split(/\s+/).map(norm).filter(Boolean);
  for (let i = 0; i + target.length <= words.length; i++) {
    if (target.every((t, j) => norm(words[i + j]) === t)) {
      target.forEach((_, j) => out.add(i + j));
      break;
    }
  }
  return out;
}

/** The EdAI wordmark on paper: multiplied, so the light panel behind the letters disappears into the ivory. */
function paperLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, x: number, y: number, w: number, alpha: number) {
  const h = (w * logo.naturalHeight) / logo.naturalWidth;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(logo, x, y, w, h);
  ctx.restore();
}

/**
 * An illustrated card that replaces the picture while the voice continues. It builds in layers — headline,
 * illustration, then the supporting phrase — and gives way to the footage with a quick crossfade.
 */
export function drawCard(k: TextKit, c: Callout, into: number, logo: HTMLImageElement | null) {
  const { ctx, W, H } = k;
  const t = into - c.at;
  const tall = k.format === "9:16";
  const fadeIn = easeOut(t / 0.2);
  const fadeOut = 1 - easeInOut((t - (c.seconds - 0.22)) / 0.22);
  const a = Math.min(fadeIn, fadeOut);
  if (a <= 0) return;

  ctx.save();
  ctx.globalAlpha = a;
  const settle = 1.03 - 0.03 * easeOutExpo(t / 0.5);
  ctx.translate(W / 2, H / 2);
  ctx.scale(settle, settle);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(paper(W, H), 0, 0, W, H);

  const margin = W * 0.09;
  if (logo) paperLogo(ctx, logo, margin, H * (tall ? 0.065 : 0.05), W * 0.17, 0.9 * clamp01(t / 0.3));

  // Headline: Libre Baskerville, each line rising out of a mask, with the highlighted words on a strip.
  const words = c.text.split(/\s+/).filter(Boolean);
  let size = Math.round(W * (tall ? 0.092 : 0.08));
  ctx.font = `700 ${size}px ${k.serif}`;
  let lay = lines(ctx, words, size * 0.28, W - margin * 2);
  while (lay.rows.length > 3 && size > W * 0.05) {
    size = Math.round(size * 0.9);
    ctx.font = `700 ${size}px ${k.serif}`;
    lay = lines(ctx, words, size * 0.28, W - margin * 2);
  }
  const lh = size * 1.22;
  const top = H * (tall ? 0.16 : 0.1);
  const mark = highlighted(words, c.highlight);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  // Strips behind highlighted runs, wiping in left to right once the headline has landed.
  const wipe = easeOutExpo((t - 0.4) / 0.45);
  if (mark.size && wipe > 0) {
    lay.rows.forEach((row, r) => {
      const idx = [...mark].filter((i) => i >= row.start && i < row.end);
      if (!idx.length) return;
      const first = lay.pos[Math.min(...idx)], last = lay.pos[Math.max(...idx)];
      const x0 = W / 2 + first.x - size * 0.18, x1 = W / 2 + last.x + last.w + size * 0.18;
      const y = top + r * lh + lh / 2;
      ctx.fillStyle = BRAND;
      ctx.fillRect(x0, y - size * 0.56, (x1 - x0) * wipe, size * 1.08);
    });
  }
  words.forEach((word, i) => {
    const p = lay.pos[i];
    const lt = t - 0.05 - p.row * 0.09;
    const e = easeOutExpo(lt / 0.5);
    const y = top + p.row * lh + lh / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(W / 2 + p.x - 6, y - lh / 2, p.w + 12, lh);
    ctx.clip();
    ctx.globalAlpha = a * clamp01(lt / 0.12);
    ctx.fillStyle = mark.has(i) && wipe > 0.5 ? CREAM : INK;
    ctx.fillText(word, W / 2 + p.x, y + (1 - e) * lh * 0.9);
    ctx.restore();
  });

  // Illustration, drawn on in ink with a slow drift.
  const headBottom = top + lay.rows.length * lh;
  const supportY = H * (tall ? 0.8 : 0.85);
  const room = supportY - headBottom - size * 1.2;
  const artSize = Math.min(W * (tall ? 0.66 : 0.46), room);
  if (c.art && artSize > 40) {
    const at = t - 0.35;
    const cy = headBottom + size * 0.45 + room / 2;
    const drift = 1 + 0.025 * clamp01(t / c.seconds);
    const pop = 0.92 + 0.08 * easeOutExpo(at / 0.6);
    ctx.save();
    ctx.globalAlpha = a * clamp01(at / 0.15);
    drawArt(ctx, c.art, W / 2, cy, artSize * pop * drift, clamp01(at / 0.8));
    ctx.restore();
  }

  // Supporting phrase under a short emerald rule.
  if (c.support) {
    const st = t - 0.75;
    const sSize = Math.round(W * (tall ? 0.046 : 0.04));
    ctx.font = `500 ${sSize}px ${k.sans}`;
    ctx.textAlign = "center";
    const rule = W * 0.08 * easeInOut(st / 0.35);
    ctx.globalAlpha = a;
    ctx.fillStyle = BRAND;
    ctx.fillRect(W / 2 - rule / 2, supportY - sSize * 1.15, rule, Math.max(3, sSize * 0.08));
    ctx.globalAlpha = a * clamp01(st / 0.2);
    ctx.fillStyle = "rgba(26,23,20,.86)";
    ctx.fillText(c.support, W / 2, supportY + (1 - easeOutExpo(st / 0.45)) * sSize * 0.5, W - margin * 2);
  }
  ctx.restore();
}

let blurCanvas: [HTMLCanvasElement, HTMLCanvasElement] | null = null;

/**
 * A cheap, portable blur of what's already on the canvas (canvas filters aren't everywhere): shrink it twice
 * and stretch it back with smoothing.
 */
function blurBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, alpha: number) {
  const src = ctx.canvas;
  blurCanvas ??= [document.createElement("canvas"), document.createElement("canvas")];
  const [mid, small] = blurCanvas;
  mid.width = Math.max(8, Math.round(src.width / 6));
  mid.height = Math.max(8, Math.round(src.height / 6));
  small.width = Math.max(4, Math.round(src.width / 22));
  small.height = Math.max(4, Math.round(src.height / 22));
  const m = mid.getContext("2d")!, s = small.getContext("2d")!;
  m.imageSmoothingQuality = "high";
  m.drawImage(src, 0, 0, mid.width, mid.height);
  s.imageSmoothingQuality = "high";
  s.drawImage(mid, 0, 0, small.width, small.height);
  m.drawImage(small, 0, 0, mid.width, mid.height);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mid, 0, 0, W, H);
  ctx.restore();
}

/** The strongest takeaway: one huge headline over briefly dimmed and blurred footage. */
export function drawTakeaway(k: TextKit, c: Callout, into: number) {
  const { ctx, W, H } = k;
  const t = into - c.at;
  const out = easeInOut((t - (c.seconds - 0.25)) / 0.25);
  const a = Math.min(easeOut(t / 0.25), 1 - out);
  if (a <= 0) return;
  blurBackdrop(ctx, W, H, a);
  ctx.save();
  ctx.fillStyle = `rgba(11,11,10,${0.42 * a})`;
  ctx.fillRect(0, 0, W, H);

  const words = c.text.toUpperCase().split(/\s+/).filter(Boolean);
  let size = Math.round(W * (k.format === "9:16" ? 0.15 : 0.13));
  ctx.font = `800 ${size}px ${k.sans}`;
  let lay = lines(ctx, words, size * 0.26, W * 0.86);
  while ((lay.rows.length > 3 || Math.max(...lay.rows.map((r) => r.width)) > W * 0.86) && size > W * 0.06) {
    size = Math.round(size * 0.9);
    ctx.font = `800 ${size}px ${k.sans}`;
    lay = lines(ctx, words, size * 0.26, W * 0.86);
  }
  const lh = size * 1.02;
  const top = H * 0.46 - (lay.rows.length * lh) / 2;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  words.forEach((word, i) => {
    const p = lay.pos[i];
    const wt = t - 0.12 - i * 0.09;
    const s = 1.12 - 0.12 * spring(wt, 3, 0.7);
    const x = W / 2 + p.x + p.w / 2, y = top + p.row * lh + lh / 2;
    ctx.save();
    ctx.globalAlpha = a * clamp01(wt / 0.12);
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = size * 0.2;
    ctx.fillStyle = CREAM;
    ctx.fillText(word, -p.w / 2, 0);
    ctx.restore();
  });
  const bar = W * 0.16 * easeInOut((t - 0.25 - words.length * 0.09) / 0.4);
  ctx.globalAlpha = a;
  ctx.fillStyle = BRAND;
  ctx.fillRect(W / 2 - bar / 2, top + lay.rows.length * lh + size * 0.25, bar, Math.max(5, size * 0.07));
  ctx.restore();
}

/** A small paper-cutout illustration with a soft shadow, beside the speaker and away from the face. */
export function drawSticker(k: TextKit, c: Callout, into: number) {
  const { ctx, W, H } = k;
  const t = into - c.at;
  const exit = easeInOut((t - (c.seconds - 0.22)) / 0.22);
  const a = Math.min(easeOut(t / 0.25), 1 - exit);
  if (a <= 0) return;
  const right = (Math.round(c.at * 10) + c.segment) % 2 === 1;
  const size = W * 0.24;
  const label = c.text.trim();
  const w = size, h = size * (label ? 1.2 : 1);
  const cx = right ? W - W * 0.06 - w / 2 : W * 0.06 + w / 2;
  const cy = H * (k.format === "9:16" ? 0.47 : 0.5);
  const sp = spring(t, 2.4, 0.75);
  const tilt = ((right ? 5 : -6) + (1 - sp) * (right ? 8 : -8)) * (Math.PI / 180);

  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy + exit * size * 0.12);
  ctx.rotate(tilt);
  ctx.scale(0.86 + 0.14 * sp, 0.86 + 0.14 * sp);
  // A slightly uneven paper edge, the same every frame.
  const rand = rng(c.segment * 97 + Math.round(c.at * 100));
  const edge = new Path2D();
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const q = i / steps;
    const ang = q * Math.PI * 2;
    const rx = w / 2, ry = h / 2;
    // A rounded rectangle traced as a superellipse, with a little wobble.
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const px = Math.sign(cos) * Math.abs(cos) ** 0.35 * rx * (1 + (rand() - 0.5) * 0.035);
    const py = Math.sign(sin) * Math.abs(sin) ** 0.35 * ry * (1 + (rand() - 0.5) * 0.035);
    if (i === 0) edge.moveTo(px, py);
    else edge.lineTo(px, py);
  }
  edge.closePath();
  ctx.shadowColor = "rgba(0,0,0,.32)";
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.05;
  ctx.fillStyle = "#FBF7EE";
  ctx.fill(edge);
  ctx.shadowColor = "transparent";
  drawArt(ctx, c.art ?? "", 0, label ? -h * 0.1 : 0, size * 0.66, clamp01((t - 0.1) / 0.6), "#FBF7EE");
  if (label) {
    const ls = Math.round(size * 0.12);
    ctx.font = `700 ${ls}px ${k.sans}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;
    ctx.fillText(label, 0, h / 2 - ls * 1.05, w * 0.88);
  }
  ctx.restore();
}

/** A warm light leak drifting across the frame; `q` runs 0 → 1 over its life. */
export function drawLightLeak(ctx: CanvasRenderingContext2D, W: number, H: number, q: number, seed: number) {
  if (q <= 0 || q >= 1) return;
  const strength = Math.sin(Math.PI * q);
  const y = H * (0.25 + 0.3 * ((seed * 0.37) % 1));
  const x = lerp(-W * 0.3, W * 1.3, easeInOut(q));
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.9);
  g.addColorStop(0, `rgba(255,186,110,${0.6 * strength})`);
  g.addColorStop(0.45, `rgba(255,120,70,${0.28 * strength})`);
  g.addColorStop(1, "rgba(255,120,70,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W - x * 0.6, H - y, 0, W - x * 0.6, H - y, W * 0.5);
  g2.addColorStop(0, `rgba(255,220,170,${0.3 * strength})`);
  g2.addColorStop(1, "rgba(255,220,170,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
