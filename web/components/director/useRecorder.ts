"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startTranscript } from "@/lib/speech";
import { CLIP_LEVEL, type Take } from "@/lib/takes";

// H.264 MP4 first (Chrome, Edge, Safari): it carries a duration and opens in every editor.
const MIME_CANDIDATES = [
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  "video/mp4;codecs=avc1",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

const SPEECH_RMS = 0.02;

export type Phase = "starting" | "ready" | "countdown" | "recording" | "saving" | "error";

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

const UNSUPPORTED = "This browser can’t record video. Try the latest Chrome, Edge, Firefox or Safari, or upload a clip instead.";

function supported() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && pickMime() !== null;
}

function cameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera and microphone access is blocked. Allow it in your browser’s site settings, or upload a clip instead.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No camera or microphone found. Connect one, or upload a clip instead.";
  if (name === "NotReadableError") return "Your camera is in use by another app. Close it and try again.";
  return "The camera couldn’t start. Try again, or upload a clip instead.";
}

/**
 * Live camera preview plus a recorder that counts down, records for `seconds` (+ a small
 * buffer, per GR-3), measures audio level while recording, then hands back a Take.
 */
export function useRecorder({ shot, seconds, onTake }: { shot: number; seconds: number; onTake: (t: Take) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timers = useRef<number[]>([]);
  const raf = useRef(0);
  const onTakeRef = useRef(onTake);
  useEffect(() => {
    onTakeRef.current = onTake;
  });

  const [phase, setPhase] = useState<Phase>(() => (supported() ? "starting" : "error"));
  const [error, setError] = useState(() => (supported() ? "" : UNSUPPORTED));
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    window.cancelAnimationFrame(raf.current);
  };

  const openCamera = useCallback(async () => {
    if (!supported()) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPhase("ready");
    } catch (e) {
      setError(cameraError(e));
      setPhase("error");
    }
  }, []);

  const retryCamera = useCallback(() => {
    setPhase("starting");
    setError("");
    openCamera();
  }, [openCamera]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set only after getUserMedia resolves
    openCamera();
    return () => {
      clearTimers();
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [openCamera]);

  const record = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = pickMime() || undefined;
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorderRef.current = recorder;
    const chunks: Blob[] = [];

    // Audio metering for the take review.
    let audio: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let peak = 0, frames = 0, voicedFrames = 0, clippedFrames = 0;
    try {
      audio = new AudioContext();
      analyser = audio.createAnalyser();
      analyser.fftSize = 2048;
      audio.createMediaStreamSource(stream).connect(analyser);
    } catch {
      audio = analyser = null;
    }
    const buf = new Float32Array(2048);

    const started = performance.now();
    const tick = () => {
      setElapsed((performance.now() - started) / 1000);
      if (analyser) {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0, framePeak = 0;
        for (const v of buf) {
          const a = Math.abs(v);
          if (a > framePeak) framePeak = a;
          sum += v * v;
        }
        if (framePeak > peak) peak = framePeak;
        if (framePeak >= CLIP_LEVEL) clippedFrames++;
        frames++;
        if (Math.sqrt(sum / buf.length) > SPEECH_RMS) voicedFrames++;
      }
      raf.current = window.requestAnimationFrame(tick);
    };

    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const transcript = startTranscript();

    recorder.onstop = async () => {
      clearTimers();
      const secs = (performance.now() - started) / 1000;
      audio?.close().catch(() => {});
      const type = recorder.mimeType || mime || "video/webm";
      const blob = new Blob(chunks, { type });
      setPhase("saving");
      const text = transcript ? await transcript.stop() : null;
      setPhase("ready");
      setElapsed(0);
      onTakeRef.current({
        id: crypto.randomUUID(),
        shot,
        url: URL.createObjectURL(blob),
        blob,
        mime: type,
        seconds: Math.round(secs * 10) / 10,
        peak: audio ? peak : null,
        clipped: audio && frames ? clippedFrames / frames : null,
        voiced: audio && frames ? voicedFrames / frames : null,
        transcript: text,
        source: "camera",
      });
    };

    recorder.start(250);
    setPhase("recording");
    tick();
    timers.current.push(window.setTimeout(() => recorder.state === "recording" && recorder.stop(), (seconds + 0.5) * 1000));
  }, [seconds, shot]);

  const start = useCallback(() => {
    if (phase !== "ready") return;
    setPhase("countdown");
    setCount(3);
    [2, 1].forEach((n, i) => timers.current.push(window.setTimeout(() => setCount(n), (i + 1) * 1000)));
    timers.current.push(window.setTimeout(record, 3000));
  }, [phase, record]);

  const stop = useCallback(() => {
    if (phase === "countdown") {
      clearTimers();
      setPhase("ready");
    } else if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, [phase]);

  return { videoRef, phase, error, count, elapsed, start, stop, retryCamera };
}

/** Builds a Take from an uploaded file, reading its duration from the browser. */
export function takeFromFile(file: File, shot: number): Promise<Take> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    const done = (seconds: number) =>
      resolve({ id: crypto.randomUUID(), shot, url, blob: file, mime: file.type || "video/mp4", seconds: Math.round(seconds * 10) / 10, peak: null, clipped: null, voiced: null, transcript: null, source: "upload" });
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) return done(v.duration);
      // Some WebM files report Infinity until seeked to the end.
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        done(v.duration);
      };
      v.currentTime = 1e9;
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn’t a video this browser can play."));
    };
    v.src = url;
  });
}

/**
 * Chrome's MediaRecorder writes WebM without a duration, so <video> reports Infinity and
 * can't scrub. Seeking past the end makes the browser compute it; then rewind.
 */
export function fixDuration(e: React.SyntheticEvent<HTMLVideoElement>) {
  const v = e.currentTarget;
  if (Number.isFinite(v.duration)) return;
  const autoplay = !v.paused;
  v.ontimeupdate = () => {
    v.ontimeupdate = null;
    v.currentTime = 0;
    if (autoplay) v.play().catch(() => {});
  };
  v.currentTime = 1e9;
}
