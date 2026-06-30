import { Circle, Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";

/**
 * Introduction hero. A title + subtitle slide up and fade in over two accent
 * dots, then ease back out so the loop is seamless (frame 0 ≈ last frame).
 * Everything is a pure function of the frame: no timers, no tweens.
 */
const width = 1280;
const height = 720;
const duration = 300;

const comp = new Composition({
  id: "hero",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: duration });
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

// Two accent dots that breathe behind the text.
const dotA = new Circle({
  x: width / 2 - 360,
  y: 300,
  radius: 120,
  fill: "#4cc9f0",
  opacity: 0.18,
});
const dotB = new Circle({
  x: width / 2 + 360,
  y: 440,
  radius: 160,
  fill: "#b5179e",
  opacity: 0.16,
});
main.add(dotA, dotB);

const title = new Text({
  x: 0,
  y: 300,
  width,
  align: "center",
  text: "smoove",
  fontSize: 96,
  fontStyle: "700",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  fill: "#f9fafb",
});
const subtitle = new Text({
  x: 0,
  y: 416,
  width,
  align: "center",
  text: "Timeline-driven animation for Konva",
  fontSize: 30,
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  fill: "#9aa5b1",
});
main.add(title, subtitle);

const easeOut = Easing.out(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

main.register((frame) => {
  // In over [0, 80], hold, out over [220, 300], symmetric so the loop joins.
  const reveal = interpolate(frame, [0, 80], [0, 1], { easing: easeOut, ...clamp });
  const exit = interpolate(frame, [220, 300], [0, 1], {
    easing: Easing.in(Easing.cubic),
    ...clamp,
  });
  const presence = reveal * (1 - exit);

  title.opacity(presence);
  title.y(300 + (1 - reveal) * 40 + exit * 40);

  subtitle.opacity(presence);
  subtitle.y(416 + (1 - reveal) * 28 + exit * 28);

  // Dots drift + breathe across the whole loop.
  const t = frame / duration;
  dotA.radius(120 + 18 * Math.sin(t * Math.PI * 2));
  dotB.radius(160 + 22 * Math.sin(t * Math.PI * 2 + 1));
});

comp.add(main);
export default comp;
