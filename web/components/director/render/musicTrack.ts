"use client";

import { loudLevel, monoMix } from "@/lib/audioMix";
import type { MusicStyle } from "@/lib/edit";
import { scheduleMusic } from "./music";

/** A music bed ready to mix: decoded at 48 kHz, with its measured loud level. */
export type MusicTrack = { buffer: AudioBuffer; level: number; name: string };

const SAMPLE_RATE = 48000;
export const MUSIC_MAX_BYTES = 60 * 1024 * 1024;

function measure(buffer: AudioBuffer): number {
  const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, i) => buffer.getChannelData(i));
  return loudLevel(monoMix(channels), buffer.sampleRate);
}

/** Decodes the creator's own song (MP3, M4A, WAV, OGG…). */
export async function decodeMusicFile(file: File): Promise<MusicTrack> {
  if (file.size > MUSIC_MAX_BYTES) throw new Error(`That song is too large (max ${MUSIC_MAX_BYTES / 1024 / 1024} MB).`);
  let buffer: AudioBuffer;
  try {
    // An OfflineAudioContext resamples to its own rate while decoding.
    buffer = await new OfflineAudioContext(2, SAMPLE_RATE, SAMPLE_RATE).decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error(`Couldn’t read ${file.name}. Try an MP3, M4A or WAV file.`);
  }
  if (buffer.duration < 2) throw new Error("That song is too short — pick one at least a few seconds long.");
  const level = measure(buffer);
  if (level < 1e-4) throw new Error("That song seems to be silent.");
  return { buffer, level, name: file.name.replace(/\.[^.]+$/, "") };
}

/** Renders the built-in generated bed for `seconds`, so it's mixed exactly like an uploaded song. */
export async function generatedTrack(style: MusicStyle, seconds: number): Promise<MusicTrack | null> {
  if (style !== "Calm build" && style !== "Upbeat") return null;
  const length = Math.ceil((seconds + 1) * SAMPLE_RATE);
  const ctx = new OfflineAudioContext(2, length, SAMPLE_RATE);
  scheduleMusic(ctx, ctx.destination, 0, seconds + 1, style);
  const buffer = await ctx.startRendering();
  return { buffer, level: measure(buffer), name: style };
}
