import { Block, Composition, interpolate, Sequence, Text } from "@smoove/core";
import { flameWrap } from "@smoove/effects";

/**
 * The same fire in `shape: "silhouette"`: the outline comes from the node's own
 * alpha rather than its box, so each letter burns on its own.
 */
const width = 1280;
const height = 720;
const fps = 30;
const durationInFrames = fps * 5;

const comp = new Composition({
  id: "flame-text",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
});

const main = new Sequence();
main.add(new Block({ x: 0, y: 0, width, height, background: "#08070a" }));

// Only as wide as it needs to be: the capture region is this node's bounding box
// plus padding, so a full-stage width would shade the whole frame every frame.
const titleWidth = 760;

const title = new Text({
  x: (width - titleWidth) / 2,
  y: 250,
  width: titleWidth,
  text: "BURN",
  fontSize: 190,
  fontStyle: "bold",
  fill: "#f4efe8",
  align: "center",
  letterSpacing: 12,
});

const fire = flameWrap({
  shape: "silhouette",
  color: [1, 0.45, 0.1],
  intensity: 0,
  height: 150,
  spread: 14,
  sparks: 1.8,
  melt: 5,
});

title.effects([fire]);
main.add(title);
comp.add(main);

main.register((frame) => {
  fire.intensity = interpolate(
    frame,
    [0, 20, durationInFrames - 30, durationInFrames - 6],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  fire.scorch = interpolate(frame, [20, durationInFrames - 30], [0, 1.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
});

export default comp;
