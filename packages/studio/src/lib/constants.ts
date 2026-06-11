import type { IconName } from "../components/icon/paths.js";

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type LayerKind = "sequence" | "audio" | "video" | "group" | "transition";

export type LayerKindMeta = { color: string; label: string; icon: IconName };

/** Color + icon per layer kind, consumed by the layered timeline. */
export const LAYER_KINDS: Record<LayerKind, LayerKindMeta> = {
  sequence: { color: "#7c5cff", label: "Sequence", icon: "layers" },
  audio: { color: "#ff5d8f", label: "Audio", icon: "media" },
  video: { color: "#56b8ff", label: "Video", icon: "film" },
  group: { color: "#ff8a3d", label: "Group", icon: "layout" },
  transition: { color: "#2bd9c4", label: "Transition", icon: "progress" },
};

export type SelectOption = { value: string; label: string; desc?: string };

export const RES_PRESETS: Array<SelectOption & { w?: number; h?: number }> = [
  { value: "720p", label: "720p · 1280×720", w: 1280, h: 720 },
  { value: "1080p", label: "1080p · 1920×1080", w: 1920, h: 1080 },
  { value: "1440p", label: "1440p · 2560×1440", w: 2560, h: 1440 },
  { value: "2160p", label: "4K · 3840×2160", w: 3840, h: 2160 },
  { value: "square", label: "Square · 1080×1080", w: 1080, h: 1080 },
  { value: "vert", label: "Vertical · 1080×1920", w: 1080, h: 1920 },
  { value: "custom", label: "Custom size" },
];

export const QUALITY: Array<SelectOption & { f: number }> = [
  { value: "draft", label: "Draft", desc: "Fast preview · low bitrate", f: 0.07 },
  { value: "standard", label: "Standard", desc: "Balanced · web-ready", f: 0.16 },
  { value: "high", label: "High", desc: "Crisp · high bitrate", f: 0.34 },
  { value: "lossless", label: "Lossless", desc: "Master · largest file", f: 1.3 },
];

export const FORMATS: Array<SelectOption & { mul: number }> = [
  { value: "mp4", label: "MP4 · H.264", mul: 1 },
  { value: "webm", label: "WebM · VP9", mul: 0.82 },
  { value: "mov", label: "MOV · ProRes", mul: 3.4 },
  { value: "gif", label: "Animated GIF", mul: 1.7 },
  { value: "png", label: "PNG sequence", mul: 5.5 },
];

export const estMB = (w: number, h: number, frames: number, qf: number, mul: number): number =>
  (w * h * frames * qf * mul) / 90000;

export const prettyMB = (mb: number): string =>
  mb >= 1024
    ? `${(mb / 1024).toFixed(2)} GB`
    : mb >= 10
      ? `${Math.round(mb)} MB`
      : `${mb.toFixed(1)} MB`;
