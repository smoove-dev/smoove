import { Circle, Composition, Group, interpolate, Sequence, Text } from "@smoove/core";
import { blur } from "@smoove/effects";
import { Video } from "@smoove/media";
import clipUrl from "./assets/rack-focus.mp4";

/**
 * A rack focus over real footage.
 *
 * The shot opens sharp, then the focus pulls off it and onto a title: the plate
 * defocuses through a six-blade lens while the title slides up and resolves out
 * of a gaussian blur. At the end the move runs backwards and the footage comes
 * back.
 *
 * The lights drifting over the plate are what make the lens kernel legible.
 * Bokeh is a thing that happens to highlights, so a defocus with nothing bright
 * in it looks much the same whichever kernel drew it.
 */
const width = 1280;
const height = 720;
const fps = 30;
const durationInFrames = fps * 8;

const comp = new Composition({
  id: "blur",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
});

const main = new Sequence();

/** The footage and the lights over it, defocused together as one plate. */
const plate = new Group();

plate.add(
  new Video({
    x: 0,
    y: 0,
    width,
    height,
    src: clipUrl,
    objectFit: "cover",
    muted: true,
    trimAfter: durationInFrames,
  }),
);

/**
 * Drifting specular highlights. Each closes its own loop over the composition,
 * so the last frame lines up with the first, and every position is a function
 * of the frame alone.
 */
const LIGHTS = [
  { x: 210, y: 170, ax: 90, ay: 40, k: 1, radius: 9, fill: "#ffe9b0" },
  { x: 1030, y: 210, ax: -70, ay: 55, k: 1, radius: 14, fill: "#ffd0e8" },
  { x: 380, y: 560, ax: 60, ay: -45, k: 2, radius: 19, fill: "#bfe4ff" },
  { x: 880, y: 520, ax: -95, ay: -30, k: 1, radius: 11, fill: "#fff3cc" },
  { x: 640, y: 120, ax: 45, ay: 70, k: 2, radius: 16, fill: "#ffffff" },
  { x: 1150, y: 620, ax: -55, ay: -60, k: 1, radius: 12, fill: "#d6c4ff" },
];

const lights = LIGHTS.map((spec) => ({
  spec,
  node: new Circle({ x: spec.x, y: spec.y, radius: spec.radius, fill: spec.fill }),
}));
for (const light of lights) plate.add(light.node);

const rack = blur({ type: "lens", radius: 0, bloom: 0.9, blades: 6 });
plate.effects([rack]);
main.add(plate);

/**
 * The title. Its box stays close to the glyphs, which is what keeps the blur's
 * region small: a full-width Text would pad out the whole frame.
 */
const titleWidth = 760;
const title = new Group({ x: (width - titleWidth) / 2, y: 280, opacity: 0 });

title.add(
  new Text({
    x: 0,
    y: 0,
    width: titleWidth,
    text: "RACK FOCUS",
    fontSize: 104,
    fontStyle: "bold",
    letterSpacing: 6,
    align: "center",
    fill: "#ffffff",
  }),
);
title.add(
  new Text({
    x: 0,
    y: 132,
    width: titleWidth,
    text: "one radius, on the timeline",
    fontSize: 30,
    align: "center",
    fill: "#d8e2ff",
  }),
);

const soften = blur({ radius: 26 });
title.effects([soften]);
main.add(title);

comp.add(main);

/** 0 while the footage is sharp, 1 while the title holds. */
const FOCUS_KEYS = [45, 88, 178, 220];

main.register((frame) => {
  const focus = interpolate(frame, FOCUS_KEYS, [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  rack.radius = 30 * focus;
  soften.radius = 26 * (1 - focus);
  title.opacity(focus);
  title.y(280 + 44 * (1 - focus));

  // The lights keep moving whether they are in focus or not, which is what
  // stops the defocused stretch reading as a still.
  const turn = (frame / durationInFrames) * Math.PI * 2;
  for (const { spec, node } of lights) {
    node.x(spec.x + spec.ax * Math.sin(turn * spec.k));
    node.y(spec.y + spec.ay * Math.sin(turn * spec.k + Math.PI / 3));
  }
});

export default comp;
