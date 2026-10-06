"use client";

/** Saves a URL (usually a blob URL) as a file. */
export function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Saves a Blob as a file. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Whether this device can hand files to the share sheet (phones: "Save to Photos"). */
export function canShareFiles(files: File[]): boolean {
  return typeof navigator !== "undefined" && !!navigator.canShare?.({ files });
}
