import { parser } from "@lezer/javascript";
import { Code, interpolateCode, LezerHighlighter } from "@smoove/code";
import { Composition, Sequence, Block } from "@smoove/core";
import FiraCode from '@smoove/google-fonts/fira-code';

import Konva from "konva";

const fps = 60;
const duration = 320;
const width = 800;
const height = 512;

const comp = new Composition({
  id: "code",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: duration });
// Nord "polar night" background so the default highlight theme sits right.
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#2e3440" }));

const highlighter = new LezerHighlighter(parser);

const A = `export function applyEdits(base, edits) {
  let fragments = parseCodeScope(base).fragments;

  return fragments;
}`;
const B = `export function applyEdits(base, edits): CodeTag[] {
  let fragments = parseCodeScope(base).fragments;

  const ordered = [...edits].sort(
    (a, b) => 
      b.range[0][0] - a.range[0][0] || 
      b.range[0][1] - a.range[0][1],
  );

  return fragments;
}`;
const C = `export function applyEdits(base, edits): CodeTag[] {
  let fragments = parseCodeScope(base).fragments;

  const ordered = [...edits].sort(
    (a, b) => 
      b.range[0][0] - a.range[0][0] || 
      b.range[0][1] - a.range[0][1],
  );

  for (const edit of ordered) {
    const [newFragments, index] = extractRange(edit.range, fragments);
    const extracted = newFragments[index] as string;
    newFragments[index] = { before: extracted, after: edit.code };

    fragments = newFragments;
  }

  return fragments;
}`;

const codeFont = new FiraCode();

const box = new Block({
  width: 700,
  height: 400,
  x: 50,
  y: 50,
  padding: 20,
  background: '#0c0c0c',
  // alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  cornerRadius: 50
});

const code = new Code({
  x: 20,
  y: 20,
  content: A,
  highlighter,
  font: codeFont,
  fontSize: 14,
  lineHeight: 1.2,
});
box.add(code);
main.add(box);
comp.add(main);

// Frame-driven: morph A -> B and back, all a pure function of the frame.
main.register((f) => {
  code.setContent(interpolateCode(f, [40, 60, 120, 140], [A, B, B, C]));
});

export default comp;
