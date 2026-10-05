import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { speechRecognition, type Recognition } from "@/lib/speech";

const noSubscribe = () => () => {};

/** Browser dictation that appends what was said to `value` (capped at `max`). */
export function useDictation(value: string, onChange: (next: string) => void, max: number) {
  const supported = useSyncExternalStore(noSubscribe, () => Boolean(speechRecognition()), () => false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const latest = useRef({ value, onChange });

  useEffect(() => {
    latest.current = { value, onChange };
  }, [value, onChange]);
  useEffect(() => () => recognition.current?.stop(), []);

  const toggle = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = speechRecognition();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text) latest.current.onChange(`${latest.current.value} ${text.trim()}`.trim().slice(0, max));
    };
    r.onend = r.onerror = () => setListening(false);
    recognition.current = r;
    r.start();
    setListening(true);
  };

  return { supported, listening, toggle };
}
