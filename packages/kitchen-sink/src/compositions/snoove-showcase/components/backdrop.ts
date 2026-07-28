/**
 * The hi-tech backdrop shared by the logo, layout, and outro scenes: a near
 * black base with two brand-coloured discs drifting through it.
 *
 * The glow is a radial *gradient fill*, never `shadowBlur` — canvas shadow
 * blur re-runs a Gaussian per shape per frame and would dominate the paint
 * cost of a full-bleed 1080² scene.
 */
import { Circle, Clip, Rect } from "@smoove/core";
import { CORAL, HEIGHT, INK, TEAL, WIDTH } from "../constants.js";

/** A soft disc whose gradient radius lives in local coords — scale it, never `radius()`. */
function aurora(color: string, radius: number) {
  return new Circle({
    radius,
    listening: false,
    fillRadialGradientStartPoint: { x: 0, y: 0 },
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: radius,
    // Solid-ish core → mid stop → transparent rim, mimicking a Gaussian
    // falloff. Without the mid stop a linear fade reads as a flat bokeh blob.
    fillRadialGradientColorStops: [
      0,
      `${color}66`,
      0.35,
      `${color}33`,
      0.62,
      `${color}14`,
      1,
      `${color}00`,
    ],
  });
}

export type BackdropOptions = {
  /** Overall strength, 0..1. The code and mixer scenes sit on video instead. */
  intensity?: number;
};

export function backdrop({ intensity = 1 }: BackdropOptions = {}): Clip {
  const clip = new Clip({ listening: false });

  clip.add(new Rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: INK, listening: false }));

  const warm = aurora(CORAL, 620);
  const cool = aurora(TEAL, 700);
  clip.add(warm, cool);

  // A faint top-to-bottom darkening so the centre of frame stays the
  // brightest thing and type never fights the glow.
  clip.add(
    new Rect({
      x: 0,
      y: 0,
      width: WIDTH,
      height: HEIGHT,
      listening: false,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: HEIGHT },
      fillLinearGradientColorStops: [0, "#0d111700", 0.55, "#0d111744", 1, "#0d1117cc"],
    }),
  );

  clip.register((frame, { fps }) => {
    // Slow, prime-ish periods so the two discs never visibly re-sync.
    const t = frame / fps;
    warm.x(WIDTH * 0.26 + 130 * Math.sin(t * 0.31));
    warm.y(HEIGHT * 0.3 + 90 * Math.cos(t * 0.23));
    warm.opacity(intensity * (0.85 + 0.15 * Math.sin(t * 0.47)));

    cool.x(WIDTH * 0.76 + 120 * Math.cos(t * 0.19));
    cool.y(HEIGHT * 0.72 + 110 * Math.sin(t * 0.27));
    cool.opacity(intensity * (0.85 + 0.15 * Math.cos(t * 0.39)));
  });

  return clip;
}
