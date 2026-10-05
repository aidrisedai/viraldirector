// Motion curves for the renderer's animation. Pure functions of time, so every frame is reproducible.

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
export const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
};
export const easeOutExpo = (x: number) => {
  const t = clamp01(x);
  return t === 1 ? 1 : 1 - 2 ** (-10 * t);
};

/**
 * Step response of a damped spring: 0 at t=0, settling at 1 with a natural overshoot.
 * `freq` is oscillations per second; `damping` is the damping ratio (below 1 overshoots).
 */
export function spring(t: number, freq = 2.4, damping = 0.5): number {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const z = Math.min(0.99, Math.max(0.05, damping));
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/**
 * Counts the first number in `text` up from zero, keeping its formatting: "200 users" at p=0.5 is
 * "100 users", "$1,250" keeps its comma, "2.5x" keeps one decimal. Text without a number is unchanged.
 */
export function countUp(text: string, p: number): string {
  const m = text.match(/\d[\d,]*(?:\.\d+)?/);
  if (!m) return text;
  const raw = m[0];
  const target = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(target)) return text;
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  const value = target * easeOutExpo(p);
  const fixed = value.toFixed(decimals);
  const shown = raw.includes(",") ? Number(fixed).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : fixed;
  return text.slice(0, m.index) + shown + text.slice(m.index! + raw.length);
}
