"use client";

import { CLIP_FRAMES, CLIPS_MAX, type Assignment, type ClipInfo, type ClipsRequest, type ClipsResponse } from "@/lib/clipImport";
import type { Take } from "@/lib/takes";
import { takeFrames } from "../frames";
import { analyzeTake } from "../render/analyze";
import { transcribeIfServer } from "../transcribe/transcribe";
import { takeFromFile } from "../useRecorder";

export const CLIP_MAX_BYTES = 500 * 1024 * 1024;

export type ImportedClip = { info: ClipInfo; take: Take; file: File };

/** Checks a picked set of files; returns the usable videos and a note about any left out. */
export function pickClips(files: File[]): { files: File[]; note: string } {
  const videos = files.filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(f.name));
  const ok = videos.filter((f) => f.size <= CLIP_MAX_BYTES).slice(0, CLIPS_MAX);
  const notes = [
    files.length > videos.length && `${files.length - videos.length} not a video`,
    videos.some((f) => f.size > CLIP_MAX_BYTES) && "clips over 500 MB",
    videos.filter((f) => f.size <= CLIP_MAX_BYTES).length > CLIPS_MAX && `more than ${CLIPS_MAX} clips`,
  ].filter(Boolean);
  return { files: ok, note: notes.length ? `Left out: ${notes.join(", ")}.` : "" };
}

/**
 * Reads each clip: its length, two frames, whether there's speech, and what's said (on the server, when it's set
 * up). The transcript also becomes the take's exact captions.
 */
export async function analyzeClips(files: File[], onProgress: (message: string) => void): Promise<ImportedClip[]> {
  const out: ImportedClip[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress(`Looking at clip ${i + 1} of ${files.length}…`);
    const file = files[i];
    let take: Take;
    try {
      take = { ...(await takeFromFile(file, -1)), origin: "import" };
    } catch {
      continue; // a file this browser can't play
    }
    const [frames, speech] = await Promise.all([takeFrames(take, CLIP_FRAMES).catch(() => []), analyzeTake(take)]);
    const hasSpeech = speech.onset !== null;
    const said = hasSpeech ? await transcribeIfServer(take) : null;
    if (said?.text.trim()) take = { ...take, transcript: said.text.trim(), words: said.words };
    out.push({
      take,
      file,
      info: { id: take.id, name: file.name.slice(0, 120), seconds: Math.round(take.seconds * 10) / 10, speech: hasSpeech, transcript: said?.text.trim().slice(0, 3000) || null, frames },
    });
  }
  return out;
}

/** Asks the Director (or the built-in rules) to plan around the clips or file them under shots. */
export async function directClips(body: ClipsRequest): Promise<Extract<ClipsResponse, { assign: Assignment }>> {
  let data: ClipsResponse;
  try {
    const res = await fetch("/api/clips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    data = (await res.json().catch(() => ({ error: "The Director didn’t respond. Try again." }))) as ClipsResponse;
  } catch {
    throw new Error("Couldn’t reach the Director. Check your connection and try again.");
  }
  if ("error" in data) throw new Error(data.error);
  return data;
}
