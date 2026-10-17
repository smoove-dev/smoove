import type Konva from "konva";

/**
 * Rounded-corner geometry, shared by everything that paints a box: `Image`'s
 * clip, and `Block`'s background and border.
 */

/**
 * CSS's corner-overflow rule (CSS Backgrounds 3, section 5.5): when the two
 * radii sharing an edge sum to more than that edge, every radius scales by the
 * smallest ratio needed to fit. Scaling all four rather than only the offender
 * is what keeps the silhouette proportional, and it is why `cornerRadius: 9999`
 * on a square yields a disc instead of a squircle.
 *
 * @internal exported for testing.
 */
export function clampCorners(r: number[], w: number, h: number): number[] {
  const [tl = 0, tr = 0, br = 0, bl = 0] = r;
  const ratio = (edge: number, a: number, b: number): number =>
    a + b > 0 ? edge / (a + b) : Number.POSITIVE_INFINITY;
  const f = Math.min(1, ratio(w, tl, tr), ratio(w, bl, br), ratio(h, tl, bl), ratio(h, tr, br));
  return f < 1 ? [tl * f, tr * f, br * f, bl * f] : [tl, tr, br, bl];
}

/** `cornerRadius` in any of its accepted forms, as `[tl, tr, br, bl]`. */
export function normalizeCorners(c: number | number[]): number[] {
  if (typeof c === "number") return [c, c, c, c];
  if (c.length === 1) return [c[0] ?? 0, c[0] ?? 0, c[0] ?? 0, c[0] ?? 0];
  if (c.length === 2) return [c[0] ?? 0, c[1] ?? 0, c[0] ?? 0, c[1] ?? 0];
  return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 0];
}

/** Trace a rounded rectangle. Leaves the path current — the caller fills or clips. */
export function roundRectPath(
  ctx: Konva.Context | CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number[],
): void {
  const [tl, tr, br, bl] = r;
  ctx.beginPath();
  ctx.moveTo(x + (tl ?? 0), y);
  ctx.lineTo(x + w - (tr ?? 0), y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + (tr ?? 0));
  ctx.lineTo(x + w, y + h - (br ?? 0));
  ctx.quadraticCurveTo(x + w, y + h, x + w - (br ?? 0), y + h);
  ctx.lineTo(x + (bl ?? 0), y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - (bl ?? 0));
  ctx.lineTo(x, y + (tl ?? 0));
  ctx.quadraticCurveTo(x, y, x + (tl ?? 0), y);
  ctx.closePath();
}
