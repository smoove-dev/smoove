import { Block, Composition, Ellipse, Rect, Sequence } from "@smoove/core";
import { ACCENTS } from "../accents.js";
import type { PlaygroundProps } from "./schema.js";

const W = 1280;
const H = 720;
const FPS = 30;
const FRAMES = 120;
const FRAME_H = 420;

const DEFAULTS: PlaygroundProps = {
  frameWidth: 1000,
  gap: 24,
  padding: 24,
  direction: "row",
  justify: "flex-start",
  align: "center",
  aWidth: 180,
  aHeight: 180,
  bWidth: 180,
  bHeight: 180,
  cGrow: 1,
  accent: "#7c5cff",
};

const comp = new Composition<PlaygroundProps>({
  id: "shapes-playground",
  fps: FPS,
  durationInFrames: FRAMES,
  width: W,
  height: H,
  props: DEFAULTS,
  loop: true,
});
const p = () => comp.props.get();

const seq = new Sequence({ from: 0, durationInFrames: FRAMES });
seq.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#0c0c12" }));

// The flex container is a real Block (border + faint fill) so you can see the
// frame the children are laid out inside. Box A and Box B have explicit,
// editable width/height; Box C has no width and grows to fill what's left — so
// resizing A or B reflows B/C and (once they overflow) shrinks every sibling.
const frame = new Block({
  flexDirection: "row",
  background: "#15151f",
  borderSize: 1,
  borderColor: "#2a2a38",
  cornerRadius: 16,
});

// flexShrink lets A and B give ground when the boxes overflow the frame, so
// growing one visibly shrinks the others (not just repositions them).
const boxA = new Rect({
  width: 180,
  height: 180,
  cornerRadius: 14,
  fill: DEFAULTS.accent,
  flexShrink: 1,
});
// Ellipse needs radiusX/radiusY; its rendered size is then driven by the flex
// width/height attrs each frame (the layout pass writes them back via setWidth).
const boxB = new Ellipse({ radiusX: 90, radiusY: 90, fill: ACCENTS[1], flexShrink: 1 });
const boxC = new Rect({
  flexGrow: 1,
  height: 140,
  cornerRadius: 14,
  fill: "#1d1d2b",
  stroke: ACCENTS[2],
  strokeWidth: 2,
  dash: [10, 8],
});

frame.add(boxA);
frame.add(boxB);
frame.add(boxC);
seq.add(frame);
comp.add(seq);

seq.register(() => {
  const pr = p();

  // Center the frame on the stage; its size is set via the flex size attrs so
  // Block.computeLayout lays the children out inside exactly these bounds.
  frame.x((W - pr.frameWidth) / 2);
  frame.y((H - FRAME_H) / 2);
  frame.setAttrs({
    flexWidth: pr.frameWidth,
    flexHeight: FRAME_H,
    flexDirection: pr.direction,
    justifyContent: pr.justify,
    alignItems: pr.align,
    gap: pr.gap,
    padding: pr.padding,
  });

  // Drive each box's size from props — the flex pass on the next tick reflows
  // the siblings (and shrinks them once A + B + gaps exceed the frame).
  boxA.setAttrs({ flexWidth: pr.aWidth, flexHeight: pr.aHeight, fill: pr.accent });
  boxB.setAttr("flexWidth", pr.bWidth);
  boxB.setAttr("flexHeight", pr.bHeight);
  boxC.setAttr("flexGrow", pr.cGrow);
});

export default comp;
