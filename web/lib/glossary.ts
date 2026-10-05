// Plain-language definitions for the filmmaking words the Director uses.
// These answer instantly in the app, with no API call.

export type GlossaryEntry = { term: string; aliases?: string[]; short: string; tip?: string };

export const GLOSSARY: GlossaryEntry[] = [
  { term: "Hook", short: "The first 1–3 seconds. Its only job is to stop someone scrolling.", tip: "Say the boldest line first and start moving — never open with “Hi guys”." },
  { term: "Beat", aliases: ["beat sheet"], short: "One small section of the video with a single job: hook, setup, value, payoff, loop.", tip: "A new beat every 3–5 seconds keeps people watching." },
  { term: "Setup", short: "The beat right after the hook that explains the problem or tension.", tip: "Keep it to one or two sentences." },
  { term: "Value", aliases: ["value beat"], short: "The useful part — the tip, insight or story the viewer stayed for." },
  { term: "Payoff", short: "Where you deliver what the hook promised.", tip: "Be specific: a number, a name, a real example." },
  { term: "Loop", short: "An ending that flows back into the first line, so the video feels like it restarts.", tip: "Loops boost rewatches, which platforms reward." },
  { term: "CTA", aliases: ["call to action"], short: "One clear thing you ask the viewer to do: follow, comment a word, tap the link." },
  { term: "Pattern interrupt", short: "A sudden change — new angle, sound, or expression — that resets attention.", tip: "A one-second reaction shot is the easiest one to film." },
  { term: "A-roll", aliases: ["talking head"], short: "You talking to the camera. It carries the script." },
  { term: "B-roll", short: "Footage without you talking that shows what you’re saying — hands, objects, places.", tip: "It plays over your voice, so it can be silent." },
  { term: "Insert", aliases: ["prop"], short: "A close-up of one object, often held up to the lens.", tip: "Hold it steady for a full second so the edit has room." },
  { term: "Reaction", aliases: ["reset"], short: "A short silent shot of your face reacting, usually from a different angle." },
  { term: "Hook shot", short: "The first shot, built to grab attention — often you moving into frame as you speak." },
  { term: "Screen recording", short: "A capture of your phone or computer screen, used as proof or a demo." },
  { term: "Chest-up", aliases: ["medium close-up"], short: "Framing from the middle of your chest to just above your head.", tip: "Leave a little space above your head, but not much." },
  { term: "Close-up", short: "Framing tight on one thing — your face, hands, or an object." },
  { term: "New angle", aliases: ["side angle"], short: "Move the camera (or turn yourself) so the shot looks clearly different from the last one.", tip: "Turning about 45° is enough." },
  { term: "Eye line", short: "Where your eyes sit in the frame — about a third of the way down.", tip: "Look into the lens, not at your own face on screen." },
  { term: "Rule of thirds", aliases: ["thirds grid", "grid"], short: "Imaginary lines splitting the frame into a 3×3 grid; important things sit on the lines." },
  { term: "Caption safe zone", aliases: ["safe zone"], short: "The area where captions won’t be covered by the app’s buttons and username.", tip: "Keep your face and key objects out of the bottom fifth of the frame." },
  { term: "Framing", short: "What’s inside the shot and how big you are in it." },
  { term: "Lighting", short: "Where the light comes from.", tip: "Face a window. Light behind you turns you into a silhouette." },
  { term: "Delivery", short: "How you say the line: energy, pace and emotion." },
  { term: "Energy", aliases: ["energy level"], short: "How big your delivery is, from 1 (calm) to 5 (very animated).", tip: "On camera, aim one step higher than feels natural." },
  { term: "Take", short: "One recording attempt of a shot. You can record as many as you like and keep the best." },
  { term: "Retake", short: "Recording the same shot again to fix something." },
  { term: "Clipping", short: "Audio so loud it distorts and crackles.", tip: "Move the mic back or speak a little softer." },
  { term: "9:16", aliases: ["vertical", "aspect ratio"], short: "Tall, phone-shaped video used by Reels, TikTok and Shorts." },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9:]+/g, " ").trim();

const INDEX = new Map<string, GlossaryEntry>();
for (const e of GLOSSARY) for (const k of [e.term, ...(e.aliases ?? [])]) INDEX.set(norm(k), e);

/** Finds a glossary entry for a word or phrase such as "A-roll", "b roll", "chest up". */
export function lookup(word: string): GlossaryEntry | undefined {
  const k = norm(word);
  return INDEX.get(k) ?? INDEX.get(k.replace(/s$/, ""));
}

/** Glossary terms that appear in a piece of text, longest first, without duplicates. */
export function termsIn(text: string): GlossaryEntry[] {
  const t = ` ${norm(text)} `;
  const found = new Set<GlossaryEntry>();
  for (const [k, e] of [...INDEX].sort((a, b) => b[0].length - a[0].length)) {
    if (t.includes(` ${k} `)) found.add(e);
  }
  return [...found];
}

export const glossaryAnswer = (e: GlossaryEntry) => (e.tip ? `${e.short} ${e.tip}` : e.short);

// "What is B-roll?", "what does chest-up mean", "define eye line", "What does “A-roll” mean?"
const DEFINE = /^(?:what(?:'s|’s| is| are| does)|define|meaning of)\s+(?:an?\s+|the\s+)?["'“‘]?(.+?)["'”’]?(?:\s+mean)?\s*\??$/i;

/** If the question just asks what a known word means, returns its entry. */
export function definitionQuestion(q: string): GlossaryEntry | undefined {
  const m = DEFINE.exec(q.trim());
  return m ? lookup(m[1]) : undefined;
}
