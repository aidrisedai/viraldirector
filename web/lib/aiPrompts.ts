import type { Brief, Look, Shot } from "./plan";

// Prompts for text-to-video tools, for illustrative shots the creator can't film. Real people, students,
// reactions and results are never generated: those have to be real footage.

/** Shot types that can be illustrative: silent pictures laid over (or between) the creator's voice. */
// (Screen recordings are excluded: they show the creator's real product.)
const ILLUSTRATIVE_TYPES = new Set<Shot["type"]>(["b-roll", "insert"]);

/** Words that mean the shot shows real people or real outcomes — film those for real. */
const PEOPLE =
  /\b(student|students|kid|kids|teen|teens|friend|friends|parent|parents|mum|mom|dad|team|people|person|crowd|class|audience|customer|customers|user|users|face|faces|reaction|react|smile|smiling|laugh|laughing|testimonial|interview|selfie|portrait|profile|winning|winner|award|certificate|graduat\w*|result|results|sale|sales|sold|revenue|earnings|order|orders|payment|payout|sign-?ups?|followers?|subscribers?|views|likes|metrics|analytics|dashboard|screenshot)\b/i;

export type AiEligibility = { ok: true } | { ok: false; reason: string };

/** Whether an AI-made clip would be honest for this shot. */
export function aiEligibility(shot: Shot): AiEligibility {
  if (!ILLUSTRATIVE_TYPES.has(shot.type)) return { ok: false, reason: "This shot is you on camera, so it has to be filmed for real." };
  const text = `${shot.title} ${shot.framing} ${shot.delivery}`;
  if (PEOPLE.test(text)) return { ok: false, reason: "This shot shows real people or a real result, so film it for real — an AI version would be made up." };
  return { ok: true };
}

const LOOK_STYLE: Record<Look, string> = {
  Standard: "bright, crisp, modern colour; natural daylight; energetic but steady camera",
  Editorial: "soft natural light, warm neutral tones, calm composition with generous space; slow, steady camera",
  Cinematic: "dark cinematic grade with controlled highlights and deep shadows, shallow depth of field, a slow push-in; moody and premium",
};

/** One shot as a prompt for a text-to-video tool. */
export function videoPrompt(shot: Shot, brief: Pick<Brief, "concept" | "audience" | "look">): string {
  const seconds = Math.max(2, Math.min(10, shot.seconds));
  return [
    `Vertical 9:16 video, ${seconds} seconds, one continuous shot with no cuts.`,
    `Subject: ${shot.title}.`,
    `Shot: ${shot.size}. ${shot.framing}`,
    `Light: ${shot.lighting}`,
    `Setting: ${shot.location}.`,
    `Look: ${LOOK_STYLE[brief.look]}. Photorealistic.`,
    `It's a cutaway in a short video about "${brief.concept}" for ${brief.audience.toLowerCase()}, so it should illustrate the idea, not tell a story of its own.`,
    "Rules: no people's faces and no recognisable people — if hands appear, show them from the wrist down only. No text, captions, logos, brand names, screens with readable words or watermarks. Nothing that looks like a real student, customer, reaction, testimonial or result. No sound needed.",
  ].join("\n");
}

/** The phrase to use when posting a video that contains AI-made clips. */
export const AI_LABEL_NOTE =
  "This video has AI-made clips. Turn on the platform’s AI-generated content label when you post (TikTok, Instagram and YouTube all have one).";
