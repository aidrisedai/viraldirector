// Music sits under the voice. Levels are set from measurements, not by ear, so any track —
// the generated bed or the creator's own song — lands at the same place relative to the speech.

/** How far the music's loud parts sit below the voice, in dB, at full music volume. */
export const UNDER_SPEECH_DB = -20;
/** Between lines, over silent B-roll and on the end card the music comes up, but never to the voice. */
export const IN_GAPS_DB = -9;
/** Never boost a very quiet track by more than this, so its noise floor stays down. */
const MAX_MUSIC_BOOST = 6;

export const dbToGain = (db: number) => 10 ** (db / 20);

/**
 * The level of a track's loud parts: RMS over 50 ms frames, taken at the 90th percentile so
 * choruses and drops count, but a single spike doesn't.
 */
export function loudLevel(samples: Float32Array, sampleRate: number): number {
  const size = Math.max(1, Math.round(sampleRate * 0.05));
  const frames: number[] = [];
  for (let i = 0; i + size <= samples.length; i += size) {
    let sum = 0;
    for (let j = i; j < i + size; j++) sum += samples[j] * samples[j];
    frames.push(Math.sqrt(sum / size));
  }
  if (!frames.length) return 0;
  frames.sort((a, b) => a - b);
  return frames[Math.min(frames.length - 1, Math.floor(frames.length * 0.9))];
}

/** Mono mix of up to two channels, for measuring. */
export function monoMix(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (let i = 0; i < out.length; i++) out[i] = (channels[0][i] + channels[1][i]) / 2;
  return out;
}

/**
 * Gains for the music bus. `voiceLevel` is the speech RMS after level matching (the quietest
 * speaking clip, so music stays under every clip); `volume` (0–1) is the creator's music slider.
 */
export function musicGains(musicLevel: number, voiceLevel: number, volume: number) {
  if (musicLevel <= 0 || voiceLevel <= 0 || volume <= 0) return { underSpeech: 0, gaps: 0 };
  const v = Math.min(1, volume);
  const base = Math.min(MAX_MUSIC_BOOST, voiceLevel / musicLevel);
  return { underSpeech: base * dbToGain(UNDER_SPEECH_DB) * v, gaps: base * dbToGain(IN_GAPS_DB) * v };
}
