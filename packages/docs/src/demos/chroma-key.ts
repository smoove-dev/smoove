import { Block, Circle, Composition, Group, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { chromaKey } from "@smoove/effects";

/**
 * chromaKey on a shot standing in for footage: a green plate with a subject on
 * it, keyed onto a set. `strength` runs from 0 so the demo opens on the plate
 * and the screen dissolves out of it, then comes back at the end so the loop
 * closes on itself.
 *
 * A screen lit for camera is never `#00ff00`, so the plate here is the dull
 * green a camera actually records, and the key is given that same colour.
 */
const width = 1280;
const height = 720;
const fps = 30;
const durationInFrames = fps * 8;

const SCREEN = "#2f9e44";

const comp = new Composition({
  id: "chroma-key",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
});

const main = new Sequence();

// The set.
main.add(
  new Block({
    x: 0,
    y: 0,
    width,
    height,
    background: {
      gradient: {
        type: "linear",
        angle: 160,
        stops: [
          [0, "#141033"],
          [0.6, "#2b1a55"],
          [1, "#0c0a1e"],
        ],
      },
    },
  }),
);

main.add(
  new Circle({
    x: 800,
    y: 340,
    radius: 380,
    fillRadialGradientStartPoint: { x: 0, y: 0 },
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: 380,
    fillRadialGradientColorStops: [0, "#ffb87a44", 0.5, "#ff7ac622", 1, "#ff7ac600"],
  }),
);

const setTitle = new Text({
  x: 96,
  y: 250,
  width: 520,
  text: "ON SET",
  fontSize: 108,
  fontStyle: "bold",
  letterSpacing: 6,
  fill: "#f2f7ff",
});
main.add(setTitle);

const setLine = new Text({
  x: 100,
  y: 380,
  width: 520,
  text: "one colour out, the set behind in",
  fontSize: 26,
  fill: "#b9a7e8",
});
main.add(setLine);

/**
 * The plate. Everything inside this group is the shot: the screen it was filmed
 * against, and the subject standing on it.
 */
const plate = new Group();
plate.add(new Rect({ x: 660, y: 60, width: 560, height: 600, fill: SCREEN, cornerRadius: 18 }));

// The subject, drawn on the plate rather than filmed on it.
const subject = new Group({ x: 940, y: 360 });
subject.add(
  new Rect({
    x: -150,
    y: -150,
    width: 300,
    height: 300,
    cornerRadius: 64,
    fill: "#ff7ac6",
  }),
);
subject.add(new Circle({ x: 0, y: -34, radius: 62, fill: "#fff4fb" }));
subject.add(new Rect({ x: -84, y: 62, width: 168, height: 26, cornerRadius: 13, fill: "#fff4fb" }));
plate.add(subject);

/**
 * The key goes on the plate, so it takes the screen out of the shot and leaves
 * everything outside the shot alone. The set behind is a sibling and never sees
 * the effect.
 */
const key = chromaKey({ color: SCREEN, strength: 0, similarity: 0.55 });
plate.effects([key]);
main.add(plate);

comp.add(main);

main.register((frame) => {
  key.strength = interpolate(
    frame,
    [24, 66, durationInFrames - 60, durationInFrames - 18],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // A slow sway, so the shot reads as a shot rather than a still.
  subject.rotation(interpolate(frame, [0, durationInFrames], [-5, 5]));
});

export default comp;
