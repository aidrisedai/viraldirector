import { useRef, useState } from "react";
import { Button } from "@/components/ds/Button";
import { Icon } from "@/components/ds/Icon";
import { MUSIC_STYLES } from "@/lib/edit";
import { CAPTION_POSITIONS, CAPTION_SIZES, CAPTION_STYLES, ENERGIES, TRANSITIONS, type Style } from "@/lib/editPlan";
import { Chips } from "../Chips";
import { decodeMusicFile } from "../render/musicTrack";
import type { ExportState } from "./useExportState";
import s from "../director.module.css";

const CAPTION_HINT: Record<Style["captions"], string> = {
  Pop: "Word by word on a gliding emerald pill.",
  Karaoke: "The whole line fills in as you speak.",
  Bold: "One or two huge words slam in.",
  Minimal: "Clean, calm sentence-case lines.",
  Off: "No captions.",
};

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** The look of the video: captions, motion, opening title, music and branding. */
export function LookControls({ state, hookTitle, disabled }: { state: ExportState; hookTitle: string; disabled: boolean }) {
  const { style, setStyle, music, setMusic, customMusic, setCustomMusic } = state;
  const set = (p: Partial<Style>) => setStyle((x) => ({ ...x, ...p }));
  const fileRef = useRef<HTMLInputElement>(null);
  const [musicError, setMusicError] = useState("");
  const [loadingSong, setLoadingSong] = useState(false);

  const pickSong = async (file: File | undefined) => {
    if (!file) return;
    setMusicError("");
    setLoadingSong(true);
    try {
      setCustomMusic(await decodeMusicFile(file));
      setMusic("My music");
    } catch (e) {
      setMusicError(e instanceof Error ? e.message : "Couldn’t read that song.");
    } finally {
      setLoadingSong(false);
    }
  };

  return (
    <fieldset className={s.look} disabled={disabled}>
      <div className={s.stack} style={{ gap: 8 }}>
        <span className={s.label}>Captions</span>
        <Chips label="Caption style" options={CAPTION_STYLES} isOn={(c) => c === style.captions} onToggle={(captions) => set({ captions })} />
        <span className={s.hint}>{CAPTION_HINT[style.captions]}</span>
        {style.captions !== "Off" && (
          <div className={s.lookRow}>
            <Chips label="Caption size" options={CAPTION_SIZES} isOn={(c) => c === style.captionSize} onToggle={(captionSize) => set({ captionSize })} />
            <Chips label="Caption position" options={CAPTION_POSITIONS} isOn={(c) => c === style.captionPosition} onToggle={(captionPosition) => set({ captionPosition })} />
          </div>
        )}
      </div>

      <div className={s.stack} style={{ gap: 8 }}>
        <span className={s.label}>Motion</span>
        <div className={s.lookRow}>
          <Chips label="Transition" options={TRANSITIONS} isOn={(c) => c === style.transition} onToggle={(transition) => set({ transition })} />
          <Chips label="Energy" options={ENERGIES} isOn={(c) => c === style.energy} onToggle={(energy) => set({ energy })} />
        </div>
      </div>

      <div className={s.stack} style={{ gap: 8 }}>
        <span className={s.label}>Opening title</span>
        <div className={s.lookRow}>
          <input
            className={s.extraNote}
            style={{ flex: 1, minWidth: 200 }}
            aria-label="Opening title"
            placeholder={hookTitle}
            maxLength={90}
            value={style.title}
            onChange={(e) => set({ title: e.target.value })}
            disabled={!style.showTitle}
          />
          <Chips label="Show opening title" options={["Show", "Hide"] as const} isOn={(c) => (c === "Show") === style.showTitle} onToggle={(c) => set({ showTitle: c === "Show" })} />
        </div>
      </div>

      <div className={s.stack} style={{ gap: 8 }}>
        <span className={s.label}>Music</span>
        <Chips
          label="Music"
          options={MUSIC_STYLES}
          isOn={(m) => m === music}
          onToggle={(m) => {
            if (m === "My music" && !customMusic) fileRef.current?.click();
            else setMusic(m);
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
          hidden
          onChange={(e) => {
            pickSong(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {(music === "My music" || customMusic) && (
          <div className={s.songRow}>
            <Icon name="play" size={16} color="var(--emerald-600)" />
            <span className={s.songName}>{loadingSong ? "Reading your song…" : customMusic ? `${customMusic.name} · ${clock(customMusic.buffer.duration)}` : "No song chosen"}</span>
            <Button variant="ghost" size="sm" icon="upload" onClick={() => fileRef.current?.click()} disabled={loadingSong}>
              {customMusic ? "Change song" : "Choose a song"}
            </Button>
          </div>
        )}
        {musicError && <p className={s.error} role="alert">{musicError}</p>}
        {music !== "No music" && (
          <label className={s.volumeRow}>
            <span className={s.hint} style={{ minWidth: 92 }}>Music volume</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(style.musicVolume * 100)}
              onChange={(e) => set({ musicVolume: Number(e.target.value) / 100 })}
              aria-label="Music volume"
            />
            <span className={s.hint} style={{ minWidth: 36, textAlign: "right" }}>{Math.round(style.musicVolume * 100)}%</span>
          </label>
        )}
        {music !== "No music" && (
          <span className={s.hint}>
            Music is measured and mixed under your voice — even at 100% it stays well below your speech and dips while you talk.
            {music === "My music" && " Use music you have the rights to post."}
          </span>
        )}
      </div>

      <div className={s.stack} style={{ gap: 8 }}>
        <span className={s.label}>EdAI branding</span>
        <Chips label="EdAI branding" options={["On", "Off"] as const} isOn={(c) => (c === "On") === state.brand} onToggle={(c) => state.setBrand(c === "On")} />
      </div>
    </fieldset>
  );
}
