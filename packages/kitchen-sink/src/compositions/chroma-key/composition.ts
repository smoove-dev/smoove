import { Block, Circle, Composition, interpolate, Sequence, Text } from "@smoove/core";
import { chromaKey } from "@smoove/effects";
import { Video } from "@smoove/media";
import clipUrl from "../../files/film/green-screen.mp4";

const width = 1280;
const height = 720;
const fps = 30;
// The clip is 8s of studio footage, so the composition is the clip.
const durationInFrames = fps * 8;

/**
 * The screen colour sampled off a frame of this clip, not a guess. A green lit
 * for camera reads around `#249530` — nothing like `#00ff00`, which is why the
 * eyedropper is step one of every key.
 */
const SCREEN = "#249530";

const comp = new Composition({
  id: "chroma-key",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
});

const main = new Sequence();

// The set the subject is keyed onto.
main.add(
  new Block({
    x: 0,
    y: 0,
    width,
    height,
    background: {
      gradient: {
        type: "linear",
        angle: 165,
        stops: [
          [0, "#151033"],
          [0.55, "#2a1b52"],
          [1, "#0d0a20"],
        ],
      },
    },
  }),
);

// A spotlight behind where the subject will stand. A gradient disc, not a
// shadowBlur: blur re-runs per shape per frame and would dominate the scene.
main.add(
  new Circle({
    x: 900,
    y: 330,
    radius: 340,
    fillRadialGradientStartPoint: { x: 0, y: 0 },
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: 340,
    fillRadialGradientColorStops: [0, "#ffd9a855", 0.45, "#ff9de033", 1, "#ff9de000"],
  }),
);

// Type behind the subject, so the key has to be clean enough to stand in front
// of something rather than over a flat fill.
const backdropTitle = new Text({
  x: 0,
  y: 190,
  width,
  align: "center",
  text: "ON SET",
  fontSize: 210,
  fontStyle: "bold",
  letterSpacing: 18,
  fill: "#ffffff",
  opacity: 0.1,
});
main.add(backdropTitle);

// Contact shadow: without one the subject floats, keyed or not. A squashed
// circle rather than an Ellipse, because a gradient is clipped by the shape it
// fills — an ellipse 22px tall cuts the falloff off at 22px and the shadow gets
// a hard top edge. Scaling a disc scales its gradient with it.
main.add(
  new Circle({
    x: 906,
    y: 690,
    radius: 190,
    scaleY: 0.13,
    fillRadialGradientStartPoint: { x: 0, y: 0 },
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: 190,
    fillRadialGradientColorStops: [0, "#05030faa", 0.45, "#05030f55", 1, "#05030f00"],
  }),
);

/**
 * The footage, cropped to the screen and nothing else.
 *
 * The studio around the green is not green, so no key can remove it: the box is
 * a portrait slice, and `objectFit: "cover"` fills it from the middle of the
 * 1920x1080 frame, which is entirely screen. Keying starts with a crop, every
 * time.
 */
const clip = new Video({
  x: 590,
  y: 0,
  width: 420,
  height,
  src: clipUrl,
  objectFit: "cover",
  muted: true,
  trimAfter: durationInFrames,
});

/**
 * The key goes on the `Video`, not on the Sequence: an effect only touches the
 * node it is on, so the set behind stays untouched and shows straight through
 * the hole this cuts.
 *
 * `similarity` is up from its default because the screen falls off into shadow
 * at the edges of the sweep, and the shadowed green has to go with the lit
 * green. `choke` takes a pixel off the edge, where the codec left a half-green
 * rim around the subject.
 */
const key = chromaKey({
  color: SCREEN,
  strength: 0,
  similarity: 0.62,
  smoothness: 0.12,
  spill: 0.7,
  choke: 1,
});
clip.effects([key]);
main.add(clip);

// In front of everything, and never keyed — the effect is on the clip alone.
const caption = new Block({
  x: 64,
  y: height - 190,
  width: 520,
  flexDirection: "column",
  gap: 10,
  padding: [18, 26],
  cornerRadius: 14,
  background: "#0c0920cc",
});
caption.add(
  new Text({
    text: "CHROMA KEY",
    width: "100%",
    fontSize: 18,
    letterSpacing: 6,
    fontStyle: "bold",
    fill: "#8affc1",
  }),
);
const captionBody = new Text({
  text: "Sampling the screen",
  width: "100%",
  fontSize: 30,
  fontStyle: "bold",
  fill: "#f2f7ff",
});
caption.add(captionBody);
main.add(caption);

comp.add(main);

main.register((frame) => {
  // The screen dissolves rather than cutting, which is the whole reason
  // `strength` exists: the loop opens on the raw plate and closes on it again.
  key.strength = interpolate(
    frame,
    [24, 54, durationInFrames - 40, durationInFrames - 10],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  captionBody.setText(key.strength > 0.5 ? "The set behind shows through" : "Sampling the screen");
  backdropTitle.opacity(
    interpolate(frame, [24, 54], [0.04, 0.1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
});

export default comp;
