/**
 * A code panel that types itself out in full syntax colour.
 *
 * One `Text` per line carrying the whole line, with a `highlights` range per
 * coloured token. Two reasons it is built this way rather than one node per
 * token:
 *
 *  - Truncation. A `Text` whose flex box is exactly its own ink width can be
 *    clipped by a sub-pixel rounding of that box, and `wrap: "none"` then
 *    ellipsizes it. Giving every line the panel's full width means the box is
 *    always far wider than the ink, so nothing is ever cut.
 *  - The reveal is one continuous stream. Each line's typewriter `startFrame`
 *    is offset by the characters before it, so the whole block types at one
 *    rate even though the lines are separate nodes.
 */
import { Block, Flex, Rect, Text } from "@smoove/core";
import { AMBER, BORDER, CORAL, MUTED, TEAL, TEXT } from "../constants.js";
import { mono } from "../fonts.js";

/** Token roles → colour. Kept small: more hues than this reads as confetti. */
const INK_FOR = {
  keyword: CORAL,
  type: TEAL,
  fn: "#d2a8ff",
  num: "#79c0ff",
  str: AMBER,
  prop: MUTED,
  plain: TEXT,
  punct: "#7d8590",
  comment: "#6e7681",
} as const;

export type Role = keyof typeof INK_FOR;
export type Token = [text: string, role: Role];
export type Line = { indent?: number; tokens: Token[] };

/** Transparent marker: highlights are being used purely to recolour a run. */
const NO_MARK = "#00000000";

export type CodePanelOptions = {
  x: number;
  y: number;
  width: number;
  lines: Line[];
  /** Frames the whole reveal is spread across. */
  durationInFrames: number;
  /** Local frame typing begins. */
  startFrame?: number;
  fontSize?: number;
};

export type CodePanel = {
  block: Block;
  /** Local frame the last character lands — for cueing anything after it. */
  typedBy: number;
};

export function codePanel({
  x,
  y,
  width,
  lines,
  durationInFrames,
  startFrame = 0,
  fontSize = 26,
}: CodePanelOptions): CodePanel {
  // Indentation is leading spaces: the face is monospaced, so they align, and
  // it keeps the line one string (which is what the highlight ranges index).
  const built = lines.map((line) => {
    const pad = " ".repeat((line.indent ?? 0) * 2);
    let text = pad;
    const highlights = [];
    for (const [tok, role] of line.tokens) {
      const start = text.length;
      text += tok;
      if (role !== "plain") {
        highlights.push({ start, end: text.length, background: NO_MARK, color: INK_FOR[role] });
      }
    }
    // A blank line still needs to occupy a row.
    return { text: text.length > 0 ? text : " ", highlights };
  });

  const totalChars = built.reduce((n, l) => n + l.text.length, 0);
  /** One rate across the whole block, in frames per character. */
  const rate = durationInFrames / Math.max(1, totalChars);

  const block = new Block({
    x,
    y,
    width,
    flexDirection: "column",
    gap: 8,
    padding: [26, 30, 30, 30],
    cornerRadius: 18,
    background: {
      gradient: {
        type: "linear",
        stops: [
          [0, "#11161ff2"],
          [1, "#0b0f15f2"],
        ],
        angle: 120,
      },
    },
    borderSize: 1,
    borderColor: BORDER,
  });

  // Window chrome — frames the block as an editor rather than loose text.
  const chrome = new Flex({ width: "100%", flexDirection: "row", gap: 9, alignItems: "center" });
  for (const c of ["#ff5f57", "#febc2e", "#28c840"]) {
    chrome.add(new Rect({ width: 13, height: 13, cornerRadius: 999, fill: c, opacity: 0.9 }));
  }
  block.add(chrome);
  block.add(new Rect({ width: "100%", height: 1, fill: "#ffffff12" }));

  let cum = 0;
  built.forEach((line, i) => {
    const last = i === built.length - 1;
    block.add(
      new Text({
        width: "100%",
        text: line.text,
        highlights: line.highlights,
        font: mono.face("400"),
        fontSize,
        lineHeight: 1.35,
        fill: INK_FOR.plain,
        wrap: "none",
        typewriter: {
          mode: "letter",
          startFrame: startFrame + Math.round(cum * rate),
          durationInFrames: Math.max(1, Math.round(line.text.length * rate)),
          fade: true,
          // Only the final line carries the caret, so there is exactly one on
          // screen and it ends up parked where the code stops.
          ...(last ? { cursor: { color: AMBER } } : {}),
        },
      }),
    );
    cum += line.text.length;
  });

  return { block, typedBy: startFrame + durationInFrames };
}
