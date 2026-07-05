import type Konva from "konva";
import { getComposition } from "../engine/composition.js";
import {
  type EffectFrameContext,
  type EffectPass,
  getEffectRuntime,
  isKMEffect,
  type KMEffect,
} from "./contract.js";

/** Nodes currently being captured via `toCanvas` — guards drawScene re-entry. */
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

function enabledPasses(effects: KMEffect[], ctx: EffectFrameContext): EffectPass[] {
  const passes: EffectPass[] = [];
  for (const e of effects) {
    if (isKMEffect(e) && e.enabled()) passes.push(...e._kmPasses(ctx));
  }
  return passes;
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
    prev = next;
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
 * v1 renders the subtree in **stage space at pixelRatio 1** (spec: layer-space
 * tradeoff) — blur/glow can bleed anywhere on the layer and transforms are
 * trivial. Per-node bounding-box textures are a deferred optimization.
 */
export function drawNodeWithEffects(
  node: Konva.Node,
  can?: { isCache?: boolean; getContext(): Konva.Context },
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

  const width = stage.width();
  const height = stage.height();
  if (width <= 0 || height <= 0) return false;
  const ctx = effectFrameContext(stage, width, height, 1);
  const passes = enabledPasses(effects, ctx);
  if (passes.length === 0) return false;

  capturing.add(node);
  let captured: HTMLCanvasElement;
  try {
    // Stage-space capture: absolute transform + absolute opacity baked in.
    captured = node.toCanvas({ x: 0, y: 0, width, height, pixelRatio: 1 });
  } finally {
    capturing.delete(node);
  }

  const out = runtime.applyChain(captured, passes, width, height);
  if (!out) return false;

  // Current context transform here is the layer base (pixelRatio scale):
  // children apply their own absolute transform inside save/restore, so a
  // stage-space image drawn at (0,0) lands exactly.
  const context = canvas.getContext();
  context.save();
  context.drawImage(out, 0, 0, width, height);
  context.restore();
  return true;
}

/**
 * Post-pass for a Sequence (layer-wide effects): run the chain over the
 * layer's own canvas in device pixels and blit the result back.
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

  const out = runtime.applyChain(canvas._canvas, passes, w, h);
  if (!out) return false;

  const raw = canvas.getContext()._context;
  raw.save();
  raw.setTransform(1, 0, 0, 1, 0, 0);
  raw.clearRect(0, 0, w, h);
  raw.drawImage(out, 0, 0, w, h);
  raw.restore();
  return true;
}
