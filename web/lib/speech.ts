// Minimal typing for the Web Speech API, which TypeScript's DOM lib doesn't ship everywhere.
// Chrome and Edge send the audio to their speech service; Safari runs it on-device; Firefox lacks it.

export type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

export function speechRecognition(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Transcribes speech while a take records. Best effort: returns null where the browser has no
 * speech recognition, or if it fails.
 */
export function startTranscript(): { stop: () => Promise<string | null> } | null {
  const Ctor = speechRecognition();
  if (!Ctor) return null;
  const finals: string[] = [];
  let interim = "";
  let ended = false;
  let resolveEnd: () => void = () => {};
  const endPromise = new Promise<void>((r) => (resolveEnd = r));
  try {
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) finals.push(text);
        else interim += ` ${text}`;
      }
    };
    r.onend = r.onerror = () => {
      ended = true;
      resolveEnd();
    };
    r.start();
    return {
      async stop() {
        if (!ended) {
          r.stop();
          // Give the recognizer a moment to deliver its last result.
          await Promise.race([endPromise, new Promise((res) => setTimeout(res, 1500))]);
        }
        const text = [...finals, interim.trim()].filter(Boolean).join(" ").trim();
        return text || null;
      },
    };
  } catch {
    return null;
  }
}
