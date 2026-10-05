import { z } from "zod";
import { BriefSchema, PlanSchema } from "./plan";

// Limits keep requests cheap and bounded; the route enforces them.
export const QUESTION_MAX = 600;
export const HISTORY_MAX = 12;
export const FRAMES_MAX = 4;
const FRAME_B64_MAX = 400_000; // ~300 KB JPEG
export const REQUEST_BYTES_MAX = 2_500_000;

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

const TakeInfoSchema = z.object({
  takeNumber: z.number().int().min(1).max(999),
  source: z.enum(["camera", "upload"]),
  seconds: z.number().min(0).max(600),
  peak: z.number().min(0).max(2).nullable(),
  clipped: z.number().min(0).max(1).nullable(),
  voiced: z.number().min(0).max(1).nullable(),
  transcript: z.string().max(2000).nullable(),
  /** JPEG frames, base64 without the data: prefix, center-cropped to 9:16. */
  frames: z.array(z.string().max(FRAME_B64_MAX).regex(/^[A-Za-z0-9+/=]+$/)).max(FRAMES_MAX),
});
export type TakeInfo = z.infer<typeof TakeInfoSchema>;

export const ChatRequestSchema = z.object({
  mode: z.enum(["ask", "line", "take"]),
  /** The new user message (a question, or the request text for line/take feedback). */
  message: z.string().trim().min(1).max(QUESTION_MAX),
  history: z.array(ChatMessageSchema).max(HISTORY_MAX),
  context: z.object({
    brief: BriefSchema,
    plan: PlanSchema,
    hook: z.number().int().min(0).max(2),
    step: z.enum(["Concept", "Plan", "Shots", "Record", "Review", "Export"]),
    shot: z.number().int().min(0).max(11).nullable(),
    /** For line feedback: the Director's original line before the creator edited it. */
    originalLine: z.string().max(400).nullable(),
  }),
  take: TakeInfoSchema.nullable(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type DirectorReply = {
  reply: string;
  /** A rewritten line the creator can apply (line feedback only); empty when none. */
  suggestedLine: string;
  /** Take feedback only. */
  verdict: "keep" | "retake" | "none";
};

export type ChatResponse = DirectorReply | { error: string };
