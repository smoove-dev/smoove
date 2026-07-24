/**
 * A 16:9 clip cropped to the square canvas and kept alive with a slow drift.
 *
 * Every source clip is landscape and the deliverable is 1080², so a static
 * centre crop throws away the sides *and* reads as flat. The plate oversizes
 * the video slightly and drifts it, which restores some of the motion the crop
 * takes away and gives the pan somewhere to go.
 */
import { Clip, Easing, Group, interpolate, type ObjectPosition } from "@smoove/core";
import { Video } from "@smoove/media";
import { HEIGHT, WIDTH } from "../constants.js";

export type VideoPlateOptions = {
  src: string;
  /** Scale at the first and last frame. >1 always, so the crop never shows an edge. */
  zoom?: [number, number];
  /** Horizontal drift in px across the plate's life, as a fraction of the slack. */
  driftX?: number;
  driftY?: number;
  /** Which part of the 16:9 frame to favour when cropping to square. */
  objectPosition?: ObjectPosition;
  /** Frames trimmed off the head of the source. */
  trimBefore?: number;
  from?: number;
  durationInFrames?: number;
  opacity?: number;
};

export function videoPlate({
  src,
  zoom = [1.06, 1.14],
  driftX = 0,
  driftY = 0,
  objectPosition = "center" as ObjectPosition,
  trimBefore,
  from,
  durationInFrames,
  opacity = 1,
}: VideoPlateOptions): Clip {
  const clip = new Clip({ from, durationInFrames, opacity, listening: false });

  // Scaling happens about the canvas centre, so the crop stays centred as it
  // pushes in rather than creeping toward the top-left.
  const holder = new Group({
    x: WIDTH / 2,
    y: HEIGHT / 2,
    offsetX: WIDTH / 2,
    offsetY: HEIGHT / 2,
  });
  clip.add(holder);

  const video = new Video({
    width: WIDTH,
    height: HEIGHT,
    src,
    objectFit: "cover",
    objectPosition,
    trimBefore,
    muted: true,
    listening: false,
  });
  holder.add(video);

  clip.register((frame, { durationInFrames: total }) => {
    const p = interpolate(frame, [0, Math.max(1, total - 1)], [0, 1], {
      easing: Easing.inOut(Easing.sin),
      extrapolateRight: "clamp",
    });
    const k = zoom[0] + (zoom[1] - zoom[0]) * p;
    holder.scaleX(k);
    holder.scaleY(k);
    // Slack is what the oversize buys us; drift never exceeds it, so no edge
    // can enter frame however the plate is retimed.
    const slackX = (WIDTH * (k - 1)) / 2;
    const slackY = (HEIGHT * (k - 1)) / 2;
    holder.x(WIDTH / 2 + driftX * slackX * (p * 2 - 1));
    holder.y(HEIGHT / 2 + driftY * slackY * (p * 2 - 1));
  });

  return clip;
}
