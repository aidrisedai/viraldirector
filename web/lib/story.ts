import { z } from "zod";
import { AUDIENCES, CONCEPT_MAX, FORMATS, GOALS, LENGTHS, PLATFORMS, STORY_MAX } from "./plan";

// Story mode: the creator explains the whole scenario, a writer turns it into a story, and the
// approved story goes to the Director instead of a one-sentence idea.

export const WRITERS = [
  { id: "screenwriter", name: "Screenwriter", blurb: "Scenes, tension and a turn. Your story told like a short film." },
  { id: "copywriter", name: "Copywriter", blurb: "Punchy lines that make people care, ending on one clear action." },
  { id: "journalist", name: "Journalist", blurb: "The real facts in the right order, told plainly so people trust it." },
  { id: "comedy", name: "Comedy writer", blurb: "Same message, with setups, punchlines and timing." },
] as const;
export type WriterId = (typeof WRITERS)[number]["id"];
const WRITER_IDS = WRITERS.map((w) => w.id) as [WriterId, ...WriterId[]];
export const writerName = (id: WriterId) => WRITERS.find((w) => w.id === id)!.name;

export const SCENARIO_MIN = 20;
export const SCENARIO_MAX = 4000;
export const SCRIPT_MAX = STORY_MAX;
export const ANSWER_MAX = 600;
export const QUESTIONS_MAX = 3;
export const NOTE_MAX = 600;

export const StorySchema = z.object({
  title: z.string().trim().min(1).max(80),
  /** One sentence; becomes the brief's concept. */
  logline: z.string().trim().min(3).max(CONCEPT_MAX),
  /** What the creator says, in order, with short [visual notes] in square brackets. */
  script: z.string().trim().min(1).max(SCRIPT_MAX),
  /** The writer's note to the creator about the choices made. */
  note: z.string().max(NOTE_MAX),
});
export type Story = z.infer<typeof StorySchema>;

const AnswerSchema = z.object({
  question: z.string().max(300),
  answer: z.string().trim().max(ANSWER_MAX),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const WriterRequestSchema = z.object({
  action: z.enum(["questions", "draft", "revise"]),
  writer: z.enum(WRITER_IDS),
  scenario: z.string().trim().min(SCENARIO_MIN, "Tell the writer a bit more about what happened.").max(SCENARIO_MAX),
  settings: z.object({
    goal: z.enum(GOALS),
    length: z.enum(LENGTHS),
    platform: z.enum(PLATFORMS),
    audience: z.enum(AUDIENCES),
    format: z.enum(FORMATS),
  }),
  answers: z.array(AnswerSchema).max(QUESTIONS_MAX),
  /** For "revise": the current draft (as the creator edited it) and what to change. */
  draft: StorySchema.nullable(),
  note: z.string().trim().max(NOTE_MAX),
});
export type WriterRequest = z.infer<typeof WriterRequestSchema>;

export type WriterResponse = { questions: string[] } | { story: Story } | { error: string };

/** Spoken words only: [visual notes] are filmed, not said. */
export function spokenWords(script: string): number {
  return script.replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** People speak about 2.6 words per second on short-form video. */
export const spokenSeconds = (script: string) => Math.round(spokenWords(script) / 2.6);
