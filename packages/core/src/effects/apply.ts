import type Konva from "konva";
import { SceneCanvas } from "konva/lib/Canvas.js";
import { Util } from "konva/lib/Util.js";
import { getComposition } from "../engine/composition.js";
import {
  type EffectChainResult,
  type EffectFrameContext,
  type EffectPass,
  getEffectRuntime,
  isKMEffect,
  type KMEffect,
} from "./contract.js";
import { getContentVersion, trackEffected, untrackEffected } from "./dirty.js";

/** Nodes currently being captured via the capture canvas — guards drawScene re-entry. */
const capturing = new WeakSet<Konva.Node>();

let warnedNoRuntime = false;
let warnedKonvaFilters = false;

function warnNoRuntimeOnce(): void {
  if (warnedNoRuntime) return;
  warnedNoRuntime = true;
  console.warn(
    '[smoove] a node has `effects` but no effect runtime is registered — install @smoove/effects and construct at least one effect (or, on the server, import "@smoove/renderer/gl"). Drawing unfiltered.',
  );
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

// `u_time` is injected into every pass by @smoove/effects' paramsToUniforms.
// Fragments that never read it would still see a new uniform value each frame,
// which would defeat the pass fingerprint below — strip it for those.
const fragmentUsesTime = new Map<string, boolean>();

function enabledPasses(effects: KMEffect[], ctx: EffectFrameContext): EffectPass[] {
  const passes: EffectPass[] = [];
  for (const e of effects) {
    if (isKMEffect(e) && e.enabled()) passes.push(...e._kmPasses(ctx));
  }
  for (const p of passes) {
    let uses = fragmentUsesTime.get(p.fragment);
    if (uses === undefined) {
      uses = p.fragment.includes("u_time");
      fragmentUsesTime.set(p.fragment, uses);
    }
    if (!uses && "u_time" in p.uniforms) delete p.uniforms.u_time;
  }
  return passes;
}

/**
 * Accept results from older effect runtimes too: before the region-capture
 * work, `applyChain` returned a bare `CanvasImageSource` (exact-size canvas)
 * instead of `{ image, sx, sy }`. Peer-dep ranges allow a newer core with an
 * older @smoove/effects — normalize instead of silently drawing nothing.
 */
function normalizeChainResult(
  out: EffectChainResult | CanvasImageSource | null,
): EffectChainResult | null {
  if (!out) return null;
  if (typeof out === "object" && "image" in out) return out as EffectChainResult;
  return { image: out as CanvasImageSource, sx: 0, sy: 0 };
}

// ---------------------------------------------------------------------------
// Pass fingerprint + output cache: when neither the captured content (see
// dirty.ts) nor the uniform values changed, skip the whole GL chain and blit
// the previous output.

const fragmentIds = new Map<string, number>();

function fingerprint(passes: EffectPass[], relX: number, relY: number): string {
  // The relative content offset inside the region is constant (= padding)
  // while the region tracks the node freely, but changes when the region is
  // clamped at a stage edge — include it so a clamped node animating its
  // position doesn't serve stale pixels.
  let s = `${relX.toFixed(2)},${relY.toFixed(2)}`;
  for (const p of passes) {
    let id = fragmentIds.get(p.fragment);
    if (id === undefined) {
      id = fragmentIds.size;
      fragmentIds.set(p.fragment, id);
    }
    s += `|${id}:${JSON.stringify(p.uniforms)}`;
  }
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
  out: EffectChainResult,
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
  ctx.drawImage(out.image as CanvasImageSource, out.sx, out.sy, devW, devH, 0, 0, devW, devH);
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
 * off deprecated Konva CPU filters.
 */
export function initNodeEffects(node: Konva.Node): void {
  let prev: KMEffect[] = [];
  const sync = () => {
    const next = ((node.getAttr("effects") as KMEffect[] | undefined) ?? []).filter(isKMEffect);
    for (const e of prev) {
      if (!next.includes(e)) e._kmDetach(node);
    }
    for (const e of next) {
      if (!prev.includes(e)) e._kmAttach(node);
    }
    const had = prev.length > 0;
    prev = next;
    if (next.length > 0) {
      trackEffected(node);
    } else if (had) {
      untrackEffected(node);
      outputCache.delete(node);
      getEffectRuntime()?.releaseInput?.(node);
    }
  };
  sync();
  node.on("effectsChange", sync);

  const warnFilters = () => {
    if (warnedKonvaFilters) return;
    warnedKonvaFilters = true;
    console.warn(
      "[smoove] Konva `filters`/`cache()` are CPU-based and deprecated for smoove nodes — use `effects: [...]` from @smoove/effects instead.",
    );
  };
  if (node.getAttr("filters") !== undefined) warnFilters();
  node.on("filtersChange", warnFilters);
}

/**
 * Effected draw path for a node (Shape or Group). Returns `true` when it drew
 * the shader output (caller must skip the normal draw), `false` to fall back.
 *
 * Node-space chains (the default) capture the node's client rect inflated by
 * the effects' declared bleed, at the layer's real pixelRatio — a 400×300 node
 * with a 20 px blur processes ~0.15 MP instead of a 2 MP full stage. Chains
 * containing a stage-space effect (vignette-style) keep the full-stage capture
 * at pixelRatio 1, matching the pre-region behavior.
 */
export function drawNodeWithEffects(
  node: Konva.Node,
  can?: { isCache?: boolean; pixelRatio?: number; getContext(): Konva.Context },
): boolean {
  if (capturing.has(node)) return false;
  const effects = node.getAttr("effects") as KMEffect[] | undefined;
  if (!effects || effects.length === 0) return false;
  const runtime = getEffectRuntime();
  if (!runtime) {
    warnNoRuntimeOnce();
    return false;
  }
  const stage = node.getStage();
  const layer = node.getLayer();
  if (!stage || !layer) return false;
  const canvas = can ?? layer.getCanvas();
  if (canvas.isCache) return false; // inside Konva cache() — stay out of its way

  const stageW = stage.width();
  const stageH = stage.height();
  if (stageW <= 0 || stageH <= 0) return false;

  const enabled = effects.filter((e) => isKMEffect(e) && e.enabled());
  if (enabled.length === 0) return false;
  const stageSpace = enabled.some((e) => e._kmSpace === "stage");
  const rect = node.getClientRect();

  // Capture region (stage units) + device pixel size.
  let pixelRatio: number;
  let x0: number;
  let y0: number;
  let devW: number;
  let devH: number;
  if (stageSpace) {
    pixelRatio = 1;
    x0 = 0;
    y0 = 0;
    devW = stageW;
    devH = stageH;
  } else {
    pixelRatio = canvas.pixelRatio ?? 1;
    const padCtx = effectFrameContext(stage, stageW, stageH, pixelRatio);
    let pad = 0;
    for (const e of enabled) pad += e._kmPadding ? e._kmPadding(padCtx) : 0;
    // Clamp to the stage inflated by the bleed: content further out than `pad`
    // can never influence a visible pixel.
    x0 = Math.max(rect.x - pad, -pad);
    y0 = Math.max(rect.y - pad, -pad);
    const x1 = Math.min(rect.x + rect.width + pad, stageW + pad);
    const y1 = Math.min(rect.y + rect.height + pad, stageH + pad);
    if (x1 <= x0 || y1 <= y0) return true; // node + bleed fully offscreen — draw nothing
    // Round device size up to 32-px buckets: stable texture/FBO sizes under
    // animation (uv semantics need texture size == capture size exactly).
    devW = Math.ceil((Math.ceil((x1 - x0) * pixelRatio) || 1) / 32) * 32;
    devH = Math.ceil((Math.ceil((y1 - y0) * pixelRatio) || 1) / 32) * 32;
  }

  const ctx = effectFrameContext(stage, devW, devH, pixelRatio);
  const passes = enabledPasses(enabled, ctx);
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

  // Lazy capture: the runtime resolves it only when it can't reuse the
  // node's uploaded texture (content version unchanged → capture skipped too).
  // Older runtimes (no releaseInput) can't take a thunk — capture eagerly.
  const capture = () => captureRegion(node, x0, y0, width, height, pixelRatio);
  const input = typeof runtime.releaseInput === "function" ? capture : capture();
  const out = normalizeChainResult(
    runtime.applyChain(input, passes, devW, devH, {
      cacheKey: node,
      contentVersion: version,
    }),
  );
  if (!out) return false;

  // Current context transform here is the layer base (pixelRatio scale):
  // children apply their own absolute transform inside save/restore, so a
  // stage-space rect drawn at (x0, y0) lands exactly.
  context.save();
  context.drawImage(
    out.image as CanvasImageSource,
    out.sx,
    out.sy,
    devW,
    devH,
    x0,
    y0,
    width,
    height,
  );
  context.restore();
  storeOutput(node, cached, out, version, fp, devW, devH, pixelRatio);
  return true;
}

/**
 * Post-pass for a Sequence (layer-wide effects): run the chain over the
 * layer's own canvas in device pixels and blit the result back. Skips the GL
 * chain entirely (and blits the cached output) while the layer's content
 * version and the pass uniforms are unchanged — film grain over a static
 * scene costs one drawImage per frame.
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
  const effects = layer.getAttr("effects") as KMEffect[] | undefined;
  if (!effects || effects.length === 0) return false;
  const runtime = getEffectRuntime();
  if (!runtime) {
    warnNoRuntimeOnce();
    return false;
  }
  const stage = layer.getStage();
  if (!stage) return false;
  const canvas = can ?? (layer.getCanvas() as unknown as NonNullable<typeof can>);
  if (!canvas || canvas.isCache) return false;
  const w = canvas.width; // device px
  const h = canvas.height;
  if (w <= 0 || h <= 0) return false;
  const ctx = effectFrameContext(stage, w, h, canvas.pixelRatio ?? 1);
  const passes = enabledPasses(effects, ctx);
  if (passes.length === 0) return false;

  const raw = canvas.getContext()._context;
  const version = getContentVersion(layer);
  const fp = fingerprint(passes, 0, 0);
  const cached = outputCache.get(layer);
  if (
    cached &&
    cached.version === version &&
    cached.fp === fp &&
    cached.devW === w &&
    cached.devH === h
  ) {
    raw.save();
    raw.setTransform(1, 0, 0, 1, 0, 0);
    raw.clearRect(0, 0, w, h);
    raw.drawImage(cached.canvas, 0, 0, w, h, 0, 0, w, h);
    raw.restore();
    return true;
  }

  const out = normalizeChainResult(
    runtime.applyChain(canvas._canvas, passes, w, h, {
      cacheKey: layer,
      contentVersion: version,
    }),
  );
  if (!out) return false;

  raw.save();
  raw.setTransform(1, 0, 0, 1, 0, 0);
  raw.clearRect(0, 0, w, h);
  raw.drawImage(out.image as CanvasImageSource, out.sx, out.sy, w, h, 0, 0, w, h);
  raw.restore();
  storeOutput(layer, cached, out, version, fp, w, h, canvas.pixelRatio ?? 1);
  return true;
}
