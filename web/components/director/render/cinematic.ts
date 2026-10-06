"use client";

import type { Callout } from "@/lib/editPlan";
import { clamp01, easeInOut, easeOut, easeOutExpo } from "@/lib/motion";
import { drawCover, type Media } from "./compositor";
import { BRAND, CREAM, type TextKit } from "./text";

// The Cinematic look: a dark, dramatic build with oversized serif words, a stacked three-panel montage, a pale
// flash into a warm human payoff, and a closing title. Pure functions of time, like the rest of the renderer.

/** Colour for the dark build and the warm payoff (canvas filters; browsers without them skip it). */
export const CINEMATIC_FILTER = { dark: "brightness(0.9) contrast(1.12) saturate(0.82)", warm: "brightness(1.04) saturate(1.06) sepia(0.12)" };

/** Darkened edges that pull the eye to the centre, for the dark section. */
export function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number, strength = 1) {
  const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.6);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${0.55 * strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** A brief pale flash: the cut into the warm payoff. */
export function drawPaleFlash(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  if (t < 0 || t >= 0.32) return;
  ctx.fillStyle = `rgba(255,248,236,${0.85 * (1 - easeOut(t / 0.32))})`;
  ctx.fillRect(0, 0, W, H);
}

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * One or two spoken words, oversized in Libre Baskerville at its natural proportions, dominating the upper frame.
 * Each word rises out of a mask; highlighted words take the brand accent.
 */
export function drawHeadline(k: TextKit, c: Callout, into: number) {
  const { ctx, W, H } = k;
  const t = into - c.at;
  const out = easeInOut((t - (c.seconds - 0.25)) / 0.25);
  const a = Math.min(clamp01(t / 0.08), 1 - out);
  if (a <= 0) return;
  const words = c.text.trim().split(/\s+/).filter(Boolean);
  const accent = new Set((c.highlight ?? "").split(/\s+/).map(norm).filter(Boolean));
  // Up to two lines; as big as fits.
  const rows = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)), words.slice(Math.ceil(words.length / 2))] : words.length === 2 && words.join(" ").length > 12 ? [[words[0]], [words[1]]] : [words];
  let size = Math.round(W * 0.42);
  const fit = () => {
    ctx.font = `700 ${size}px ${k.serif}`;
    return Math.max(...rows.map((r) => ctx.measureText(r.join(" ")).width));
  };
  while (fit() > W * 0.92 && size > W * 0.08) size = Math.round(size * 0.95);
  const lh = size * 1.02;
  const top = H * (k.format === "9:16" ? 0.1 : 0.07);

  ctx.save();
  // A soft darkening at the top so the word reads over any background.
  const g = ctx.createLinearGradient(0, 0, 0, top + rows.length * lh + size * 0.4);
  g.addColorStop(0, `rgba(0,0,0,${0.45 * a})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, top + rows.length * lh + size * 0.4);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  let n = 0;
  rows.forEach((row, r) => {
    const space = ctx.measureText(" ").width;
    const widths = row.map((w) => ctx.measureText(w).width);
    let x = W / 2 - (widths.reduce((s, w) => s + w, 0) + space * (row.length - 1)) / 2;
    const base = top + (r + 1) * lh - size * 0.18;
    row.forEach((word, j) => {
      const wt = t - n++ * 0.1;
      const e = easeOutExpo(wt / 0.55);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - size * 0.1, base - lh, widths[j] + size * 0.2, lh + size * 0.3);
      ctx.clip();
      ctx.globalAlpha = a;
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowBlur = size * 0.12;
      ctx.fillStyle = accent.has(norm(word)) ? BRAND : CREAM;
      // A slow push as it sits, so the word feels alive without moving off its mark.
      const drift = 1 + 0.03 * clamp01(t / c.seconds);
      ctx.translate(x + widths[j] / 2, base);
      ctx.scale(drift, drift);
      ctx.fillText(word, -widths[j] / 2, (1 - e) * lh);
      ctx.restore();
      x += widths[j] + space;
    });
  });
  ctx.restore();
}

/** The closing title over the last shot: a large serif title, the call to action, and a small EdAI logo. */
export function drawEndTitle(k: TextKit, c: Callout, into: number, logo: HTMLImageElement | null) {
  const { ctx, W, H } = k;
  const t = into - c.at;
  const a = Math.min(easeOut(t / 0.3), 1 - easeInOut((t - (c.seconds - 0.2)) / 0.2));
  if (a <= 0) return;
  ctx.save();
  const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${0.7 * a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.45, W, H * 0.55);

  const words = c.text.trim().split(/\s+/);
  let size = Math.round(W * 0.11);
  ctx.font = `700 ${size}px ${k.serif}`;
  while (ctx.measureText(c.text).width > W * 0.86 * 2 && size > W * 0.06) {
    size = Math.round(size * 0.92);
    ctx.font = `700 ${size}px ${k.serif}`;
  }
  // Two balanced lines when it doesn't fit on one.
  const lines: string[] = [];
  if (ctx.measureText(c.text).width <= W * 0.86) lines.push(c.text);
  else {
    let best = 1, bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(ctx.measureText(words.slice(0, i).join(" ")).width - ctx.measureText(words.slice(i).join(" ")).width);
      if (d < bestDiff) [best, bestDiff] = [i, d];
    }
    lines.push(words.slice(0, best).join(" "), words.slice(best).join(" "));
  }
  const lh = size * 1.15;
  const ctaSize = Math.round(W * 0.042);
  const bottom = H * (k.format === "9:16" ? 0.74 : 0.78);
  const top = bottom - lines.length * lh;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => {
    const lt = t - i * 0.12;
    const e = easeOutExpo(lt / 0.6);
    const y = top + i * lh + lh / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y - lh / 2, W, lh);
    ctx.clip();
    ctx.globalAlpha = a * clamp01(lt / 0.1);
    ctx.fillStyle = CREAM;
    ctx.fillText(line, W / 2, y + (1 - e) * lh * 0.8, W * 0.9);
    ctx.restore();
  });
  const ct = t - 0.45;
  if (c.support) {
    ctx.globalAlpha = a * clamp01(ct / 0.25);
    ctx.font = `500 ${ctaSize}px ${k.sans}`;
    ctx.fillStyle = "rgba(244,238,227,.9)";
    ctx.fillText(c.support, W / 2, bottom + ctaSize * 1.2 + (1 - easeOutExpo(ct / 0.5)) * ctaSize * 0.5, W * 0.86);
  }
  if (logo) {
    // Small and quiet: the official wordmark on its own light panel.
    const lw = W * 0.15, lhh = (lw * logo.naturalHeight) / logo.naturalWidth;
    const ly = bottom + ctaSize * (c.support ? 2.4 : 1.2);
    ctx.globalAlpha = a * 0.92 * clamp01((t - 0.7) / 0.3);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(W / 2 - lw / 2, ly, lw, lhh, 8);
    ctx.clip();
    ctx.drawImage(logo, W / 2 - lw / 2, ly, lw, lhh);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Up to three panels stacked inside the vertical frame — say face, hands working, and the result — sliding in one
 * after another from alternating sides.
 */
export function drawPanels(ctx: CanvasRenderingContext2D, W: number, H: number, panels: { m: Media; t: number; seconds: number }[]) {
  if (!panels.length) return;
  const n = panels.length;
  const gap = Math.round(W * 0.018);
  const ph = (H - gap * (n + 1)) / n;
  const first = panels[0];
  const bgA = Math.min(easeOut(first.t / 0.2), 1 - easeInOut((first.t - (first.seconds - 0.2)) / 0.2));
  ctx.save();
  ctx.globalAlpha = bgA;
  ctx.fillStyle = "#0B0B0A";
  ctx.fillRect(0, 0, W, H);
  panels.forEach(({ m, t, seconds }, i) => {
    const lt = t - i * 0.12;
    const e = easeOutExpo(lt / 0.5);
    const exit = easeInOut((t - (seconds - 0.2)) / 0.2);
    const dir = i % 2 === 0 ? -1 : 1;
    ctx.globalAlpha = clamp01(lt / 0.12) * (1 - exit);
    drawCover(ctx, m, gap + dir * (1 - e) * W * 0.4, gap + i * (ph + gap), W - gap * 2, ph, 1.06 - 0.06 * clamp01(t / seconds));
  });
  ctx.restore();
}
