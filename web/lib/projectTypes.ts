import { z } from "zod";
import { AUDIENCES, FORMATS, GOALS, LENGTHS, PLATFORMS } from "./plan";

// Projects: a goal worked toward over many videos ("one video a day for 90 days"), with a backlog of
// ideas and a history of what's been made. Shared by the API routes and the pages.

export const NAME_MAX = 80;
export const GOAL_MAX = 600;
export const IDEA_TITLE_MAX = 90;
export const IDEA_CONCEPT_MAX = 280;

export const ProjectDefaultsSchema = z.object({
  goal: z.enum(GOALS),
  length: z.enum(LENGTHS),
  platform: z.enum(PLATFORMS),
  audience: z.enum(AUDIENCES),
  format: z.enum(FORMATS),
});
export type ProjectDefaults = z.infer<typeof ProjectDefaultsSchema>;

export const ProjectInputSchema = z.object({
  name: z.string().trim().min(1, "Give your project a name.").max(NAME_MAX),
  goal: z.string().trim().max(GOAL_MAX),
  /** Videos per week: 7 is daily, 14 twice a day. */
  perWeek: z.number().int().min(1).max(21),
  /** How long the project runs; null for open-ended. */
  durationDays: z.number().int().min(1).max(730).nullable(),
  /** YYYY-MM-DD in the creator's time zone. */
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  defaults: ProjectDefaultsSchema,
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export const ProjectPatchSchema = ProjectInputSchema.partial().extend({ archived: z.boolean().optional() });

export type Project = ProjectInput & { id: string; archived: boolean; createdAt: string };

export const IDEA_STATUSES = ["open", "used", "skipped"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IdeaInputSchema = z.object({
  title: z.string().trim().min(1).max(IDEA_TITLE_MAX),
  concept: z.string().trim().min(3).max(IDEA_CONCEPT_MAX),
  angle: z.string().trim().max(300).default(""),
});
export const IdeaPatchSchema = IdeaInputSchema.partial().extend({
  status: z.enum(IDEA_STATUSES).optional(),
  position: z.number().optional(),
});
export type Idea = z.infer<typeof IdeaInputSchema> & { id: string; projectId: string; status: IdeaStatus; position: number; createdAt: string };

export const VIDEO_STATUSES = ["draft", "made", "posted"] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

/** A JPEG data URL, small enough to keep in the database. */
const Thumb = z.string().max(160_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/);

export const VideoInputSchema = z.object({
  projectId: z.string().max(40).nullable(),
  ideaId: z.string().max(40).nullable(),
  title: z.string().trim().min(1).max(IDEA_TITLE_MAX),
  concept: z.string().trim().max(IDEA_CONCEPT_MAX),
  /** The brief and plan, so a draft can be picked up later (on any device). */
  brief: z.unknown().nullable(),
  plan: z.unknown().nullable(),
});
export const VideoPatchSchema = z.object({
  title: z.string().trim().min(1).max(IDEA_TITLE_MAX).optional(),
  hook: z.string().max(300).optional(),
  caption: z.string().max(2200).optional(),
  seconds: z.number().min(0).max(600).optional(),
  format: z.string().max(10).optional(),
  thumb: Thumb.optional(),
  status: z.enum(VIDEO_STATUSES).optional(),
  postedUrl: z.string().trim().max(500).refine((u) => !u || /^https?:\/\//.test(u), "Use a full link starting with https://").optional(),
  brief: z.unknown().optional(),
  plan: z.unknown().optional(),
});
export type VideoPatch = z.infer<typeof VideoPatchSchema>;

export type Video = {
  id: string;
  projectId: string | null;
  ideaId: string | null;
  title: string;
  concept: string;
  hook: string;
  caption: string;
  seconds: number | null;
  format: string | null;
  thumb: string | null;
  status: VideoStatus;
  madeAt: string | null;
  postedAt: string | null;
  postedUrl: string | null;
  createdAt: string;
  brief?: unknown;
  plan?: unknown;
};

export type ProjectSummary = Project & { made: number; posted: number; lastMadeAt: string | null; openIdeas: number; latestThumb: string | null };
export type ProjectDetail = { project: Project; ideas: Idea[]; videos: Video[] };

/** Common shapes for the "new project" form. */
export const CADENCES = [
  { label: "Every day", perWeek: 7 },
  { label: "5 a week", perWeek: 5 },
  { label: "3 a week", perWeek: 3 },
  { label: "Once a week", perWeek: 1 },
  { label: "Twice a day", perWeek: 14 },
] as const;
export const DURATIONS = [
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
  { label: "6 months", days: 182 },
  { label: "No end date", days: null },
] as const;
