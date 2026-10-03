import {
  ArrowRight, Check, ChevronRight, Download, Mic, Pencil, Play, RotateCcw, ScanFace,
  Sparkles, Sun, Upload, Video, X, Zap, type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

// The EdAI DS Icon wraps Lucide; this registers the subset ViralDirector uses.
const ICONS = {
  "arrow-right": ArrowRight,
  check: Check,
  "chevron-right": ChevronRight,
  download: Download,
  mic: Mic,
  pencil: Pencil,
  play: Play,
  "rotate-ccw": RotateCcw,
  "scan-face": ScanFace,
  sparkles: Sparkles,
  sun: Sun,
  upload: Upload,
  video: Video,
  x: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

type IconProps = { name: IconName; size?: number; color?: string; style?: CSSProperties };

export function Icon({ name, size = 18, color = "currentColor", style }: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph aria-hidden size={size} color={color} strokeWidth={2} style={{ flex: "none", ...style }} />;
}
