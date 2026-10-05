import {
  ArrowRight, Check, ChevronRight, Download, ImagePlus, MessageCircle, Mic, Pause, Pencil, Play, Plus, Redo2, RotateCcw,
  ScanFace, Share2, Sparkles, Sun, Trash2, Type, Undo2, Upload, Video, Volume2, X, Zap, type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

// The EdAI DS Icon wraps Lucide; this registers the subset ViralDirector uses.
const ICONS = {
  "arrow-right": ArrowRight,
  check: Check,
  "chevron-right": ChevronRight,
  download: Download,
  "image-plus": ImagePlus,
  message: MessageCircle,
  mic: Mic,
  pause: Pause,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  redo: Redo2,
  "rotate-ccw": RotateCcw,
  "scan-face": ScanFace,
  share: Share2,
  sparkles: Sparkles,
  sun: Sun,
  trash: Trash2,
  type: Type,
  undo: Undo2,
  upload: Upload,
  video: Video,
  volume: Volume2,
  x: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

type IconProps = { name: IconName; size?: number; color?: string; style?: CSSProperties };

export function Icon({ name, size = 18, color = "currentColor", style }: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph aria-hidden size={size} color={color} strokeWidth={2} style={{ flex: "none", ...style }} />;
}
