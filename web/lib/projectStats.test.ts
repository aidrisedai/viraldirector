import { describe, expect, it } from "vitest";
import { addDays, daysBetween, projectStats, statusLine } from "./projectStats";

// Noon local time, so "today" is unambiguous whatever the test machine's time zone.
const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`);
const made = (day: string) => ({ status: "made" as const, madeAt: at(day).toISOString() });

describe("dates", () => {
  it("counts and adds whole days across months", () => {
    expect(daysBetween("2026-01-30", "2026-02-02")).toBe(3);
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });
});

describe("projectStats", () => {
  const daily90 = { perWeek: 7, durationDays: 90, startDate: "2026-03-01" };

  it("sets the target and what's expected by today", () => {
    const s = projectStats(daily90, [], at("2026-03-05"));
    expect(s.target).toBe(90);
    expect(s.dayNumber).toBe(5);
    expect(s.expectedByNow).toBe(5);
    expect(s.ahead).toBe(-5);
    expect(s.daysLeft).toBe(85);
  });

  it("counts a streak that's still alive until today ends", () => {
    const videos = [made("2026-03-02"), made("2026-03-03"), made("2026-03-04")];
    expect(projectStats(daily90, videos, at("2026-03-05")).streak).toBe(3); // today not done yet
    expect(projectStats(daily90, [...videos, made("2026-03-05")], at("2026-03-05")).streak).toBe(4);
    expect(projectStats(daily90, videos, at("2026-03-06")).streak).toBe(0); // missed yesterday
  });

  it("ignores drafts, counts posted, and finishes at the target", () => {
    const videos = [made("2026-03-01"), { status: "posted" as const, madeAt: at("2026-03-02").toISOString() }, { status: "draft" as const, madeAt: null }];
    const s = projectStats({ perWeek: 3, durationDays: 7, startDate: "2026-03-01" }, videos, at("2026-03-04"));
    expect(s.target).toBe(3);
    expect(s.made).toBe(2);
    expect(s.posted).toBe(1);
    expect(projectStats({ perWeek: 3, durationDays: 7, startDate: "2026-03-01" }, [...videos, made("2026-03-03")], at("2026-03-04")).finished).toBe(true);
  });

  it("handles open-ended and not-yet-started projects", () => {
    expect(projectStats({ perWeek: 1, durationDays: null, startDate: "2026-03-01" }, [], at("2026-03-15")).target).toBeNull();
    const before = projectStats(daily90, [], at("2026-02-20"));
    expect(before.dayNumber).toBe(0);
    expect(statusLine(before, 7)).toBe("Starts soon");
  });

  it("says how it's going in plain words", () => {
    expect(statusLine(projectStats(daily90, [made("2026-03-01")], at("2026-03-01")), 7)).toBe("On track");
    expect(statusLine(projectStats(daily90, [], at("2026-03-03")), 7)).toBe("Today’s video is waiting");
    expect(statusLine(projectStats({ ...daily90, perWeek: 3 }, [], at("2026-03-15")), 3)).toMatch(/behind/);
  });
});
