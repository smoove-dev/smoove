import { Circle, Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";

/**
 * A short, self-contained scene for the custom-controls example on the player
 * page. It is its own composition (not the shared orbit module) so the page can
 * run two independent players side by side: one with the default control bar and
 * this one with a hand-built bar. A wide sweep and a clear time readout give the
 * progress track and time control something to show across the five-second loop.
 */
const width = 1280;
const height = 720;
const duration = 300; // 5s at 60fps

const comp = new Composition({
  id: "player-custom-controls",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

// Background first so the content layer paints on top.
const bg = new Sequence({ from: 0, durationInFrames: duration });
bg.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
comp.add(bg);

const content = new Sequence({ from: 0, durationInFrames: duration });

const label = new Text({
  text: "Build your own bar",
  x: 0,
  y: 120,
  width,
  align: "center",
  fontSize: 44,
  fontStyle: "bold",
  fill: "#e5e7eb",
});
content.add(label);

const track = new Rect({ x: 140, y: 470, width: width - 280, height: 4, fill: "#1f2937" });
content.add(track);

// A puck that sweeps the width once per loop, so the player's own progress bar
// and the on-stage motion stay in step.
const puck = new Circle({
  x: 140,
  y: 472,
  radius: 26,
  fill: "#38bdf8",
  shadowColor: "#38bdf8",
  shadowBlur: 28,
  shadowOpacity: 0.8,
});
content.add(puck);

content.register((frame) => {
  const x = interpolate(frame, [0, duration - 1], [140, width - 140], {
    easing: Easing.inOut(Easing.cubic),
  });
  puck.x(x);
  // Pulse the radius so it has some life while it travels.
  puck.radius(22 + 6 * Math.sin((frame / duration) * Math.PI * 2 * 3));
});

comp.add(content);
export default comp;
