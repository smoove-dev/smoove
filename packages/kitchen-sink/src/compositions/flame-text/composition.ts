import { Block, Composition, interpolate, Sequence, Text } from "@smoove/core";
import { flameWrap } from "@smoove/effects";

const width = 1280;
const height = 720;
const fps = 30;
const durationInFrames = fps * 6;

const comp = new Composition({ id: "flame-text", fps, durationInFrames, width, height });

const main = new Sequence();

// A near-black backdrop: fire reads as light, so it needs darkness to sit in.
main.add(new Block({ x: 0, y: 0, width, height, background: "#08070a" }));

// The title box is only as wide as it needs to be, not the full stage. That is
// a cost decision, not tidiness: the capture region is this node's bounding box
// plus padding, so a `width: 1280` Text would have the shader shading the whole
// frame every frame instead of a box around the glyphs.
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

// `silhouette` reads the outline off the glyphs' own alpha instead of the node's
// box, so each letter burns on its own and the fire climbs out of the counters.
const fire = flameWrap({
  shape: "silhouette",
  intensity: 0,
  color: [1, 0.45, 0.1],
  height: 150,
  spread: 14,
  melt: 5,
  sparks: 1.8,
  scorch: 0.6,
});
title.effects([fire]);
main.add(title);

const caption = new Text({
  x: 0,
  y: 520,
  width,
  text: "flameWrap follows any node's alpha",
  fontSize: 30,
  fill: "#8b8189",
  align: "center",
  letterSpacing: 3,
});
main.add(caption);

comp.add(main);

main.register((frame) => {
  // Ignites over two thirds of a second, holds, then dies back down.
  fire.intensity = interpolate(
    frame,
    [0, 20, durationInFrames - 30, durationInFrames - 6],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Scorching accumulates as the fire holds, so the letters look burnt by the end.
  fire.scorch = interpolate(frame, [20, durationInFrames - 30], [0, 1.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  caption.opacity(
    interpolate(frame, [30, 50], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
});

export default comp;
