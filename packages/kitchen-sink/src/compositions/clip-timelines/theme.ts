// Design tokens — the only fixed numbers in the diagram, like CSS variables.
// Every component reads from here; nothing hardcodes a color or a spacing.

export const T = {
  ink: "#0d1117",
  track: "#1c2333",
  muted: "#8b949e",
  /** For derived/secondary captions — quieter than `muted`, still legible. */
  dim: "#586274",
  text: "#e6edf3",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",

  /** The left column every row shares, so labels and tracks line up. */
  labelW: 230,
  /** Height of a lane's window box. */
  laneH: 46,
  /** Indent added per nesting level, like a nested list. */
  indentStep: 26,

  pagePad: [36, 48] as [number, number],
  pageGap: 16,
  laneGap: 14,
  radius: 8,
} as const;

/** Lane colors, handed out by traversal order — authors never pick one. */
export const PALETTE = [
  "#FF5640",
  "#FFC23C",
  "#15CDA8",
  "#7C5CFF",
  "#4ea1ff",
  "#e879f9",
  "#34d399",
] as const;

export const laneColor = (index: number): string => PALETTE[index % PALETTE.length] as string;
