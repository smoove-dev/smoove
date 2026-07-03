import { Block, Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import Comfortaa from "@smoove/google-fonts/comfortaa";
import Konva from "konva";

const fps = 30;
const durationInFrames = 120;
const width = 1280;
const height = 720;

const comp = new Composition({
  id: "hello-smoove",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
});

// The wordmark font. Registered on the sequence below so the composition
// buffers until the face is loaded.
const comfortaa = new Comfortaa({ weights: ["700"] });

const main = new Sequence({ from: 0, durationInFrames });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
main.add(comfortaa);

// The smoove mark, drawn as vectors. Geometry comes straight from the
// 120×120 mark SVG, scaled and centered above the wordmark.
const S = 2.6;
const offX = width / 2 - 60 * S;
const cy = height / 2 - 70;

const gradient = {
  strokeLinearGradientStartPoint: { x: offX + 40 * S, y: cy },
  strokeLinearGradientEndPoint: { x: offX + 84 * S, y: cy },
  strokeLinearGradientColorStops: [0, "#FF5640", 1, "#15CDA8"],
};

const bars = [
  { x: 40, half: 22 },
  { x: 52, half: 16 },
  { x: 64, half: 10 },
  { x: 76, half: 4 },
].map(({ x, half }) => {
  const X = offX + x * S;
  const node = new Konva.Line({
    points: [X, cy, X, cy],
    strokeWidth: 9 * S,
    lineCap: "round",
    opacity: 0,
    ...gradient,
  });
  main.add(node);
  return { node, X, half: half * S };
});

const dot = new Konva.Circle({
  x: offX + 89 * S,
  y: cy,
  radius: 3.5 * S,
  fill: "#FFC23C",
  scaleX: 0,
  scaleY: 0,
});
main.add(dot);

const wordmark = new Text({
  font: comfortaa.face("700"),
  text: "smoove",
  fontSize: 92,
  fill: "#e6edf3",
});
const labelY = cy + 60 * S + 8;
const label = new Block({
  x: 0,
  y: labelY,
  width,
  flexDirection: "row",
  justifyContent: "center",
  opacity: 0,
});
label.add(wordmark);
main.add(label);

comp.add(main);

main.register((frame) => {
  // Bars grow from their centers, staggered left to right.
  bars.forEach((bar, i) => {
    const t = interpolate(frame, [i * 5, i * 5 + 28], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    bar.node.opacity(Math.min(1, t * 4));
    bar.node.points([bar.X, cy - bar.half * t, bar.X, cy + bar.half * t]);
  });

  // The sunshine dot pops once the last bar lands.
  const pop = interpolate(frame, [34, 52], [0, 1], {
    easing: Easing.out(Easing.back(2)),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  dot.scaleX(pop);
  dot.scaleY(pop);

  // The wordmark rises and fades in under the mark.
  label.opacity(
    interpolate(frame, [48, 72], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  label.y(
    labelY +
      interpolate(frame, [48, 72], [24, 0], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
  );
});

export default comp;
