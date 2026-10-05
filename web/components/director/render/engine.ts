"use client";

import { musicGains } from "@/lib/audioMix";
import { FORMATS, TARGET_RMS } from "@/lib/edit";
import type { ComposedSegment, Extra } from "@/lib/editPlan";
import { loadFonts, makeCompositor, overlayKey, segmentAt, type Compositor, type Media, type Scene } from "./compositor";
import type { MusicTrack } from "./musicTrack";

// Plays an edit: the live preview in the editor (play, pause, scrub, live music volume) and the
// export (the same playback, recorded). One code path, so the preview is the final video.

function once(target: EventTarget, event: string, timeoutMs = 8000) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    target.addEventListener(event, () => (clearTimeout(t), resolve()), { once: true });
  });
}

async function loadVideo(url: string, muted: boolean): Promise<HTMLVideoElement> {
  const v = document.createElement("video");
  v.playsInline = true;
  v.preload = "auto";
  v.muted = muted;
  v.src = url;
  await once(v, "loadedmetadata");
  if (!Number.isFinite(v.duration)) {
    // MediaRecorder WebM has no duration until seeked to the end.
    v.currentTime = 1e9;
    await once(v, "seeked").catch(() => {});
    v.currentTime = 0;
  }
  return v;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** Seeks a video and waits until that frame can be drawn (or a short timeout). */
async function seekTo(v: HTMLVideoElement, time: number) {
  if (Math.abs(v.currentTime - time) < 0.01 && v.readyState >= 2) return;
  v.currentTime = time;
  await once(v, "seeked", 1500).catch(() => {});
}

type Mode = "preview" | "record";

export class Engine {
  private ctx: CanvasRenderingContext2D;
  private scene: Scene | null = null;
  private comp: Compositor | null = null;
  private clips = new Map<string, HTMLVideoElement>();
  private overlays = new Map<string, Media>();
  private loading = new Map<string, Promise<unknown>>();
  private logoLight: HTMLImageElement | null = null;
  private brandmark: HTMLImageElement | null = null;

  private audio: AudioContext | null = null;
  private out: AudioNode | null = null;
  private recordDest: MediaStreamAudioDestinationNode | null = null;
  private clipGains = new Map<string, GainNode>();
  private musicBus: GainNode | null = null;
  private musicFade: GainNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private music: MusicTrack | null = null;
  private musicVolume = 0.7;

  private t = 0;
  private playing = false;
  private runToken = 0;
  private seekToken = 0;
  private activeOverlayVideos = new Set<HTMLVideoElement>();

  /** Called every frame while playing and after each seek, with the time in the video. */
  onTime: (t: number) => void = () => {};
  onPlayingChange: (playing: boolean) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private mode: Mode, private scale = 1) {
    this.ctx = canvas.getContext("2d")!;
  }

  get time() {
    return this.t;
  }
  get duration() {
    return this.scene?.total ?? 0;
  }
  get isPlaying() {
    return this.playing;
  }

  // ---------- content ----------

  /** Loads whatever media the scene needs (cached) and makes it current. Pauses while it swaps. */
  async setScene(scene: Scene, extras: Extra[]) {
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    await loadFonts();
    const { width: W, height: H } = FORMATS[scene.format];
    if (this.canvas.width !== Math.round(W * this.scale)) {
      this.canvas.width = Math.round(W * this.scale);
      this.canvas.height = Math.round(H * this.scale);
    }
    await this.ensureMedia(scene, extras);
    this.scene = scene;
    this.comp = makeCompositor(this.ctx, scene, {
      clip: (id) => this.clips.get(id),
      overlay: (key) => this.overlays.get(key),
      logoLight: scene.brand ? this.logoLight : null,
      brandmark: scene.brand ? this.brandmark : null,
    });
    this.t = Math.min(this.t, Math.max(0, scene.total - 0.05));
    this.updateMix();
    if (wasPlaying) await this.play();
    else await this.seek(this.t);
  }

  setMusic(track: MusicTrack | null) {
    if (track === this.music) return;
    this.music = track;
    if (this.playing) this.startMusic();
  }

  /** Live: the music level follows the slider while playing. */
  setMusicVolume(volume: number) {
    this.musicVolume = volume;
    this.updateMix();
  }

  private async ensureMedia(scene: Scene, extras: Extra[]) {
    const jobs: Promise<unknown>[] = [];
    const want = <T>(key: string, map: Map<string, T>, load: () => Promise<T>) => {
      if (map.has(key)) return;
      let job = this.loading.get(key);
      if (!job) {
        job = load().then((m) => map.set(key, m)).finally(() => this.loading.delete(key));
        this.loading.set(key, job);
      }
      jobs.push(job.catch(() => {}));
    };
    for (const seg of scene.seq) {
      want(seg.take.id, this.clips, () => loadVideo(seg.take.url, false));
      for (const ov of seg.overlays) {
        const key = overlayKey(ov);
        if (ov.kind === "segment") want(key, this.overlays, () => loadVideo(ov.from.take.url, true));
        else {
          const extra = extras.find((e) => e.id === ov.extraId);
          if (extra) want(key, this.overlays, () => (extra.kind === "image" ? loadImage(extra.url) : loadVideo(extra.url, true)));
        }
      }
    }
    if (scene.brand && !this.logoLight) {
      jobs.push(
        Promise.all([loadImage("/brand/edai-wordmark-black-on-light.jpg"), loadImage("/brand/edai-brandmark-white.png")]).then(([a, b]) => {
          this.logoLight = a;
          this.brandmark = b;
        }),
      );
    }
    await Promise.all(jobs);
    if (this.audio) for (const [id, v] of this.clips) this.connectClip(id, v);
  }

  // ---------- audio ----------

  /** Builds the mix: clips → level match → voice bus; music → mix level; both → peak limiter → out. */
  private ensureAudio() {
    if (this.audio) return this.audio;
    const audio = new AudioContext({ sampleRate: 48000 });
    // Loudness comes from per-clip level matching (see buildTimeline); this limiter only catches peaks.
    // (A DynamicsCompressorNode adds its own automatic make-up gain, so a high threshold keeps that small.)
    const limiter = audio.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;
    if (this.mode === "record") {
      this.recordDest = audio.createMediaStreamDestination();
      limiter.connect(this.recordDest);
    } else limiter.connect(audio.destination);
    this.out = limiter;
    this.musicBus = audio.createGain();
    this.musicBus.gain.value = 0;
    this.musicFade = audio.createGain();
    this.musicFade.connect(this.musicBus).connect(limiter);
    this.audio = audio;
    for (const [id, v] of this.clips) this.connectClip(id, v);
    return audio;
  }

  private connectClip(id: string, v: HTMLVideoElement) {
    if (!this.audio || this.clipGains.has(id)) return;
    const g = this.audio.createGain();
    g.gain.value = 0; // each clip is unmuted when its turn comes
    this.audio.createMediaElementSource(v).connect(g).connect(this.out!);
    this.clipGains.set(id, g);
  }

  /** Music is set from measurements: 20 dB under the quietest speaking clip while anyone talks, 9 dB under in the gaps. */
  private mixLevels() {
    const voiceLevels = (this.scene?.seq ?? []).flatMap((s) => (s.voiceLevel ? [s.voiceLevel] : []));
    const voiceRef = voiceLevels.length ? Math.min(...voiceLevels) : TARGET_RMS;
    return this.music ? musicGains(this.music.level, voiceRef, this.musicVolume) : { underSpeech: 0, gaps: 0 };
  }

  private currentSegment(): ComposedSegment | null {
    const sc = this.scene;
    if (!sc || this.t >= sc.seqSeconds) return null;
    return sc.seq[segmentAt(sc, this.t)];
  }

  private updateMix() {
    if (!this.audio || !this.musicBus) return;
    const mix = this.mixLevels();
    const seg = this.currentSegment();
    this.musicBus.gain.setTargetAtTime(seg?.speech ? mix.underSpeech : mix.gaps, this.audio.currentTime, 0.08);
  }

  private stopMusic() {
    try {
      this.musicSource?.stop();
    } catch {}
    this.musicSource?.disconnect();
    this.musicSource = null;
  }

  /** Starts the music at the current time, fading in at the very start and out over the end card. */
  private startMusic() {
    this.stopMusic();
    const audio = this.audio, sc = this.scene;
    if (!audio || !sc || !this.music || !this.musicFade) return;
    const src = audio.createBufferSource();
    src.buffer = this.music.buffer;
    src.loop = true;
    src.connect(this.musicFade);
    const now = audio.currentTime + 0.02;
    const fade = this.musicFade.gain;
    fade.cancelScheduledValues(now);
    fade.setValueAtTime(Math.min(1, this.t / 0.8), now);
    if (this.t < 0.8) fade.linearRampToValueAtTime(1, now + (0.8 - this.t));
    const left = sc.total - this.t;
    if (left > 0.6) {
      fade.setValueAtTime(1, now + left - 0.6);
      fade.linearRampToValueAtTime(0, now + left);
    }
    src.start(now, this.t % this.music.buffer.duration);
    this.musicSource = src;
  }

  // ---------- transport ----------

  /** Shows time t: seeks the clip (and any overlay clips) and draws once the frame is ready. */
  async seek(t: number) {
    const sc = this.scene;
    if (!sc || !this.comp) return;
    const token = ++this.seekToken;
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    this.t = Math.max(0, Math.min(t, sc.total - 0.01));
    if (this.t < sc.seqSeconds) {
      const i = segmentAt(sc, this.t);
      const seg = sc.seq[i];
      const into = this.t - sc.starts[i];
      const v = this.clips.get(seg.take.id);
      const waits: Promise<void>[] = [];
      if (v) waits.push(seekTo(v, seg.from + into));
      for (const ov of seg.overlays) {
        const m = this.overlays.get(overlayKey(ov));
        if (m instanceof HTMLVideoElement && into >= ov.at && into < ov.at + ov.seconds) {
          waits.push(seekTo(m, (ov.kind === "segment" ? ov.from.from : 0) + (into - ov.at)));
        }
      }
      await Promise.all(waits);
    }
    if (token !== this.seekToken) return;
    this.draw();
    this.onTime(this.t);
    if (wasPlaying) await this.play();
  }

  private draw(sinceCut?: number) {
    const sc = this.scene, comp = this.comp;
    if (!sc || !comp) return;
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (this.t >= sc.seqSeconds && sc.brand) comp.drawEndCard(this.t - sc.seqSeconds);
    else {
      const i = segmentAt(sc, this.t);
      const seg = sc.seq[i];
      const local = Math.min(seg.to, seg.from + Math.max(0, this.t - sc.starts[i]));
      comp.drawFrame(i, local, this.t, sinceCut ?? local - seg.from);
    }
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.runToken++;
    for (const v of this.clips.values()) v.pause();
    this.activeOverlayVideos.forEach((m) => m.pause());
    this.activeOverlayVideos.clear();
    for (const g of this.clipGains.values()) g.gain.value = 0;
    this.stopMusic();
    this.onPlayingChange(false);
  }

  /** Plays from the current time to the end (or until paused). Resolves when playback stops. */
  async play(): Promise<void> {
    const sc = this.scene;
    if (!sc || this.playing) return;
    if (this.t >= sc.total - 0.05) this.t = 0;
    const audio = this.ensureAudio();
    await audio.resume();
    this.playing = true;
    this.onPlayingChange(true);
    const token = ++this.runToken;
    const alive = () => this.playing && token === this.runToken;
    this.startMusic();

    while (alive() && this.t < sc.seqSeconds) {
      const i = segmentAt(sc, this.t);
      const seg = sc.seq[i];
      const v = this.clips.get(seg.take.id);
      const startInto = this.t - sc.starts[i];
      if (!v) break;
      if (Math.abs(v.currentTime - (seg.from + startInto)) > 0.08) v.currentTime = seg.from + startInto;
      for (const [id, g] of this.clipGains) g.gain.setValueAtTime(id === seg.take.id ? seg.gain : 0, audio.currentTime);
      this.updateMix();
      // Keep drawing while play() starts, so the cut never freezes and the transition always plays out.
      const cutWall = performance.now() - startInto * 1000;
      const started = v.play().catch(() => {});
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (!alive()) return resolve();
          const local = Math.max(seg.from + startInto, v.currentTime);
          this.t = sc.starts[i] + Math.min(local, seg.to) - seg.from;
          this.syncOverlays(seg, local - seg.from);
          this.draw((performance.now() - cutWall) / 1000);
          this.onTime(this.t);
          if (local >= seg.to - 0.02 || v.ended) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await started;
      v.pause();
      this.activeOverlayVideos.forEach((m) => m.pause());
      this.activeOverlayVideos.clear();
      if (!alive()) return;
      this.t = i + 1 < sc.seq.length ? sc.starts[i + 1] : sc.seqSeconds;
    }

    if (alive() && sc.brand) {
      this.updateMix();
      for (const g of this.clipGains.values()) g.gain.value = 0;
      const startWall = performance.now() - (this.t - sc.seqSeconds) * 1000;
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (!alive()) return resolve();
          this.t = Math.min(sc.total, sc.seqSeconds + (performance.now() - startWall) / 1000);
          this.draw();
          this.onTime(this.t);
          if (this.t >= sc.total) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }
    if (!alive()) return;
    this.t = sc.total;
    this.playing = false;
    this.stopMusic();
    this.onPlayingChange(false);
  }

  private syncOverlays(seg: ComposedSegment, into: number) {
    for (const ov of seg.overlays) {
      const m = this.overlays.get(overlayKey(ov));
      if (!(m instanceof HTMLVideoElement)) continue;
      const on = into >= ov.at && into < ov.at + ov.seconds;
      if (on && !this.activeOverlayVideos.has(m)) {
        this.activeOverlayVideos.add(m);
        m.currentTime = (ov.kind === "segment" ? ov.from.from : 0) + (into - ov.at);
        m.play().catch(() => {});
      } else if (!on && this.activeOverlayVideos.has(m) && !seg.overlays.some((x) => x !== ov && overlayKey(x) === overlayKey(ov) && into >= x.at && into < x.at + x.seconds)) {
        this.activeOverlayVideos.delete(m);
        m.pause();
      }
    }
  }

  // ---------- export ----------

  /** Plays the whole edit once and records it. Real time; the tab must stay visible. */
  async record(mime: string, onProgress: (f: number) => void, signal: AbortSignal): Promise<Blob> {
    const sc = this.scene;
    if (!sc) throw new Error("Nothing to record.");
    const audio = this.ensureAudio();
    await audio.resume();
    // Warm every clip's decoder (silently) so each clip starts at once and transitions aren't cut short.
    for (const [id, v] of this.clips) {
      const seg = sc.seq.find((s) => s.take.id === id);
      try {
        await v.play();
        v.pause();
        if (seg) await seekTo(v, seg.from);
      } catch {}
    }
    await this.seek(0);

    const stream = new MediaStream([...this.canvas.captureStream(30).getVideoTracks(), ...this.recordDest!.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 192_000 });
    const parts: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && parts.push(e.data);
    const stopped = new Promise<void>((r) => (recorder.onstop = () => r()));

    let abortReason = "";
    const fail = (why: string) => {
      abortReason ||= why;
      this.pause();
    };
    const onHidden = () => document.hidden && fail("Rendering stopped because the tab was hidden. Keep this tab open and try again.");
    document.addEventListener("visibilitychange", onHidden);
    const onAbort = () => fail("Cancelled.");
    signal.addEventListener("abort", onAbort, { once: true });
    const onTime = this.onTime;
    this.onTime = (t) => onProgress(Math.min(0.99, t / sc.total));

    try {
      recorder.start(1000);
      await this.play();
      // Let the music tail settle.
      await new Promise((r) => setTimeout(r, 400));
    } finally {
      recorder.stop();
      await stopped;
      this.onTime = onTime;
      document.removeEventListener("visibilitychange", onHidden);
      signal.removeEventListener("abort", onAbort);
      stream.getTracks().forEach((t) => t.stop());
    }
    if (abortReason) throw new Error(abortReason);
    onProgress(1);
    return new Blob(parts, { type: mime.split(";")[0] });
  }

  /** Frees media and audio. */
  dispose() {
    this.pause();
    for (const m of [...this.clips.values(), ...this.overlays.values()]) {
      if (m instanceof HTMLVideoElement) {
        m.removeAttribute("src");
        m.load();
      }
    }
    this.clips.clear();
    this.overlays.clear();
    this.audio?.close().catch(() => {});
    this.audio = null;
  }
}
