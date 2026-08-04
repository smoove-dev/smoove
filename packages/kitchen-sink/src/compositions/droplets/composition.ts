import {
  Block,
  Circle,
  Composition,
  Group,
  interpolate,
  Rect,
  random,
  Sequence,
  Text,
} from "@smoove/core";
import { droplets } from "@smoove/effects";

const width = 1280;
const height = 720;
const fps = 30;
const durationInFrames = fps * 8;

const comp = new Composition({ id: "droplets", fps, durationInFrames, width, height, loop: true });

const main = new Sequence();

/**
 * Everything behind the glass goes in one group, and the group is what carries
 * the effect. droplets is the rare effect whose node is meant to be big: it
 * refracts what is behind it, so it wants a scene, not a badge. Cost still
 * tracks area — this shades the whole frame every frame.
 */
const pane = new Group();

// Night sky.
pane.add(
  new Block({
    x: 0,
    y: 0,
    width,
    height,
    background: {
      gradient: {
        type: "linear",
        angle: 180,
        stops: [
          [0, "#050b18"],
          [1, "#123a63"],
        ],
      },
    },
  }),
);

// A moon, faked as two flat discs rather than a shadowBlur: canvas shadow blur
// re-runs per shape per frame and dominates the cost of an animated scene.
pane.add(new Circle({ x: 1010, y: 150, radius: 96, fill: "#1d4a76", opacity: 0.45 }));
pane.add(new Circle({ x: 1010, y: 150, radius: 54, fill: "#dbe9ff", opacity: 0.9 }));

// A skyline with lit windows. Seeded, so the same city renders on the server
// and in the browser.
const rng = random("droplets-city");
let x = -40;
while (x < width + 40) {
  const w = rng.int(60, 130);
  const h = rng.int(150, 400);
  const top = height - h;
  pane.add(new Rect({ x, y: top, width: w, height: h, fill: "#071324" }));

  for (let wy = top + 18; wy < height - 24; wy += 26) {
    for (let wx = x + 12; wx < x + w - 14; wx += 22) {
      if (rng() > 0.55) continue;
      pane.add(
        new Rect({
          x: wx,
          y: wy,
          width: 10,
          height: 14,
          fill: rng() > 0.25 ? "#ffcb6b" : "#9fd4ff",
          opacity: rng.range(0.35, 0.95),
        }),
      );
    }
  }
  x += w + rng.int(2, 14);
}

const title = new Text({
  x: 90,
  y: 96,
  width: 620,
  text: "RAINY NIGHT",
  fontSize: 92,
  fontStyle: "bold",
  fill: "#f2f7ff",
  letterSpacing: 2,
});
pane.add(title);

pane.add(
  new Text({
    x: 92,
    y: 206,
    width: 620,
    text: "shot through a window that nobody wiped",
    fontSize: 26,
    fill: "#a8c6e4",
  }),
);

// The glass. Everything else about the effect loops on its own, so the only
// thing worth animating is how hard it is raining.
const rain = droplets({
  intensity: 0,
  blur: 4,
  vignette: 0.55,
  refraction: 0.3,
  sheen: 1.1,
  tint: [0.62, 0.76, 1],
  tintStrength: 0.18,
});
pane.effects([rain]);

main.add(pane);
comp.add(main);

main.register((frame) => {
  // A squall that arrives, sits, and passes: the fog follows the rain so the
  // window clears with it.
  const strength = interpolate(
    frame,
    [0, 60, durationInFrames - 70, durationInFrames - 10],
    [0.1, 1.15, 1.15, 0.1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  rain.intensity = strength;
  rain.blur = 2 + strength * 4;
});

export default comp;
