"use client";

import type { MusicStyle } from "@/lib/edit";

// A small generative music bed built with Web Audio, so every video gets royalty-free music
// with no licensed tracks. A minor-key four-chord loop; "Upbeat" adds a beat and hats.

const PROGRESSION = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function pad(ctx: BaseAudioContext, out: AudioNode, notes: number[], start: number, length: number, level: number) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(level, start + Math.min(0.6, length / 3));
  env.gain.setValueAtTime(level, start + length - 0.3);
  env.gain.linearRampToValueAtTime(0, start + length);
  filter.connect(env).connect(out);
  for (const n of notes) {
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = hz(n);
      o.detune.value = detune;
      o.connect(filter);
      o.start(start);
      o.stop(start + length);
    }
  }
  // Bass an octave below the root.
  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = "sine";
  bass.frequency.value = hz(notes[0] - 12);
  bassGain.gain.setValueAtTime(level * 1.4, start);
  bassGain.gain.linearRampToValueAtTime(0, start + length);
  bass.connect(bassGain).connect(out);
  bass.start(start);
  bass.stop(start + length);
}

function kick(ctx: BaseAudioContext, out: AudioNode, t: number, level: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.26);
}

let noise: AudioBuffer | null = null;
function hat(ctx: BaseAudioContext, out: AudioNode, t: number, level: number) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  src.connect(hp).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.06);
}

/** Schedules `seconds` of music into `out`, starting at `start` on the context clock. */
export function scheduleMusic(ctx: BaseAudioContext, out: AudioNode, start: number, seconds: number, style: MusicStyle) {
  if (style === "No music") return;
  const upbeat = style === "Upbeat";
  const beat = 60 / (upbeat ? 112 : 88);
  const bar = beat * 4;
  const bars = Math.ceil(seconds / bar) + 1;
  for (let b = 0; b < bars; b++) {
    const t = start + b * bar;
    // Calm build: pads first, the pulse joins after two bars.
    pad(ctx, out, PROGRESSION[b % 4], t, bar, upbeat ? 0.05 : 0.06);
    for (let i = 0; i < 4; i++) {
      const bt = t + i * beat;
      if (upbeat || (b >= 2 && i % 2 === 0)) kick(ctx, out, bt, upbeat ? 0.5 : 0.35);
      if (upbeat) hat(ctx, out, bt + beat / 2, 0.08);
    }
  }
}
