// Illustrations for the Editorial look's graphic cards and stickers: simple shapes in a 100 × 100 box,
// drawn by the renderer as black vintage engravings (ink outlines, hatched shading). `body` shapes are
// filled with hatching and outlined (even-odd, so a second loop cuts a hole); `lines` are detail strokes.

export type Art = { label: string; body: string[]; lines: string[] };

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

/** A cog: `teeth` square teeth around a ring, with a hole in the middle. */
function gear(cx: number, cy: number, r: number, teeth: number): string {
  const pts: string[] = [];
  const outer = r, inner = r * 0.78;
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const rad = i % 4 === 1 || i % 4 === 2 ? outer : inner;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z ${circle(cx, cy, r * 0.3)}`;
}

export const ART = {
  "money-bag": {
    label: "Money bag",
    body: [
      "M30 42 C16 54 14 72 22 83 C30 93 70 93 78 83 C86 72 84 54 70 42 Z",
      "M37 42 L63 42 L61 35 L39 35 Z",
      "M39 35 L31 18 L44 24 L50 13 L56 24 L69 18 L61 35 Z",
    ],
    lines: ["M57 57 C53 53 44 54 44 60 C44 66 57 65 57 71 C57 77 47 78 43 74", "M50 50 L50 81"],
  },
  magnifier: {
    label: "Magnifying glass",
    body: [`${circle(42, 42, 29)} ${circle(42, 42, 21)}`, "M61 63 L67 57 L91 81 C93 83 93 87 91 89 C89 91 85 91 83 89 L59 65 Z"],
    lines: ["M29 36 C31 30 36 26 42 25", "M28 44 L28 47"],
  },
  "pointing-hand": {
    label: "Pointing hand",
    body: [
      "M22 44 L84 44 C91 44 91 53 84 53 L58 53 C64 53 64 61 58 61 C63 61 63 68 57 68 C61 68 61 75 55 75 L34 75 C26 75 22 69 22 61 Z",
      "M7 40 L22 40 L22 79 L7 79 Z",
    ],
    lines: ["M58 53 L42 53", "M58 61 L44 61", "M57 68 L45 68", "M33 44 C33 37 43 35 48 44", "M7 47 L22 47"],
  },
  "chess-knight": {
    label: "Chess knight",
    body: [
      "M32 80 C30 64 38 56 44 46 C39 43 33 44 30 48 L22 44 C22 31 30 20 40 16 L44 8 L49 15 C65 17 75 31 70 46 C66 58 63 68 66 80 Z",
      "M24 80 L76 80 L78 90 L22 90 Z",
    ],
    lines: ["M44 27 L49 27", "M57 19 C63 29 63 41 59 51", "M28 85 L72 85"],
  },
  lightbulb: {
    label: "Light bulb",
    body: ["M50 12 C32 12 22 26 24 40 C26 53 37 59 39 69 L61 69 C63 59 74 53 76 40 C78 26 68 12 50 12 Z", "M39 71 L61 71 L59 86 L41 86 Z"],
    lines: ["M42 56 L46 42 L50 52 L54 42 L58 56", "M40 76 L60 76", "M41 81 L59 81", "M14 20 L8 15", "M86 20 L92 15", "M12 42 L5 42", "M88 42 L95 42"],
  },
  rocket: {
    label: "Rocket",
    body: ["M50 6 C64 18 68 40 64 66 L36 66 C32 40 36 18 50 6 Z", "M36 48 L22 70 L37 66 Z", "M64 48 L78 70 L63 66 Z"],
    lines: [circle(50, 33, 7), "M42 70 C42 80 50 93 50 93 C50 93 58 80 58 70", "M38 22 L62 22"],
  },
  target: {
    label: "Target",
    body: [`${circle(46, 54, 36)} ${circle(46, 54, 25)}`, circle(46, 54, 13)],
    lines: ["M46 54 L86 14", "M76 13 L87 13 L87 24", "M80 20 L91 9"],
  },
  book: {
    label: "Open book",
    body: ["M50 26 C40 19 24 19 9 23 L9 80 C24 76 40 76 50 83 Z", "M50 26 C60 19 76 19 91 23 L91 80 C76 76 60 76 50 83 Z"],
    lines: ["M17 34 C26 32 35 32 43 35", "M17 44 C26 42 35 42 43 45", "M17 54 C26 52 35 52 43 55", "M57 35 C65 32 74 32 83 34", "M57 45 C65 42 74 42 83 44", "M57 55 C65 52 74 52 83 54"],
  },
  "pocket-watch": {
    label: "Pocket watch",
    body: [`${circle(50, 56, 35)} ${circle(50, 56, 28)}`, "M44 13 L56 13 L56 21 L44 21 Z"],
    lines: [circle(50, 9, 4), "M50 56 L50 36", "M50 56 L63 64", "M50 30 L50 33", "M76 56 L73 56", "M50 82 L50 79", "M24 56 L27 56"],
  },
  "chart-up": {
    label: "Rising chart",
    body: ["M14 82 L28 82 L28 62 L14 62 Z", "M36 82 L50 82 L50 48 L36 48 Z", "M58 82 L72 82 L72 34 L58 34 Z"],
    lines: ["M8 88 L92 88", "M10 50 L36 30 L54 38 L86 12", "M75 12 L86 12 L86 23"],
  },
  key: {
    label: "Key",
    body: [`${circle(27, 50, 18)} ${circle(27, 50, 7)}`, "M44 45 L90 45 L90 55 L44 55 Z", "M70 55 L70 66 L77 66 L77 55 Z", "M81 55 L81 62 L88 62 L88 55 Z"],
    lines: ["M52 50 L84 50"],
  },
  compass: {
    label: "Compass",
    body: [`${circle(50, 50, 38)} ${circle(50, 50, 31)}`, "M50 22 L58 50 L50 78 L42 50 Z"],
    lines: ["M50 13 L50 19", "M50 81 L50 87", "M13 50 L19 50", "M81 50 L87 50", "M42 50 L58 50"],
  },
  summit: {
    label: "Mountain with a flag",
    body: ["M5 88 L40 30 L56 54 L66 42 L95 88 Z"],
    lines: ["M40 30 L40 7", "M40 7 L58 12 L40 18", "M31 45 L40 30 L49 43 L44 41 L40 47 L36 42 Z", "M60 50 L66 42 L72 52"],
  },
  gears: {
    label: "Gears",
    body: [gear(38, 58, 26, 9), gear(72, 30, 17, 7)],
    lines: [],
  },
  people: {
    label: "People",
    body: [circle(36, 34, 11), "M14 86 C14 64 24 54 36 54 C48 54 58 64 58 86 Z", circle(68, 40, 9), "M58 86 C58 70 62 60 68 58 C78 58 86 66 86 86 Z"],
    lines: [],
  },
  speech: {
    label: "Speech bubble",
    body: ["M12 18 L88 18 L88 64 L45 64 L28 82 L31 64 L12 64 Z"],
    lines: ["M24 32 L76 32", "M24 42 L76 42", "M24 52 L58 52"],
  },
  laptop: {
    label: "Laptop",
    body: ["M20 20 L80 20 L80 64 L20 64 Z M26 26 L74 26 L74 58 L26 58 Z", "M9 68 L91 68 L85 79 L15 79 Z"],
    lines: ["M34 36 L48 36", "M34 43 L62 43", "M34 50 L54 50", "M42 73 L58 73"],
  },
  trophy: {
    label: "Trophy",
    body: ["M30 12 L70 12 L68 38 C66 52 58 58 50 58 C42 58 34 52 32 38 Z", "M46 58 L54 58 L56 73 L44 73 Z", "M33 73 L67 73 L67 84 L33 84 Z"],
    lines: ["M30 18 C17 18 17 39 33 41", "M70 18 C83 18 83 39 67 41", "M44 24 L50 20 L50 44"],
  },
  seedling: {
    label: "Seedling",
    body: ["M30 64 L70 64 L64 92 L36 92 Z", "M50 58 C50 42 40 32 21 32 C21 49 33 57 50 58 Z", "M50 48 C50 32 62 22 81 24 C81 41 68 48 50 48 Z"],
    lines: ["M50 64 L50 38", "M30 70 L70 70"],
  },
  hammer: {
    label: "Hammer",
    body: ["M18 16 L64 16 L64 34 L18 34 C14 30 14 20 18 16 Z", "M37 34 L46 34 L50 92 L41 92 Z"],
    lines: ["M64 20 C72 18 78 22 82 28", "M64 30 C70 30 74 34 76 40"],
  },
  shield: {
    label: "Shield",
    body: ["M50 7 L85 19 C85 52 73 76 50 93 C27 76 15 52 15 19 Z"],
    lines: ["M33 50 L46 63 L68 38", "M50 15 L50 22"],
  },
  heart: {
    label: "Heart",
    body: ["M50 86 C24 66 10 52 10 34 C10 20 21 12 32 12 C40 12 46 17 50 24 C54 17 60 12 68 12 C79 12 90 20 90 34 C90 52 76 66 50 86 Z"],
    lines: ["M26 30 C28 24 32 22 36 22"],
  },
  calendar: {
    label: "Calendar",
    body: ["M14 20 L86 20 L86 88 L14 88 Z", "M14 20 L86 20 L86 36 L14 36 Z"],
    lines: ["M30 12 L30 26", "M70 12 L70 26", "M26 50 L34 50", "M46 50 L54 50", "M66 50 L74 50", "M26 64 L34 64", "M46 64 L54 64", "M66 64 L74 64", "M26 78 L34 78"],
  },
  hourglass: {
    label: "Hourglass",
    body: ["M24 10 L76 10 L76 16 L24 16 Z", "M24 84 L76 84 L76 90 L24 90 Z", "M30 16 L70 16 C70 34 56 42 54 50 C56 58 70 66 70 84 L30 84 C30 66 44 58 46 50 C44 42 30 34 30 16 Z"],
    lines: ["M40 30 L60 30 C58 38 52 42 50 46 C48 42 42 38 40 30 Z", "M50 54 L50 70", "M38 80 C42 72 58 72 62 80"],
  },
} satisfies Record<string, Art>;

export type ArtId = keyof typeof ART;
export const ART_IDS = Object.keys(ART) as ArtId[];
export const isArt = (id: string): id is ArtId => Object.hasOwn(ART, id);
