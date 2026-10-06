import { ART, isArt } from "./art";
import { FORMATS, type FormatKey } from "./edit";
import type { Callout, ComposedEdit, Style } from "./editPlan";
import type { Look } from "./plan";
import { toSrt } from "./srt";

// The finished edit written out as a brief for another AI video editor: what plays when (to the tenth of a
// second, with in and out points in each file), what goes on top, how it looks and sounds, and the captions.

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const secs = (t: number) => `${t.toFixed(2)}s`;

/** The house style of each version, as an editor would need to hear it. */
const LOOK_NOTES: Record<Look, string[]> = {
  Standard: [
    "Energetic and bold: animated captions, quick motion, punch-ins on key words, a short animated title over the opening.",
  ],
  Editorial: [
    "A calm, premium explainer that keeps my voice in charge.",
    "Captions: Outfit, short phrases of two to five words revealed word by word, on a discreet translucent backing around chest height; key words on an emerald strip (no bouncing).",
    "Graphic cards: the picture is replaced by a card on warm ivory paper with faint graph-paper lines and subtle texture, a large Libre Baskerville headline with the highlighted words on an emerald strip, a black vintage engraving-style illustration, and a short supporting line. Animate in layers: headline, illustration, then the supporting line. My voice continues underneath.",
    "Stickers: small paper-cutout illustrations with soft shadows beside me, away from my face, with restrained entrances.",
    "Takeaway: one large headline over briefly dimmed and blurred footage.",
    "Cuts: clean cuts, quick soft crossfades, an occasional gentle warm light leak. Subtle punch-ins and occasional wider framing. Gentle, consistent colour correction that keeps skin natural.",
  ],
  Cinematic: [
    "A 25–30-second cinematic introduction: a strong hook, escalating visual energy and a genuine human payoff.",
    "Captions: Outfit, short phrases revealed word by word, clear of faces and platform controls; smaller during the payoff. No opening logo animation.",
    "Dramatic build: a dark cinematic grade with controlled highlights, visible skin detail and a soft vignette. The \"big word\" items are oversized Libre Baskerville words dominating the upper frame at natural proportions (never stretched) — place them behind my head where clean masking is possible.",
    "Montage: wide shots, profiles, details, hands working and the project, alternating close and wide. A \"panel\" group is one composition of up to three stacked panels inside the vertical frame.",
    "Human payoff: a brief pale flash or decisive cut into warmer, naturally lit footage.",
    "Ending: the closing title in large Libre Baskerville over the final shot, the call to action under it, and an unobtrusive official EdAI logo. No long branded outro.",
  ],
};

function calloutLine(c: Callout): string {
  const art = c.art && isArt(c.art) ? ART[c.art].label.toLowerCase() : "";
  switch (c.style) {
    case "stat": return `big number "${c.text}" (counts up on screen)`;
    case "label": return `text label "${c.text}"`;
    case "card":
      return `graphic card (replaces the picture, voice continues): headline "${c.text}"${c.highlight ? `, highlight "${c.highlight}"` : ""}${art ? `, illustration: ${art}` : ""}${c.support ? `, supporting line "${c.support}"` : ""}`;
    case "takeaway": return `takeaway headline "${c.text}" over dimmed, blurred footage`;
    case "sticker": return `paper-cutout sticker${art ? ` (${art})` : ""}${c.text ? ` labelled "${c.text}"` : ""}, beside me, away from my face`;
    case "headline": return `big word "${c.text}" in the upper frame${c.highlight ? ` ("${c.highlight}" in emerald)` : ""}`;
    case "title": return `closing title "${c.text}"${c.support ? `, call to action "${c.support}"` : ""}, small EdAI logo`;
  }
}

export type BriefInput = {
  concept: string;
  platform: string;
  audience: string;
  version: Look;
  style: Style;
  format: FormatKey;
  edit: ComposedEdit;
  /** File name of each take, by take id (as "Raw takes" downloads them). */
  takeFiles: Record<string, string>;
  /** Shot titles, with "(AI-made illustration)" or "(stock footage)" where that applies. */
  shotTitles: string[];
  /** Added pictures and clips, by id. */
  extras: Record<string, { name: string; note: string }>;
  music: string;
  brand: boolean;
  altHooks: string[];
  summary: string;
};

export function editBrief(b: BriefInput): string {
  const { width, height } = FORMATS[b.format];
  const out: string[] = [];
  const total = b.edit.sequence.reduce((t, s) => t + (s.to - s.from), 0);
  out.push(
    `# Edit brief: ${b.concept} (${b.version} version)`,
    "",
    `Edit my attached clips into a finished ${b.format} vertical video (${width} × ${height}, MP4, H.264/AAC, the source frame rate) of about ${Math.round(total)} seconds for ${b.platform}, for ${b.audience.toLowerCase()}. Follow the timeline below; times are in the finished video unless they say "of the file". Deliver the finished video, not a plan.`,
    "",
    "Ground rules: keep my voice, meaning and factual claims. Don't invent footage, dialogue, reactions, testimonials or results, and don't present illustrations as real outcomes. If your tool can't do something here, tell me before you start.",
    "",
    "## Style",
    ...LOOK_NOTES[b.version].map((l) => `- ${l}`),
    `- Fonts: Outfit for captions and small text, Libre Baskerville for headlines. EdAI palette: emerald #1FA67A, cream #F4EEE3, ink #0B0B0A.`,
    "",
    "## Files",
  );
  const seenTakes = new Set<string>();
  for (const s of b.edit.sequence) {
    for (const seg of [s, ...s.overlays.flatMap((o) => (o.kind === "segment" ? [o.from] : []))]) {
      if (seenTakes.has(seg.take.id)) continue;
      seenTakes.add(seg.take.id);
      out.push(`- ${b.takeFiles[seg.take.id] ?? seg.take.id} — shot ${seg.shot + 1}: ${b.shotTitles[seg.shot] ?? ""}`);
    }
  }
  // Added pictures and clips are numbered, since two can share a file name.
  const usedExtras = [...new Set(b.edit.sequence.flatMap((s) => s.overlays.flatMap((o) => (o.kind === "extra" ? [o.extraId] : []))))];
  const extraLabel = (id: string) => {
    const e = b.extras[id];
    return e ? `added item ${usedExtras.indexOf(id) + 1} (${e.name})` : "added item";
  };
  for (const id of usedExtras) {
    const e = b.extras[id];
    if (e) out.push(`- ${extraLabel(id)}${e.note ? ` — ${e.note}` : ""}`);
  }

  out.push("", "## Timeline");
  let t = 0;
  b.edit.sequence.forEach((s, i) => {
    const len = s.to - s.from;
    const said = s.words.filter((w) => w.end > s.from && w.start < s.to).map((w) => w.word).join(" ");
    out.push(
      `${i + 1}. ${clock(t)}–${clock(t + len)}  ${b.takeFiles[s.take.id] ?? s.take.id}, ${secs(s.from)}–${secs(s.to)} of the file${s.warm ? " — human payoff starts here: pale flash, warmer natural colour, smaller captions" : ""}`,
    );
    if (said) out.push(`   Says: "${said}"`);
    if (s.emphasis.size) out.push(`   Emphasise: ${[...s.emphasis].map((k) => `"${s.words[k]?.word}"`).join(", ")}`);
    const items = [
      ...s.overlays.map((o) => ({
        at: o.at,
        line: `${clock(t + o.at)}–${clock(t + o.at + o.seconds)}  ${o.style === "pip" ? "picture card over me" : o.style === "panel" ? "panel (stacked with any other panels at this time)" : "full-screen cutaway"}: ${
          o.kind === "extra" ? extraLabel(o.extraId) : `${b.takeFiles[o.from.take.id] ?? "clip"} from ${secs(o.from.from)}`
        } (my voice continues)`,
      })),
      ...s.callouts.map((c) => ({ at: c.at, line: `${clock(t + c.at)}–${clock(t + c.at + c.seconds)}  ${calloutLine(c)}` })),
    ].sort((x, y) => x.at - y.at);
    for (const it of items) out.push(`   - ${it.line}`);
    t += len;
  });

  out.push(
    "",
    "## Look and sound",
    `- Captions: ${b.style.captions === "Off" ? "none" : `${b.style.captions} style, size ${b.style.captionSize}, ${b.style.captionPosition.toLowerCase()} of the frame`}, synced to my actual speech (the SRT below is timed to the finished video).`,
    `- Transitions: ${b.style.transition}. Camera motion: ${b.style.energy}.`,
    `- Opening title: ${b.style.showTitle && b.style.title ? `"${b.style.title}"` : b.style.showTitle ? "the hook line" : "none"}.`,
    `- Colour: ${b.style.grade ? "correct exposure, contrast and white balance consistently" : "as recorded"}.`,
    `- Music: ${b.music === "No music" ? "none" : b.music === "My music" ? "my own track (attached)" : `a ${b.music.toLowerCase()} bed`}${b.music === "No music" ? "" : `, ducked well under my voice, fading in and out; level ${Math.round(b.style.musicVolume * 100)}% of the usual bed`}. My voice stays clear and dominant.`,
    `- Branding: ${b.brand ? (b.version === "Cinematic" ? "small official EdAI logo with the closing title; no end card" : "official EdAI wordmark top-left over the opening, and a 3-second end card with the white EdAI brandmark, the call to action and the tagline \"Raising Principled and Ambitious Teens as Builders and Founders\"") : "none"}.`,
    `- Call to action: "${b.edit.endCta}".`,
  );
  if (b.altHooks.length) out.push("", "## Other ways to open (for me to consider)", ...b.altHooks.map((h) => `- ${h}`));
  if (b.summary) out.push("", "## Notes from my editor", b.summary);
  out.push("", "## Before you deliver", "Watch the complete video and fix caption errors, awkward cuts, unreadable text and uneven audio. Keep captions and graphics inside the platform's safe margins. Export the SRT alongside the video.");
  const srt = toSrt(b.edit);
  if (srt) out.push("", "## Captions (SRT)", "```", srt.trim(), "```");
  return out.join("\n") + "\n";
}
