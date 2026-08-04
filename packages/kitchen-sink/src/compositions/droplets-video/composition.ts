import { Block, Composition, interpolate, Sequence, Text } from "@smoove/core";
import { droplets } from "@smoove/effects";
import { Video } from "@smoove/media";
import clipUrl from "../../files/film/s4a.mp4";

const width = 1280;
const height = 720;
const fps = 30;
// The clip runs 8s, so the composition is the clip.
const durationInFrames = fps * 8;

const comp = new Composition({
  id: "droplets-video",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
});

const main = new Sequence();

/**
 * The glass goes on the video itself. Its box is the frame, the effect is gated
 * on that box, and every drop refracts real footage rather than a flat fill,
 * which is what the effect is for.
 */
const clip = new Video({
  x: 0,
  y: 0,
  width,
  height,
  src: clipUrl,
  objectFit: "cover",
  muted: true,
  trimAfter: durationInFrames,
});

const rain = droplets({
  intensity: 0,
  refraction: 0.35,
  sheen: 0.9,
  vignette: 0.5,
  tint: [0.66, 0.78, 1],
  tintStrength: 0.12,
});
clip.effects([rain]);
main.add(clip);

// In front of the glass, not behind it: an effect only touches the node it is
// on, so this caption stays sharp while the footage runs wet.
const caption = new Block({
  x: 64,
  y: height - 168,
  // Explicit, with the lines at 100%: the panel has to be as wide as the copy,
  // and a hugging Block plus hugging Text collapses to the label's left edge.
  width: 640,
  flexDirection: "column",
  gap: 10,
  padding: [18, 26],
  cornerRadius: 14,
  background: "#0a1220cc",
});
caption.add(
  new Text({
    text: "DROPLETS",
    width: "100%",
    fontSize: 18,
    letterSpacing: 6,
    fontStyle: "bold",
    fill: "#9dc4ff",
  }),
);
caption.add(
  new Text({
    text: "Rain on the lens, the caption stays dry",
    width: "100%",
    fontSize: 30,
    fontStyle: "bold",
    fill: "#f2f7ff",
  }),
);
main.add(caption);

comp.add(main);

main.register((frame) => {
  // The weather turns, holds, then lets up, so the loop closes on itself.
  const strength = interpolate(
    frame,
    [0, 50, durationInFrames - 60, durationInFrames - 8],
    [0.15, 1.15, 1.15, 0.15],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  rain.intensity = strength;
  // The window fogs as it comes down and clears as it passes. Kept light: the
  // footage is the point, and fog past a few px starts to swallow it.
  rain.blur = strength * 3;
});

export default comp;
