import Konva from "konva";
import { SceneCanvas } from "konva/lib/Canvas.js";
import { Factory } from "konva/lib/Factory.js";
import { getCompositor } from "../gl/compositor.js";
import {
  type EffectFrameContext,
  type EffectPaddingBox,
  type EffectPass,
  type EffectRect,
  isSmooveEffect,
  maxPadding,
  normalizePadding,
  type SmooveEffect,
} from "./contract.js";
import { contentVersion, withDerivedWrites } from "./dirty.js";

/*
 * Konva's `drawScene` is not a documented extension point, so the facts this
 * file depends on were established by probing Konva 10.3 under the skia
 * backend rather than assumed:
 *
 * - Signature is `drawScene(can: SceneCanvas, top?, bufferCanvas?)`, called
 *   once per `layer.draw()`. Extra draws are possible, so the path is
 *   idempotent rather than counted.
 * - `can.getContext()` is a Konva `SceneContext`; the raw
 *   `CanvasRenderingContext2D` is at `._context`.
 * - At entry the context is in LAYER space, not node-local: Konva applies the
 *   node's own transform inside `drawScene`. Its base transform is
 *   `scale(pixelRatio)` (from Konva's `Context.reset()`), so at pixelRatio 2
 *   the transform reads a=2, d=2.
 * - `getClientRect({ relativeTo: layer })` returns CSS px, independent of
 *   pixelRatio.
 *
 * Consequences, both verified end-to-end at pixelRatio 2:
 * - Capture: `ctx.reset()` (identity + scale(pr)) then
 *   `translate(-region.x / pr, -region.y / pr)`, since the region is device px
 *   and Konva draws in CSS px.
 * - Blit: reset to identity and draw at device-px coords.
 */

/**
 * Capture sizes snap to this many device px.
 *
 * Without bucketing, a node with an animated size would reallocate its pooled
 * canvas — and its GPU texture — on every frame.
 */
const BUCKET = 32;

export type Rect = EffectRect;

/**
 * The device-pixel region to capture for an effect chain: the node's CSS-px
 * bounding box grown by per-side padding, scaled by `pixelRatio`, with the size
 * rounded up to {@link BUCKET} buckets and the origin floored to a whole pixel.
 */
export function captureRegion(bbox: Rect, pad: EffectPaddingBox, pixelRatio: number): Rect {
  const x = (bbox.x - pad.left) * pixelRatio;
  const y = (bbox.y - pad.top) * pixelRatio;
  const w = (bbox.width + pad.left + pad.right) * pixelRatio;
  const h = (bbox.height + pad.top + pad.bottom) * pixelRatio;
  return {
    x: Math.floor(x),
    y: Math.floor(y),
    width: Math.max(BUCKET, Math.ceil(w / BUCKET) * BUCKET),
    height: Math.max(BUCKET, Math.ceil(h / BUCKET) * BUCKET),
  };
}

export type PassGroup =
  | { kind: "css"; filter: string }
  | { kind: "pixels"; passes: Extract<EffectPass, { kind: "pixels" }>[] }
  | { kind: "composite"; passes: Extract<EffectPass, { kind: "composite" }>[] }
  | { kind: "shader"; passes: Extract<EffectPass, { kind: "shader" }>[] };

/**
 * Group a flat pass list so consecutive same-kind passes share one round trip:
 * `css` passes join into a single `ctx.filter` string and one `drawImage`;
 * `pixels` passes share one `getImageData`/`putImageData` pair.
 *
 * Order across kinds is always preserved, because effect order is semantic —
 * keying then blurring is not the same picture as blurring then keying.
 */
export function coalesce(passes: readonly EffectPass[]): PassGroup[] {
  const groups: PassGroup[] = [];
  for (const pass of passes) {
    const last = groups[groups.length - 1];
    if (pass.kind === "css") {
      if (last?.kind === "css") last.filter = `${last.filter} ${pass.filter}`;
      else groups.push({ kind: "css", filter: pass.filter });
    } else if (last?.kind === pass.kind) {
      (last.passes as EffectPass[]).push(pass);
    } else {
      groups.push({ kind: pass.kind, passes: [pass] } as PassGroup);
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Node interception
// ---------------------------------------------------------------------------

const ORIGINAL = Symbol("smoove.fx.drawScene");
const DRAWING = Symbol("smoove.fx.drawing");
const WARNED = Symbol("smoove.fx.warnedNoGl");
const ATTACHED = Symbol("smoove.fx.attached");

/**
 * Add the `effects` attribute to every Konva node, so a chain reads and writes
 * like any other Konva property — `title.effects([fire])`, `title.effects()`,
 * or `new Text({ effects: [fire] })`.
 *
 * Installed on `Konva.Node` rather than on smoove's own classes because effects
 * apply to anything drawable, including a raw Konva shape.
 */
Factory.addGetterSetter(Konva.Node, "effects");

declare module "konva/lib/Node" {
  interface Node {
    /** The effect chain applied to this node when it draws. */
    effects(): SmooveEffect[] | undefined;
    effects(value: SmooveEffect[]): this;
  }
}

type SceneCanvasLike = InstanceType<typeof SceneCanvas>;
type RawContext = CanvasRenderingContext2D & { reset?: () => void };
type DrawScene = (can?: unknown, top?: unknown, bufferCanvas?: unknown) => void;

type Hooked = Konva.Node & {
  [ORIGINAL]?: DrawScene;
  [DRAWING]?: boolean;
  [WARNED]?: boolean;
  [ATTACHED]?: Set<SmooveEffect>;
};

/**
 * Keep each effect's attach/detach lifecycle in step with the node's current
 * chain, so an effect always knows its owners — including when an updater swaps
 * the chain mid-timeline.
 */
function syncAttachments(node: Konva.Node, chain: readonly SmooveEffect[]): void {
  const hooked = node as Hooked;
  let attached = hooked[ATTACHED];
  if (!attached) {
    attached = new Set();
    hooked[ATTACHED] = attached;
  }
  for (const effect of chain) {
    if (!attached.has(effect)) {
      effect.attach(node);
      attached.add(effect);
    }
  }
  if (attached.size === chain.length) return;
  const current = new Set(chain);
  for (const effect of attached) {
    if (!current.has(effect)) {
      effect.detach(node);
      attached.delete(effect);
    }
  }
}

/**
 * Force a surface onto the CPU rasterizer when the chain will read it back.
 *
 * skia-canvas surfaces default to GPU, and reading pixels back from a
 * GPU-rasterized skia canvas is what corrupted output under the old GL interop
 * loop. Both `pixels` passes (`getImageData`) and `shader` passes (the
 * platform's `uploadScene` does a full `getImageData`) are readbacks, so a chain
 * containing either is pinned. A `css`/`composite`-only chain never reads back
 * and keeps the GPU rasterizer, which measured ~13x faster for blur.
 *
 * Duck-typed: browsers have no `gpu` property, so this is a no-op there.
 */
function pinToCpu(canvas: SceneCanvasLike): void {
  const native = canvas._canvas as unknown as { gpu?: boolean };
  if (typeof native.gpu === "boolean") native.gpu = false;
}

/** True when any group in the chain reads the working canvas back. */
function needsReadback(groups: readonly PassGroup[]): boolean {
  return groups.some((group) => group.kind === "pixels" || group.kind === "shader");
}

/** Pooled work canvases keyed by device size, pixelRatio and rasterizer. */
const pool = new Map<string, SceneCanvasLike>();

function workCanvas(
  width: number,
  height: number,
  pixelRatio: number,
  cpuOnly: boolean,
): SceneCanvasLike {
  // The rasterizer is part of the key: a pooled GPU canvas must never be handed
  // to a chain that reads pixels back.
  const key = `${width}x${height}@${pixelRatio}${cpuOnly ? ":cpu" : ""}`;
  let canvas = pool.get(key);
  if (!canvas) {
    canvas = new SceneCanvas({
      width: width / pixelRatio,
      height: height / pixelRatio,
      pixelRatio,
    });
    if (cpuOnly) pinToCpu(canvas);
    pool.set(key, canvas);
  }
  return canvas;
}

function rawOf(canvas: SceneCanvasLike): RawContext {
  return (canvas.getContext() as unknown as { _context: RawContext })._context;
}

/**
 * Truncate a pooled canvas back to empty.
 *
 * `reset()` is preferred over `clearRect` because skia-canvas accumulates a
 * display list that `clearRect` only appends to — long-lived pooled canvases
 * would otherwise replay their entire history on every pixel read (see
 * `doc/effects-performance-research.md`, S0).
 */
function truncate(raw: RawContext, width: number, height: number): void {
  if (typeof raw.reset === "function") {
    raw.reset();
    return;
  }
  raw.setTransform(1, 0, 0, 1, 0, 0);
  raw.clearRect(0, 0, width, height);
}

/**
 * Frame state for `node`, found by walking up to the nearest Sequence and
 * Composition. Duck-typed rather than imported: `core/src/engine` participates
 * in an import cycle that this file must stay out of.
 */
function frameStateOf(node: Konva.Node): { frame: number; fps: number } {
  let frame: number | null = null;
  let fps: number | null = null;
  let current: Konva.Node | null = node;
  while (current && (frame === null || fps === null)) {
    const c = current as unknown as {
      _kmLiveLocal?: () => number | null;
      fps?: number;
    };
    if (frame === null && typeof c._kmLiveLocal === "function") frame = c._kmLiveLocal();
    if (fps === null && typeof c.fps === "number") fps = c.fps;
    current = current.getParent() as Konva.Node | null;
  }
  return { frame: frame ?? 0, fps: fps ?? 30 };
}

function chainOf(node: Konva.Node): SmooveEffect[] {
  const raw = node.getAttr("effects") as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSmooveEffect).filter((effect) => effect.enabled());
}

/**
 * Route `node`'s scene drawing through its effect chain.
 *
 * Idempotent. A node whose `effects` attr is missing, empty, or fully disabled
 * draws through the original path with no capture at all, so installing the
 * hook costs nothing until an effect is actually enabled.
 */
export function initNodeEffects(node: Konva.Node): void {
  const hooked = node as Hooked;
  if (hooked[ORIGINAL]) return;

  const target = node as unknown as { drawScene: DrawScene };
  const original: DrawScene = target.drawScene.bind(node);
  hooked[ORIGINAL] = original;

  target.drawScene = (can?: unknown, top?: unknown, bufferCanvas?: unknown) => {
    // Capturing calls the original drawScene; it must not re-enter the chain.
    if (hooked[DRAWING]) return original(can, top, bufferCanvas);
    const chain = chainOf(node);
    if (chain.length === 0) return original(can, top, bufferCanvas);
    hooked[DRAWING] = true;
    try {
      drawNodeWithEffects(node, chain, can as SceneCanvasLike, top, bufferCanvas);
    } finally {
      hooked[DRAWING] = false;
    }
  };
}

/** Restore `node`'s original drawing path. */
export function disposeNodeEffects(node: Konva.Node): void {
  const hooked = node as Hooked;
  const original = hooked[ORIGINAL];
  if (!original) return;
  const target = node as unknown as { drawScene: DrawScene };
  target.drawScene = original;
  delete hooked[ORIGINAL];
}

function drawNodeWithEffects(
  node: Konva.Node,
  chain: SmooveEffect[],
  destination: SceneCanvasLike,
  top: unknown,
  bufferCanvas: unknown,
): void {
  const hooked = node as Hooked;
  const original = hooked[ORIGINAL];
  const layer = node.getLayer();
  if (!original || !layer || !destination || typeof destination.getContext !== "function") {
    original?.(destination, top, bufferCanvas);
    return;
  }

  syncAttachments(node, chain);

  const pixelRatio = destination.getPixelRatio();
  const bbox = node.getClientRect({ relativeTo: layer as unknown as Konva.Container });
  const { frame, fps } = frameStateOf(node);
  const version = contentVersion(node);

  // padding() is asked first, so it sees the unpadded region size. Effects that
  // need the final size read it from the fc handed to passes().
  const boxWidth = Math.max(1, Math.round(bbox.width * pixelRatio));
  const boxHeight = Math.max(1, Math.round(bbox.height * pixelRatio));
  const probe: EffectFrameContext = {
    frame,
    time: frame / fps,
    fps,
    width: boxWidth,
    height: boxHeight,
    contentRect: { x: 0, y: 0, width: boxWidth, height: boxHeight },
    pixelRatio,
    node,
    contentVersion: version,
  };
  const padding = maxPadding(chain.map((effect) => normalizePadding(effect.padding?.(probe))));
  const region = captureRegion(bbox, padding, pixelRatio);

  const fc: EffectFrameContext = {
    frame,
    time: frame / fps,
    fps,
    width: region.width,
    height: region.height,
    // Where the node itself sits inside that region. The region's origin is
    // floored to a whole device px and its size rounded up to a bucket, so this
    // is not simply the padding back again.
    contentRect: {
      x: bbox.x * pixelRatio - region.x,
      y: bbox.y * pixelRatio - region.y,
      width: bbox.width * pixelRatio,
      height: bbox.height * pixelRatio,
    },
    pixelRatio,
    node,
    contentVersion: version,
  };

  // Passes are asked for before the canvas is made: whether the chain reads
  // pixels back decides which rasterizer the surface must use.
  const groups = coalesce(chain.flatMap((effect) => effect.passes(fc)));
  const work = workCanvas(region.width, region.height, pixelRatio, needsReadback(groups));
  const raw = rawOf(work);
  truncate(raw, region.width, region.height);

  // Capture: Konva draws in CSS px, the region is device px.
  //
  // Wrapped in withDerivedWrites because drawing is not a content change:
  // painting a `Block` re-writes its private background fill, which would
  // invalidate the node every time we captured it and defeat every cache.
  const konvaCtx = work.getContext();
  konvaCtx.reset();
  konvaCtx.translate(-region.x / pixelRatio, -region.y / pixelRatio);
  withDerivedWrites(() => original(work, top, bufferCanvas));

  runGroups(groups, work, node, fc);

  const destinationRaw = rawOf(destination);
  destinationRaw.save();
  destinationRaw.setTransform(1, 0, 0, 1, 0, 0);
  destinationRaw.drawImage(work._canvas as unknown as CanvasImageSource, region.x, region.y);
  destinationRaw.restore();
}

/** Scratch canvas for `css` groups, which need a second surface to filter into. */
const filterPool = new Map<string, SceneCanvasLike>();

function filterCanvas(width: number, height: number, pixelRatio: number): SceneCanvasLike {
  const key = `${width}x${height}@${pixelRatio}`;
  let canvas = filterPool.get(key);
  if (!canvas) {
    canvas = new SceneCanvas({
      width: width / pixelRatio,
      height: height / pixelRatio,
      pixelRatio,
    });
    filterPool.set(key, canvas);
  }
  return canvas;
}

/**
 * A CPU-pinned surface for an effect that derives data from the capture (a
 * distance field, an outline). Kept separate from the working canvas so that
 * derivation never reads back a GPU-rasterized skia surface.
 */
export function createCpuCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = Konva.Util.createCanvasElement();
  const native = canvas as unknown as { gpu?: boolean };
  if (typeof native.gpu === "boolean") native.gpu = false;
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function runGroups(
  groups: PassGroup[],
  work: SceneCanvasLike,
  node: Konva.Node,
  fc: EffectFrameContext,
): void {
  const raw = rawOf(work);
  for (const group of groups) {
    // Every group works in device px with no inherited transform.
    raw.save();
    raw.setTransform(1, 0, 0, 1, 0, 0);
    raw.globalCompositeOperation = "source-over";
    raw.filter = "none";

    if (group.kind === "css") {
      const scratch = filterCanvas(fc.width, fc.height, fc.pixelRatio);
      const scratchRaw = rawOf(scratch);
      truncate(scratchRaw, fc.width, fc.height);
      scratchRaw.save();
      scratchRaw.setTransform(1, 0, 0, 1, 0, 0);
      scratchRaw.filter = group.filter;
      scratchRaw.drawImage(work._canvas as unknown as CanvasImageSource, 0, 0);
      scratchRaw.restore();
      raw.clearRect(0, 0, fc.width, fc.height);
      raw.drawImage(scratch._canvas as unknown as CanvasImageSource, 0, 0);
    } else if (group.kind === "pixels") {
      const image = raw.getImageData(0, 0, fc.width, fc.height);
      for (const pass of group.passes) pass.run(image.data, fc.width, fc.height);
      raw.putImageData(image, 0, 0);
    } else if (group.kind === "composite") {
      for (const pass of group.passes) pass.run(raw, fc);
    } else {
      runShaderGroup(group, work, raw, node, fc);
    }

    raw.restore();
  }
}

function runShaderGroup(
  group: Extract<PassGroup, { kind: "shader" }>,
  work: SceneCanvasLike,
  raw: RawContext,
  node: Konva.Node,
  fc: EffectFrameContext,
): void {
  const compositor = getCompositor();
  if (!compositor) {
    const hooked = node as Hooked;
    if (!hooked[WARNED]) {
      hooked[WARNED] = true;
      console.warn(
        "smoove: an effect needs a WebGL platform, which is unavailable here — " +
          "its shader passes are skipped and the node draws undistorted.",
      );
    }
    return;
  }
  for (const pass of group.passes) {
    const source = work._canvas as unknown as HTMLCanvasElement;
    const extra = pass.textures?.(fc, source) ?? [];
    const result = compositor.renderPass(
      pass.fragment,
      [work._canvas as unknown as HTMLCanvasElement, ...extra],
      pass.uniforms,
      fc.width,
      fc.height,
    );
    // The platform reuses its result buffer, so draw it back immediately.
    raw.clearRect(0, 0, fc.width, fc.height);
    raw.drawImage(result, 0, 0);
  }
}
