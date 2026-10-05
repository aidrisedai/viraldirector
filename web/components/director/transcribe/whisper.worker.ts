/// <reference lib="webworker" />
// On-device speech recognition with word timestamps (Whisper via transformers.js).
// The model downloads from Hugging Face on first use and is cached by the browser.
import { env, pipeline } from "@huggingface/transformers";

const MODEL = "Xenova/whisper-base.en";

env.allowLocalModels = false;
// Serve the ONNX Runtime WebAssembly from this site, not a CDN.
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = `${self.location.origin}/ort/`;

type Request = { id: string; audio: Float32Array };
type Chunk = { text: string; timestamp: [number, number | null] };
type Transcriber = (audio: Float32Array, options: Record<string, unknown>) => Promise<{ text: string; chunks?: Chunk[] }>;

let transcriber: Promise<Transcriber> | null = null;

function load(): Promise<Transcriber> {
  const device = "gpu" in navigator ? "webgpu" : "wasm";
  return pipeline("automatic-speech-recognition", MODEL, {
    device,
    progress_callback: (p: { status: string; progress?: number; file?: string }) => {
      if (p.status === "progress" && typeof p.progress === "number") self.postMessage({ type: "download", progress: p.progress, file: p.file });
    },
  }) as unknown as Promise<Transcriber>;
}

self.onmessage = async (e: MessageEvent<Request>) => {
  const { id, audio } = e.data;
  try {
    transcriber ??= load().catch((err) => {
      transcriber = null;
      throw err;
    });
    const asr = await transcriber;
    self.postMessage({ type: "ready" });
    const out = await asr(audio, { return_timestamps: "word", chunk_length_s: 30 });
    self.postMessage({ type: "result", id, text: out.text.trim(), chunks: out.chunks ?? [] });
  } catch (err) {
    self.postMessage({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
  }
};
