import type Konva from "konva";
import { parseSize } from "../flex/engine.js";
import type { SizeValue } from "../flex/types.js";
import type { TextAlign, TextConfig } from "./types.js";

/** Keys consumed by the wrapper; everything else is forwarded to the Group. */
const TEXT_KEYS = [
  "text",
  "maxWidth",
  "maxHeight",
  "fontSize",
  "fontFamily",
  "fontStyle",
  "fill",
  "align",
  "lineHeight",
  "letterSpacing",
  "padding",
  "wrap",
  "ellipsis",
  "fitText",
  "maxLines",
  "trimBy",
  "typewriter",
  "highlights",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "margin",
] as const;

export function pickKonvaConfig(config: TextConfig): Konva.GroupConfig {
  const out: Record<string, unknown> = { ...config };
  for (const k of TEXT_KEYS) delete out[k];
  const w = parseSize(config.width as SizeValue | undefined);
  const h = parseSize(config.height as SizeValue | undefined);
  out.width = w?.kind === "px" ? w.value : undefined;
  out.height = h?.kind === "px" ? h.value : undefined;
  return out as Konva.GroupConfig;
}

/** Per-line slice of the displayed text, with char offsets and rendered width. */
export type LineRange = { start: number; end: number; width: number };

/** Cached layout used by highlight/cursor/fade positioning. */
export type Geometry = {
  chars: string[];
  ranges: LineRange[];
  lineH: number;
  pad: number;
  textAreaW: number;
  align: TextAlign;
};

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Pull back index `k` to the end of the previous word (last whitespace). */
export function snapToWord(chars: string[], k: number): number {
  for (let i = k - 1; i > 0; i--) {
    if (chars[i] === " " || chars[i] === "\n") return i;
  }
  return k;
}

/**
 * Word boundaries over `chars`: `wordEnds[j]` is the char index just past word
 * j (== start of word j+1, trailing whitespace included), and `charWord[k]` is
 * the word index char k belongs to.
 */
export function buildWordIndex(chars: string[]): { wordEnds: number[]; charWord: number[] } {
  const wordEnds: number[] = [];
  const charWord: number[] = new Array(chars.length).fill(0);
  let word = 0;
  let inWord = false;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const space = c === " " || c === "\n" || c === "\t";
    charWord[i] = word;
    if (!space) {
      inWord = true;
    } else if (inWord && space) {
      // End the word at the first trailing space; absorb the run into it.
      wordEnds.push(i + 1);
      word++;
      inWord = false;
    } else {
      // Leading/extra whitespace stays with the upcoming word.
    }
  }
  if (inWord) wordEnds.push(chars.length);
  return { wordEnds, charWord };
}
