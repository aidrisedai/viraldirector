import type { ReactNode } from "react";

const TONES = {
  accent: ["var(--emerald-50)", "var(--emerald-700)"],
  neutral: ["var(--cream-200)", "var(--ink-600)"],
  warning: ["var(--status-warning-bg)", "var(--status-warning-fg)"],
} as const;

type BadgeProps = { tone?: keyof typeof TONES; dot?: boolean; children: ReactNode };

export function Badge({ tone = "accent", dot, children }: BadgeProps) {
  const [background, color] = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        height: 24,
        padding: "0 10px",
        borderRadius: "var(--radius-pill)",
        background,
        color,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: ".02em",
        whiteSpace: "nowrap",
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: "currentColor" }} />}
      {children}
    </span>
  );
}
