import { Composition, Font, interpolate, Sequence, Text } from "@smoove/core";

/**
 * The fonts demo. Two `Font` nodes declared with remote woff2 faces are added to
 * the sequence; the composition buffers on them, so nothing paints until the
 * glyphs are ready (no fallback-font flash). One font is a distinctive script
 * face shown at its preferred weight; the other is declared with two weights so
 * we can pick `400` and `700` off the same family with `font.face(...)`.
 */
const width = 1280;
const height = 720;
const duration = 150;

const comp = new Composition({
  id: "fonts",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const scene = new Sequence();

// A script display face that instantly reads as "a custom font is loaded".
const pacifico = new Font({
  family: "Pacifico",
  faces: [{ src: "https://fonts.gstatic.com/s/pacifico/v23/FwZY7-Qmy14u9lezJ-6H6Mk.woff2" }],
});

// A serif declared with two weights from one family.
const playfair = new Font({
  family: "Playfair Display",
  faces: [
    {
      weight: 400,
      src: "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgA.woff2",
    },
    {
      weight: 700,
      src: "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgA.woff2",
    },
  ],
});

scene.add(pacifico, playfair);

const script = new Text({
  x: 0,
  y: 150,
  width,
  align: "center",
  text: "Loaded with a Font node",
  font: pacifico, // bare Font → its preferred (400) face
  fontSize: 84,
  fill: "#f9fafb",
});

const regular = new Text({
  x: 0,
  y: 360,
  width,
  align: "center",
  text: "Playfair Display, regular",
  font: playfair.face("400"),
  fontSize: 46,
  fill: "#9ca3af",
});

const bold = new Text({
  x: 0,
  y: 440,
  width,
  align: "center",
  text: "Playfair Display, bold",
  font: playfair.face("700"),
  fontSize: 46,
  fill: "#e5e7eb",
});

scene.add(script, regular, bold);

scene.register((frame) => {
  const fade = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  script.opacity(fade);
  regular.opacity(
    interpolate(frame, [12, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  bold.opacity(
    interpolate(frame, [24, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
});

comp.add(scene);
export default comp;
