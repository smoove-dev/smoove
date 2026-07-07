import type Konva from "konva";
import { SceneCanvas } from "konva/lib/Canvas.js";
import { Util } from "konva/lib/Util.js";
import { getComposition } from "../engine/composition.js";
import { getEnvironment } from "../engine/environment.js";
import {
  type EffectFrameContext,
  type EffectPass,
  isSmooveEffect,
  type SmooveEffect,
} from "./contract.js";
import { getContentVersion, trackEffected, untrackEffected } from "./dirty.js";
import { releaseWorkCanvases, runChain } from "./passes.js";

/** Nodes currently being captured via the capture canvas — guards drawScene re-entry. */
const capturing = new WeakSet<Konva.Node>();

let warnedKonvaFilters = false;

// ---------------------------------------------------------------------------
// Preview resolution cap. Effects are visually soft (blur, keying, distortion),
// so processing them at the display's full device pixelRatio wastes work: on a
// 2x display that is 4x the pixels for no perceptible gain, and pixel-bound
// effects (chromaKey's readback, shader readback) blow the frame budget. During
// playback we cap the effect capture/processing pixelRatio; server rendering
// (`isRendering`) always uses full resolution.
let previewMaxPixelRatio = 1;

/**
 * Set the maximum device pixelRatio effects capture/process at during preview
 * playback (default `1`). Higher = crisper effects, more per-frame cost on
 * high-DPI displays; lower = cheaper. Server renders ignore this and always run
 * at full resolution.
 */
export function setEffectPreviewMaxPixelRatio(pr: number): void {
  previewMaxPixelRatio = Math.max(0.25, pr);
}

/** Effective capture pixelRatio for a layer: full when rendering, capped in preview. */
function effectPixelRatio(stage: Konva.Stage, rawPixelRatio: number): number {
  if (getEnvironment(stage).isRendering) return rawPixelRatio;
  return Math.min(rawPixelRatio, previewMaxPixelRatio);
}

function effectFrameContext(
  stage: Konva.Stage,
  width: number,
  height: number,
  pixelRatio: number,
): EffectFrameContext {
  const comp = getComposition(stage);
  const frame = comp ? comp.frame.get() : 0;
  const fps = comp ? comp.fps : 30;
  return { frame, time: frame / fps, fps, width, height, pixelRatio };
}

function enabledPasses(effects: SmooveEffect[], fc: EffectFrameContext): EffectPass[] {
  const passes: EffectPass[] = [];
  for (const e of effects) {
    if (isSmooveEffect(e) && e.enabled()) passes.push(...e.passes(fc));
  }
  return passes;
}

// ---------------------------------------------------------------------------
// Pass fingerprint + output cache: when neither the captured content (see
// dirty.ts) nor any pass key changed, skip the whole chain and blit the
// previous output.

function fingerprint(passes: EffectPass[], relX: number, relY: number): string {
  // The relative content offset inside the region is constant (= padding)
  // while the region tracks the node freely, but changes when the region is
  // clamped at a stage edge — include it so a clamped node animating its
  // position doesn't serve stale pixels.
  let s = `${relX.toFixed(2)},${relY.toFixed(2)}`;
  for (const p of passes) s += `|${p.kind}:${p.key}`;
  return s;
}

type OutputCache = {
  version: number;
  fp: string;
  devW: number;
  devH: number;
  pixelRatio: number;
  canvas: HTMLCanvasElement;
};

const outputCache = new WeakMap<Konva.Node, OutputCache>();

/** Copy this frame's chain output into the node's cache canvas. */
function storeOutput(
  node: Konva.Node,
  prev: OutputCache | undefined,
  out: HTMLCanvasElement,
  version: number,
  fp: string,
  devW: number,
  devH: number,
  pixelRatio: number,
): void {
  let canvas = prev?.canvas;
  if (!canvas || canvas.width !== devW || canvas.height !== devH) {
    canvas = Util.createCanvasElement();
    canvas.width = devW;
    canvas.height = devH;
  }
  const ctx = canvas.getContext("2d") as (CanvasRenderingContext2D & { reset?(): void }) | null;
  if (!ctx) return;
  // reset(): on skia this also truncates the recorded display list — a plain
  // clearRect leaves every past frame in the recording and replaying it makes
  // downstream reads quadratically slower over a long render.
  if (ctx.reset) ctx.reset();
  else ctx.clearRect(0, 0, devW, devH);
  ctx.drawImage(out, 0, 0, devW, devH, 0, 0, devW, devH);
  outputCache.set(node, { version, fp, devW, devH, pixelRatio, canvas });
}

// ---------------------------------------------------------------------------
// Region capture. One pooled SceneCanvas per node (Konva's toCanvas allocates
// two fresh canvases per call), plus one shared grow-only buffer canvas for
// shapes that need buffered compositing.

const capturePool = new WeakMap<Konva.Node, SceneCanvas>();
let sharedBuffer: SceneCanvas | null = null;

function resetCanvas(sc: SceneCanvas): void {
  const raw = sc.getContext()._context as CanvasRenderingContext2D & { reset?(): void };
  if (raw.reset) {
    // Truncates skia's display list; wipes state incl. the pixelRatio scale
    // Konva bakes in at setSize — reapply it.
    raw.reset();
    raw.scale(sc.pixelRatio, sc.pixelRatio);
  } else {
    raw.save();
    raw.setTransform(1, 0, 0, 1, 0, 0);
    raw.clearRect(0, 0, sc.width, sc.height);
    raw.restore();
  }
}

function pooledSceneCanvas(
  pool: "node" | "buffer",
  node: Konva.Node,
  width: number,
  height: number,
  pixelRatio: number,
): SceneCanvas {
  let sc = pool === "node" ? capturePool.get(node) : sharedBuffer;
  if (!sc || sc.pixelRatio !== pixelRatio) {
    sc = new SceneCanvas({ width, height, pixelRatio });
  } else if (sc.width !== width * pixelRatio || sc.height !== height * pixelRatio) {
    if (pool === "buffer") {
      // grow-only: buffered shapes draw at absolute coords before the blit
      width = Math.max(width, sc.width / pixelRatio);
      height = Math.max(height, sc.height / pixelRatio);
      if (sc.width !== width * pixelRatio || sc.height !== height * pixelRatio) {
        sc.setSize(width, height);
      }
    } else {
      sc.setSize(width, height);
    }
  }
  if (pool === "node") capturePool.set(node, sc);
  else sharedBuffer = sc;
  return sc;
}

/**
 * Rasterize `node`'s subtree into the pooled capture canvas: stage-space
 * absolute transform and absolute opacity baked in, translated so stage point
 * `(x, y)` lands at the canvas origin. Same contract as `node.toCanvas()`
 * minus the two per-call canvas allocations.
 */
function captureRegion(
  node: Konva.Node,
  x: number,
  y: number,
  width: number,
  height: number,
  pixelRatio: number,
): HTMLCanvasElement {
  const sc = pooledSceneCanvas("node", node, width, height, pixelRatio);
  // Konva sizes the buffer canvas `region + |offset|` because buffered shapes
  // draw at absolute stage coords before being blitted into the translated
  // context (see Node._toKonvaCanvas).
  const buffer = pooledSceneCanvas(
    "buffer",
    node,
    width + Math.abs(x),
    height + Math.abs(y),
    pixelRatio,
  );
  resetCanvas(sc);
  resetCanvas(buffer);
  const context = sc.getContext();
  context.save();
  if (x || y) context.translate(-x, -y);
  capturing.add(node);
  try {
    node.drawScene(sc, undefined, buffer);
  } finally {
    capturing.delete(node);
  }
  context.restore();
  return sc._canvas;
}

/**
 * Wire a node constructed with `effects` in its config: run attach bookkeeping
 * now, keep it in sync on later `node.effects([...])` writes, and nudge users
 * off Konva's CPU filters.
 */
export function initNodeEffects(node: Konva.Node): void {
  let prev: SmooveEffect[] = [];
  const sync = () => {
    const next = ((node.getAttr("effects") as SmooveEffect[] | undefined) ?? []).filter(
      isSmooveEffect,
    );
    for (const e of prev) {
      if (!next.includes(e)) e.detach(node);
    }
    for (const e of next) {
      if (!prev.includes(e)) e.attach(node);
    }
    const had = prev.length > 0;
    prev = next;
    if (next.length > 0) {
      trackEffected(node);
    } else if (had) {
      untrackEffected(node);
      outputCache.delete(node);
      releaseWorkCanvases(node);
      layerScratch.delete(node);
    }
  };
  sync();
  node.on("effectsChange", sync);

  const warnFilters = () => {
    if (warnedKonvaFilters) return;
    warnedKonvaFilters = true;
    console.warn(
      "[smoove] Konva `filters`/`cache()` run a CPU pixel loop per frame — use `effects: [...]` from @smoove/effects instead.",
    );
  };
  if (node.getAttr("filters") !== undefined) warnFilters();
  node.on("filtersChange", warnFilters);
}

/**
 * Effected draw path for a node (Shape or Group). Returns `true` when it drew
 * the effect output (caller must skip the normal draw), `false` to fall back.
 *
 * Captures the node's client rect inflated by the effects' declared bleed, at
 * the layer's real pixelRatio — a 400×300 node with a 20 px blur processes a
 * fraction of a full-stage capture.
 */
export function drawNodeWithEffects(
  node: Konva.Node,
  can?: { isCache?: boolean; pixelRatio?: number; getContext(): Konva.Context },
): boolean {
  if (capturing.has(node)) return false;
  const effects = node.getAttr("effects") as SmooveEffect[] | undefined;
  if (!effects || effects.length === 0) return false;
  const stage = node.getStage();
  const layer = node.getLayer();
  if (!stage || !layer) return false;
  const canvas = can ?? layer.getCanvas();
  if (canvas.isCache) return false; // inside Konva cache() — stay out of its way

  const stageW = stage.width();
  const stageH = stage.height();
  if (stageW <= 0 || stageH <= 0) return false;

  const enabled = effects.filter((e) => isSmooveEffect(e) && e.enabled());
  if (enabled.length === 0) return false;
  const rect = node.getClientRect();

  const pixelRatio = effectPixelRatio(stage, canvas.pixelRatio ?? 1);
  const padCtx = effectFrameContext(stage, stageW, stageH, pixelRatio);
  let pad = 0;
  for (const e of enabled) pad += e.padding ? e.padding(padCtx) : 0;
  // Clamp to the stage inflated by the bleed: content further out than `pad`
  // can never influence a visible pixel.
  const x0 = Math.max(rect.x - pad, -pad);
  const y0 = Math.max(rect.y - pad, -pad);
  const x1 = Math.min(rect.x + rect.width + pad, stageW + pad);
  const y1 = Math.min(rect.y + rect.height + pad, stageH + pad);
  if (x1 <= x0 || y1 <= y0) return true; // node + bleed fully offscreen — draw nothing
  // Round device size up to 32-px buckets: stable canvas sizes under
  // animation (uv semantics need texture size == capture size exactly).
  const devW = Math.ceil((Math.ceil((x1 - x0) * pixelRatio) || 1) / 32) * 32;
  const devH = Math.ceil((Math.ceil((y1 - y0) * pixelRatio) || 1) / 32) * 32;

  const fc = effectFrameContext(stage, devW, devH, pixelRatio);
  const passes = enabledPasses(enabled, fc);
  if (passes.length === 0) return false;

  const width = devW / pixelRatio; // stage units drawn back
  const height = devH / pixelRatio;
  const version = getContentVersion(node);
  const fp = fingerprint(passes, rect.x - x0, rect.y - y0);
  const context = canvas.getContext();

  const cached = outputCache.get(node);
  if (
    cached &&
    cached.version === version &&
    cached.fp === fp &&
    cached.devW === devW &&
    cached.devH === devH &&
    cached.pixelRatio === pixelRatio
  ) {
    context.save();
    context.drawImage(cached.canvas, 0, 0, devW, devH, x0, y0, width, height);
    context.restore();
    return true;
  }

  const input = captureRegion(node, x0, y0, width, height, pixelRatio);
  const out = runChain(input, passes, devW, devH, fc, node);

  // Current context transform here is the layer base (pixelRatio scale):
  // children apply their own absolute transform inside save/restore, so a
  // stage-space rect drawn at (x0, y0) lands exactly.
  context.save();
  context.drawImage(out, 0, 0, devW, devH, x0, y0, width, height);
  context.restore();
  storeOutput(node, cached, out, version, fp, devW, devH, pixelRatio);
  return true;
}

// One pooled downscale buffer per layer: holds the layer content at the capped
// processing resolution when the preview cap is below the layer's real pr.
const layerScratch = new WeakMap<Konva.Node, HTMLCanvasElement>();

function pooledLayerScratch(layer: Konva.Node, w: number, h: number): HTMLCanvasElement {
  let c = layerScratch.get(layer);
  if (!c || c.width !== w || c.height !== h) {
    c = c ?? Util.createCanvasElement();
    c.width = w;
    c.height = h;
    layerScratch.set(layer, c);
  }
  return c;
}

/**
 * Post-pass for a Sequence (layer-wide effects): run the chain over the layer's
 * pixels and blit the result back. Skips the chain entirely (and blits the
 * cached output) while the layer's content version and every pass key are
 * unchanged — grain over a static scene costs one drawImage per frame.
 *
 * In preview, effects process at the capped pixelRatio (see
 * {@link effectPixelRatio}): the layer is downscaled into a scratch buffer,
 * the chain runs there, and the result is upscaled back — so a pixel-bound
 * effect like chromaKey reads a quarter of the pixels on a 2x display.
 */
export function applyLayerEffects(
  layer: Konva.Layer,
  can?: {
    isCache?: boolean;
    width: number;
    height: number;
    pixelRatio: number;
    getContext(): Konva.Context;
    _canvas: HTMLCanvasElement;
  },
): boolean {
  const effects = layer.getAttr("effects") as SmooveEffect[] | undefined;
  if (!effects || effects.length === 0) return false;
  const stage = layer.getStage();
  if (!stage) return false;
  const canvas = can ?? (layer.getCanvas() as unknown as NonNullable<typeof can>);
  if (!canvas || canvas.isCache) return false;
  const w = canvas.width; // full device px
  const h = canvas.height;
  if (w <= 0 || h <= 0) return false;

  // Processing resolution: the layer's full device size scaled by the preview
  // cap (identity when rendering or when the display is already <= the cap).
  const rawPr = canvas.pixelRatio ?? 1;
  const procPr = effectPixelRatio(stage, rawPr);
  const scale = procPr / rawPr; // <= 1
  const pw = scale < 1 ? Math.max(1, Math.round(w * scale)) : w;
  const ph = scale < 1 ? Math.max(1, Math.round(h * scale)) : h;

  const fc = effectFrameContext(stage, pw, ph, procPr);
  const passes = enabledPasses(effects, fc);
  if (passes.length === 0) return false;

  const raw = canvas.getContext()._context;
  const version = getContentVersion(layer);
  const fp = fingerprint(passes, 0, 0);
  const cached = outputCache.get(layer);
  if (
    cached &&
    cached.version === version &&
    cached.fp === fp &&
    cached.devW === pw &&
    cached.devH === ph
  ) {
    raw.save();
    raw.setTransform(1, 0, 0, 1, 0, 0);
    raw.clearRect(0, 0, w, h);
    raw.drawImage(cached.canvas, 0, 0, pw, ph, 0, 0, w, h);
    raw.restore();
    return true;
  }

  // Source at processing resolution: the layer canvas directly at full res, or
  // a downscaled copy when the cap kicks in.
  let src = canvas._canvas;
  if (scale < 1) {
    const scratch = pooledLayerScratch(layer, pw, ph);
    const sctx = scratch.getContext("2d", {
      willReadFrequently: true,
    }) as (CanvasRenderingContext2D & { reset?(): void }) | null;
    if (!sctx) return false;
    if (sctx.reset) sctx.reset();
    else sctx.clearRect(0, 0, pw, ph);
    sctx.drawImage(canvas._canvas, 0, 0, w, h, 0, 0, pw, ph);
    src = scratch;
  }

  const out = runChain(src, passes, pw, ph, fc, layer);
  if (out === src) return false; // every pass skipped — leave the layer as drawn

  raw.save();
  raw.setTransform(1, 0, 0, 1, 0, 0);
  raw.clearRect(0, 0, w, h);
  raw.drawImage(out, 0, 0, pw, ph, 0, 0, w, h);
  raw.restore();
  storeOutput(layer, cached, out, version, fp, pw, ph, procPr);
  return true;
}
