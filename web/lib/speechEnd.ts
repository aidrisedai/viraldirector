// Deciding when a take is finished: past the planned length, once the speaker has gone quiet. "Quiet" is judged
// against both how loud they were talking and the room's own noise, so a hum, a fan or a phone's automatic gain
// doesn't count as still talking.

export type SpeechEndOptions = {
  /** The shot's planned length, in seconds. */
  planned: number;
  /** Seconds of quiet that mean the sentence is over. */
  quiet?: number;
  /** The lowest level that can count as speech. */
  minSpeech?: number;
};

/** Feed it (time, level) for each audio frame; it returns true once the take should stop. */
export function createSpeechEnd({ planned, quiet = 0.8, minSpeech = 0.02 }: SpeechEndOptions) {
  let loud = 0;
  // Starts low: the first thing heard may well be speech.
  let floor = minSpeech / 4;
  let lastVoice = 0;
  let lastT = 0;
  return (t: number, rms: number): boolean => {
    const dt = Math.max(0, t - lastT);
    lastT = t;
    // Speaking level: jumps up, halves every 3 s. Room level: drops to the quietest moment (the gaps between words), creeps up slowly.
    loud = Math.max(rms, loud * Math.pow(0.5, dt / 3));
    floor = Math.min(rms, floor + 0.002 * dt);
    if (rms > Math.max(minSpeech, loud * 0.3, floor * 2.5)) lastVoice = t;
    return t >= planned + 0.5 && t - lastVoice >= quiet;
  };
}
