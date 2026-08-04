import type Konva from "konva";

/**
 * Signed distance fields from an alpha channel.
 *
 * Why this exists: flames that follow a node's real silhouette need each pixel's
 * distance to the alpha edge, for the burn front, the char band and the outward
 * normal that tells fire which way is up. Estimating that inside the fragment
 * shader means sampling alpha radially — 16 angles x 8 radii is 128 texture
 * fetches per pixel, roughly 256M at 1080p, which is hundreds of milliseconds a
 * frame. Instead the field is built here on the CPU once per content version and
 * uploaded as a texture, so the shader does one lookup.
 *
 * Encoding: two independent 8-bit channels, each linearly interpolable on its
 * own. A 16-bit hi/lo split would interpolate to garbage across a hi-byte
 * transition and force NEAREST sampling, which a smooth field cannot afford.
 *
 * - **R** — near field, ±{@link NEAR_RANGE} px, ~0.125 px per step.
 * - **G** — far field, ±{@link FAR_RANGE} px, 2 px per step.
 *
 * Both store 128 at the silhouette edge, above 128 outside and below inside.
 * With 128 as the encoded zero the range is slightly asymmetric: the outside
 * direction saturates at `127/128` of the nominal range while the inside
 * direction reaches it exactly.
 *
 * Distances are exact euclidean, measured between pixel centres, so the first
 * pixel inside an edge reads about -1 rather than 0. That half-pixel bias is
 * immaterial at the scales these params work at. Exact rather than chamfer
 * because a chamfer metric puts visible straight edges at 45 degrees, which on a
 * round shape reads as a hexagon of fire.
 */

/** Near-field half-range, device px. */
export const NEAR_RANGE = 16;
/** Far-field half-range, device px. */
export const FAR_RANGE = 256;

/** Alpha at or above this counts as inside the silhouette. */
const INSIDE_ALPHA = 128;

const INF = 1e20;

/**
 * Felzenszwalb-Huttenlocher 1D squared distance transform: the lower envelope
 * of the parabolas rooted at each sample. Linear time, exact.
 */
function dt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    const fq = f[q] as number;
    let s =
      (fq + q * q - ((f[v[k] as number] as number) + (v[k] as number) * (v[k] as number))) /
      (2 * q - 2 * (v[k] as number));
    while (s <= (z[k] as number)) {
      k--;
      s =
        (fq + q * q - ((f[v[k] as number] as number) + (v[k] as number) * (v[k] as number))) /
        (2 * q - 2 * (v[k] as number));
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while ((z[k + 1] as number) < q) k++;
    const dx = q - (v[k] as number);
    d[q] = dx * dx + (f[v[k] as number] as number);
  }
}

/**
 * Exact euclidean distance in px from every pixel to the nearest seed, by
 * running {@link dt1d} down the columns and then across the rows. `seed[i] === 1`
 * marks a seed. O(n).
 */
function edt(seed: Uint8Array, w: number, h: number): Float64Array {
  const span = Math.max(w, h);
  const f = new Float64Array(span);
  const d = new Float64Array(span);
  const v = new Int32Array(span + 1);
  const z = new Float64Array(span + 1);
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = seed[i] === 1 ? 0 : INF;

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x] as number;
    dt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y] as number;
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = grid[row + x] as number;
    dt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[row + x] = Math.sqrt(d[x] as number);
  }
  return grid;
}

function encode(value: number, range: number): number {
  const scaled = 128 + (value / range) * 128;
  return Math.max(0, Math.min(255, Math.round(scaled)));
}

/**
 * Build the two-range signed distance field of `rgba`'s alpha channel, as RGBA
 * bytes ready to upload: R the near field, G the far field, B unused, A opaque.
 */
export function buildSdf(rgba: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const n = w * h;
  const insideSeed = new Uint8Array(n);
  const outsideSeed = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if ((rgba[i * 4 + 3] as number) >= INSIDE_ALPHA) insideSeed[i] = 1;
    else outsideSeed[i] = 1;
  }
  // Distance to the nearest inside pixel, and to the nearest outside one. The
  // signed field takes whichever applies to the pixel's own side.
  const dOut = edt(insideSeed, w, h);
  const dIn = edt(outsideSeed, w, h);

  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const signed = insideSeed[i] === 1 ? -(dIn[i] as number) : (dOut[i] as number);
    out[i * 4] = encode(signed, NEAR_RANGE);
    out[i * 4 + 1] = encode(signed, FAR_RANGE);
    out[i * 4 + 2] = 0;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Read the near field back in px — for tests and debugging. */
export function decodeNear(rgba: Uint8ClampedArray, w: number, x: number, y: number): number {
  return (((rgba[(y * w + x) * 4] as number) - 128) / 128) * NEAR_RANGE;
}

/** Read the far field back in px — for tests and debugging. */
export function decodeFar(rgba: Uint8ClampedArray, w: number, x: number, y: number): number {
  return (((rgba[(y * w + x) * 4 + 1] as number) - 128) / 128) * FAR_RANGE;
}

type CanvasImage = HTMLCanvasElement | OffscreenCanvas;

type Entry = {
  version: number;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
};

/**
 * One field per node, rebuilt only when its content changes.
 *
 * Keyed on the node and validated against `contentVersion` and the region size,
 * which is what keeps a burning title at a usable frame rate: the transform is
 * O(pixels) and would otherwise run every frame. `contentVersion` holds steady
 * while the node's pixels do, including while it moves.
 */
const cache = new WeakMap<Konva.Node, Entry>();

/**
 * The distance field of `capture`'s alpha, as a canvas ready to bind.
 *
 * `makeCanvas` supplies the surface: callers hand in a CPU-pinned one, because
 * reading pixels back from a GPU-rasterized skia canvas corrupts.
 */
export function sdfFor(
  node: Konva.Node,
  capture: CanvasImage,
  width: number,
  height: number,
  version: number,
  makeCanvas: () => HTMLCanvasElement,
): HTMLCanvasElement {
  const hit = cache.get(node);
  if (hit && hit.version === version && hit.width === width && hit.height === height) {
    return hit.canvas;
  }

  const source = capture.getContext("2d") as CanvasRenderingContext2D | null;
  const canvas = hit?.width === width && hit?.height === height ? hit.canvas : makeCanvas();
  const target = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (source && target) {
    const pixels = source.getImageData(0, 0, width, height);
    const field = buildSdf(pixels.data, width, height);
    const image = target.createImageData(width, height);
    image.data.set(field);
    target.putImageData(image, 0, 0);
  }
  cache.set(node, { version, width, height, canvas });
  return canvas;
}
