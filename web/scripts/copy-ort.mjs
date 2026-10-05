// Copies the ONNX Runtime WebAssembly files transformers.js needs into public/ort, so the
// browser loads them from this site instead of a CDN.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "onnxruntime-web", "dist");
const dest = join(root, "public", "ort");
mkdirSync(dest, { recursive: true });
for (const f of ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"]) {
  copyFileSync(join(src, f), join(dest, f));
}
console.log("Copied ONNX Runtime web files to public/ort");
