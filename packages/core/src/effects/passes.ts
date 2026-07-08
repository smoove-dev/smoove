import type Konva from "konva";
import { Util } from "konva/lib/Util.js";
import { getEffectShaderRunner } from "../gl/effect-runner.js";
import type { EffectFrameContext, EffectPass } from "./contract.js";

/**
 * Pass groups after coalescing: consecutive `css` passes join into one native
 * filter string (one drawImage), consecutive `pixels` passes share one
 * getImageData/putImageData round trip. `composite` and `shader` stay 1:1.
 */
export type PassGroup =
  | { kind: "css"; filter: string }
  | { kind: "pixels"; runs: Array<(data: Uint8ClampedArray, w: number, h: number) => void> }
  | { kind: "composite"; run: (ctx: CanvasRenderingContext2D, fc: EffectFrameContext) => void }
  | { kind: "shader"; fragment: string; uniforms: Record<string, number | number[]> };

export function coalescePasses(passes: EffectPass[]): PassGroup[] {
  const groups: PassGroup[] = [];
  for (const p of passes) {
    const last = groups[groups.length - 1];
    if (p.kind === "css") {
      if (last?.kind === "css") last.filter += ` ${p.filter}`;
      else groups.push({ kind: "css", filter: p.filter });
    } else if (p.kind === "pixels") {
      if (last?.kind === "pixels") last.runs.push(p.run);
      else groups.push({ kind: "pixels", runs: [p.run] });
    } else if (p.kind === "composite") {
      groups.push({ kind: "composite", run: p.run });
    } else {
      groups.push({ kind: "shader", fragment: p.fragment, uniforms: p.uniforms });
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Work canvases. Two pooled canvases per owner (ping-pong for css/shader
// groups), created through an injectable factory so the server renderer can
// hand back GPU-rasterized skia canvases for pixel-free chains.

/** `gpu` is a HINT: true when the chain has no `pixels` pass (no readbacks). */
export type EffectCanvasFactory = (
  width: number,
  height: number,
  opts: { gpu: boolean },
) => HTMLCanvasElement;

let canvasFactory: EffectCanvasFactory | null = null;

/** Injected by server renderers; `null` restores the Konva default. */
export function setEffectCanvasFactory(f: EffectCanvasFactory | null): void {
  canvasFactory = f;
  workPools = new WeakMap();
}

function createWorkCanvas(width: number, height: number, gpu: boolean): HTMLCanvasElement {
  if (canvasFactory) return canvasFactory(width, height, { gpu });
  const c = Util.createCanvasElement();
  c.width = width;
  c.height = height;
  return c;
}

type WorkPool = { a: HTMLCanvasElement; b: HTMLCanvasElement; gpu: boolean };
let workPools = new WeakMap<Konva.Node, WorkPool>();

function getPool(owner: Konva.Node, width: number, height: number, gpu: boolean): WorkPool {
  let pool = workPools.get(owner);
  if (!pool || pool.gpu !== gpu || pool.a.width !== width || pool.a.height !== height) {
    pool = {
      a: createWorkCanvas(width, height, gpu),
      b: createWorkCanvas(width, height, gpu),
      gpu,
    };
    workPools.set(owner, pool);
  }
  return pool;
}

/** Drop an owner's pooled work canvases (effects removed / node destroyed). */
export function releaseWorkCanvases(owner: Konva.Node): void {
  workPools.delete(owner);
}

type Ctx2d = CanvasRenderingContext2D & { reset?(): void };

function ctx2d(canvas: HTMLCanvasElement, willRead: boolean): Ctx2d {
  return canvas.getContext("2d", willRead ? { willReadFrequently: true } : undefined) as Ctx2d;
}

/**
 * reset() where available: on skia this also truncates the recorded display
 * list — a plain clearRect leaves every past frame in the recording, and
 * replaying it makes downstream reads quadratically slower over a long render.
 */
function resetCtx(ctx: Ctx2d, width: number, height: number): void {
  if (ctx.reset) ctx.reset();
  else ctx.clearRect(0, 0, width, height);
}

let warnedNoGl = false;

/**
 * Execute a pass chain over `source` (a canvas holding the captured region at
 * `width`×`height` device px). Returns the canvas holding the result — which
 * is `source` itself when every pass was skipped (e.g. shader passes with no
 * GL platform). Never mutates `source`.
 */
export function runChain(
  source: HTMLCanvasElement,
  passes: EffectPass[],
  width: number,
  height: number,
  fc: EffectFrameContext,
  owner: Konva.Node,
): HTMLCanvasElement {
  const groups = coalescePasses(passes);
  const gpu = passes.every((p) => p.kind !== "pixels");
  const pool = getPool(owner, width, height, gpu);
  let current: HTMLCanvasElement = source;

  const nextTarget = (): HTMLCanvasElement => (current === pool.a ? pool.b : pool.a);

  for (const g of groups) {
    if (g.kind === "css") {
      const target = nextTarget();
      const tctx = ctx2d(target, !gpu);
      resetCtx(tctx, width, height);
      tctx.filter = g.filter;
      tctx.drawImage(current, 0, 0);
      tctx.filter = "none";
      current = target;
    } else if (g.kind === "pixels") {
      const sctx = ctx2d(current, true);
      const id = sctx.getImageData(0, 0, width, height);
      for (const run of g.runs) run(id.data, width, height);
      const target = current === source ? nextTarget() : current;
      const tctx = ctx2d(target, true);
      if (target !== current) resetCtx(tctx, width, height);
      tctx.putImageData(id, 0, 0);
      current = target;
    } else if (g.kind === "composite") {
      if (current === source) {
        const target = nextTarget();
        const tctx = ctx2d(target, !gpu);
        resetCtx(tctx, width, height);
        tctx.drawImage(current, 0, 0);
        current = target;
      }
      g.run(ctx2d(current, !gpu), fc);
    } else {
      const runner = getEffectShaderRunner();
      if (!runner) {
        if (!warnedNoGl) {
          warnedNoGl = true;
          console.warn(
            "[smoove] a shader effect pass was skipped — no GL platform is available. " +
              'In Node, install the optional `gl` package and import "@smoove/renderer/gl".',
          );
        }
        continue;
      }
      const out = runner.render(g.fragment, current, g.uniforms, fc.time, width, height);
      const target = nextTarget();
      const tctx = ctx2d(target, !gpu);
      resetCtx(tctx, width, height);
      tctx.drawImage(out as CanvasImageSource, 0, 0);
      current = target;
    }
  }
  return current;
}
