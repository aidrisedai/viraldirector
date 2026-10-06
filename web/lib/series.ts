import type { Project, Video } from "./projectTypes";

/** What the Director needs to know about the series when planning one of its videos. */
export function seriesContext(project: Project, videos: Video[], ideaTitle: string): string {
  const made = videos.filter((v) => v.status !== "draft");
  const recent = made.slice(0, 8).map((v) => `- ${v.title}: ${v.concept}${v.hook ? ` (hook: ${v.hook})` : ""}`);
  return [
    `This video is part of the project "${project.name}" — goal: ${project.goal || "(not given)"}.`,
    `It is video ${made.length + 1}${project.durationDays ? ` of about ${Math.round((project.durationDays / 7) * project.perWeek)}` : ""}${ideaTitle ? `, "${ideaTitle}"` : ""}.`,
    recent.length ? `Recent videos in the series (don't repeat their hooks or points; build on them where it helps):\n${recent.join("\n")}` : "It's the first video of the series: set it up.",
  ].join("\n").slice(0, 1500);
}
