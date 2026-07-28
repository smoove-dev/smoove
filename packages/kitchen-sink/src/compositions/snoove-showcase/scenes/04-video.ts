/**
 * Scene 4 — real video, masked and moving.
 *
 * One clip path does the whole scene, and it is always the union of two shapes:
 * a rounded rectangle and the logo.
 *
 *  1. The rectangle opens as *exactly* the card's image slot from the previous
 *     scene — same position, same 280×501 box, same 14px corners — so the
 *     footage takes that image's place rather than appearing next to it.
 *  2. It grows to full bleed, holds, then collapses. As it collapses its
 *     corner radius runs up to half its size, which turns the rectangle into a
 *     circle on the way in.
 *  3. The circle closes onto the logo's dot just as the dot pops, and the mark
 *     then builds itself *out of the footage* on black — the punch-out. The
 *     two masks overlap while that happens, which is what stitches them.
 *
 * The logo half of the path comes from `markGeometryAt`, the same function the
 * drawn logo uses, so the hole in the frame is the logo animation itself.
 */
import { Easing, Group, interpolate, Rect, type Sequence } from "@smoove/core";
import { backdrop } from "../components/backdrop.js";
import { markGeometryAt } from "../components/logo.js";
import { videoPlate } from "../components/video-plate.js";
import {
  CARD,
  CARD_IMAGE_X,
  CARD_IMAGE_Y,
  HANDOFF_IMAGE_H,
  HEIGHT,
  VIDEO,
  WIDTH,
} from "../constants.js";

// -- beats -------------------------------------------------------------------

/**
 * The shape sits in the card's image slot for a beat — long enough to read as
 * having *replaced* that image — and then grows to full bleed. This whole span
 * is the `none()` overlap with the layout scene, so the card is still on screen
 * underneath while it happens.
 */
const GROW = [10, 46];
/** Full bleed holds until here, then the shape collapses toward the mark. */
const CLOSE = [120, 178];
/**
 * Local frame the mark's own animation starts. Its dot pops while the shape is
 * still closing, and its bars begin sweeping the frame the shape reaches zero —
 * that overlap is the stitch. The mark needs 70 frames end to end, so starting
 * here leaves the finished punch-out ~35 frames on screen before the scene
 * hands over.
 */
export const MARK_AT = 134;
/**
 * Scene-local frame of VO2. The scene opens at absolute 385, so this puts the
 * line at absolute frame 540 — over the mask closing down onto the logo, which
 * is what it describes.
 */
export const VO_AT = 155;
/** Swish cues: the shape opening, and the shape closing. */
export const SWISH_AT = [GROW[0]!, CLOSE[0]!];

/** How wide the punched-out mark ends up. Deliberately large — it is the frame. */
const LOGO_W = 780;

const TAU = Math.PI * 2;

/** Rounded rectangle as a path, via `arcTo` (which Konva's context proxies). */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/**
 * One of the mark's bars: a capsule, drawn as a rect plus a disc at each end.
 * Overlapping subpaths with the same winding union under the nonzero fill rule,
 * which is exactly what a clip path needs.
 */
function capsulePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  half: number,
  w: number,
) {
  const r = w / 2;
  ctx.moveTo(cx - r, cy - half);
  ctx.rect(cx - r, cy - half, w, half * 2);
  ctx.moveTo(cx + r, cy - half);
  ctx.arc(cx, cy - half, r, 0, TAU, false);
  ctx.moveTo(cx + r, cy + half);
  ctx.arc(cx, cy + half, r, 0, TAU, false);
}

export function video(seq: Sequence) {
  // Both backgrounds start fully transparent. For the first ~60 frames this
  // scene is layered over the still-live layout scene, and everything outside
  // the mask has to let that card through — so the frame only becomes ours as
  // the shape grows to cover it.
  const base = new Rect({
    x: 0,
    y: 0,
    width: WIDTH,
    height: HEIGHT,
    fill: "#000000",
    opacity: 0,
    listening: false,
  });
  seq.add(base);

  const glow = backdrop({ intensity: 0.7 });
  glow.opacity(0);
  seq.add(glow);

  // The clip shape is a plain object the `clipFunc` reads at draw time.
  // `register` runs before the draw each frame, so the mask and the frame can
  // never disagree.
  const shape: {
    x: number;
    y: number;
    w: number;
    h: number;
    r: number;
    /** Mark-local frame, or null before the punch-out begins. */
    markFrame: number | null;
  } = {
    x: CARD_IMAGE_X,
    y: CARD_IMAGE_Y,
    w: CARD.imageWidth,
    h: HANDOFF_IMAGE_H,
    r: 14,
    markFrame: null,
  };

  const masked = new Group({
    listening: false,
    clipFunc: (ctx) => {
      const c = ctx as unknown as CanvasRenderingContext2D;
      c.beginPath();
      if (shape.w > 1 && shape.h > 1) {
        roundRectPath(c, shape.x, shape.y, shape.w, shape.h, shape.r);
      }
      if (shape.markFrame !== null) {
        const geo = markGeometryAt(shape.markFrame, { x: WIDTH / 2, y: HEIGHT / 2, width: LOGO_W });
        for (const b of geo.bars) {
          if (b.half > 0.5) capsulePath(c, b.x, HEIGHT / 2, b.half, b.w);
        }
        if (geo.dot.r > 0.5) {
          c.moveTo(geo.dot.x + geo.dot.r, geo.dot.y);
          c.arc(geo.dot.x, geo.dot.y, geo.dot.r, 0, TAU, false);
        }
      }
    },
  });
  seq.add(masked);

  masked.add(
    // Played from its first frame — no head trim. The source is 302 frames and
    // the scene is 265, so the tail is what gets cut.
    videoPlate({
      src: VIDEO.hero,
      zoom: [1.04, 1.12],
      driftX: 0.3,
      driftY: -0.2,
      objectPosition: "center",
    }),
  );

  seq.register((frame) => {
    // Size: card image slot → full bleed → nothing.
    const w = interpolate(
      frame,
      [GROW[0]!, GROW[1]!, CLOSE[0]!, CLOSE[1]!],
      [CARD.imageWidth, WIDTH, WIDTH, 0],
      {
        easing: Easing.inOut(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    const h = interpolate(
      frame,
      [GROW[0]!, GROW[1]!, CLOSE[0]!, CLOSE[1]!],
      [HANDOFF_IMAGE_H, HEIGHT, HEIGHT, 0],
      {
        easing: Easing.inOut(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    // Corner radius runs past half the box on the way out, so `roundRectPath`
    // clamps it to a circle — the rectangle *becomes* the circle, no crossfade.
    const r = interpolate(
      frame,
      [GROW[0]!, GROW[1]!, CLOSE[0]!, CLOSE[0]! + 34],
      [14, 0, 0, WIDTH],
      {
        easing: Easing.inOut(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );

    // Centre: the card's image slot → frame centre → the mark's dot, so the
    // collapse lands on the dot instead of merely near it.
    const open = interpolate(frame, GROW, [0, 1], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const shut = interpolate(frame, CLOSE, [0, 1], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    const markFrame = frame - MARK_AT;
    shape.markFrame = markFrame >= 0 ? markFrame : null;

    const dot = markGeometryAt(Math.max(0, markFrame), {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      width: LOGO_W,
    }).dot;

    const startCx = CARD_IMAGE_X + CARD.imageWidth / 2;
    const startCy = CARD_IMAGE_Y + HANDOFF_IMAGE_H / 2;
    const midCx = startCx + (WIDTH / 2 - startCx) * open;
    const midCy = startCy + (HEIGHT / 2 - startCy) * open;
    const cx = midCx + (dot.x - midCx) * shut;
    const cy = midCy + (dot.y - midCy) * shut;

    shape.w = w;
    shape.h = h;
    shape.r = r;
    shape.x = cx - w / 2;
    shape.y = cy - h / 2;

    // The backgrounds come up behind the growing shape and are fully opaque by
    // the time it covers the frame; the brand haze then fades off again as the
    // punch-out takes over, leaving the mark as footage cut out of black.
    const covered = interpolate(frame, [GROW[0]!, GROW[1]!], [0, 1], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    base.opacity(covered);
    glow.opacity(
      covered *
        interpolate(frame, [CLOSE[0]!, CLOSE[0]! + 40], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
    );
  });
}
