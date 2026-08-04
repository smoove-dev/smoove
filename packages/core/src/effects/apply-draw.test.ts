import Konva from "konva";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCompositorFactory } from "../gl/compositor.js";
import { initNodeEffects } from "./apply.js";
import type { EffectFrameContext, EffectPass, SmooveEffect } from "./contract.js";

/** An effect that floods the whole captured region with `color`. */
function flood(color: string, padding: SmooveEffect["padding"] = undefined): SmooveEffect {
  return {
    _fxEffect: true,
    enabled: () => true,
    padding,
    passes: (): EffectPass[] => [
      {
        kind: "composite",
        run: (ctx, fc) => {
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, fc.width, fc.height);
        },
      },
    ],
    attach: () => {},
    detach: () => {},
  };
}

function scene(pixelRatio = 1) {
  Konva.pixelRatio = pixelRatio;
  const stage = new Konva.Stage({ width: 100, height: 100 });
  const layer = new Konva.Layer();
  const rect = new Konva.Rect({ x: 20, y: 20, width: 40, height: 40, fill: "black" });
  stage.add(layer);
  layer.add(rect);
  return { stage, layer, rect };
}

/** Sample the layer canvas in DEVICE pixels. */
function pixelAt(layer: Konva.Layer, x: number, y: number): number[] {
  const ctx = layer.getCanvas().getContext() as unknown as {
    _context: CanvasRenderingContext2D;
  };
  const d = ctx._context.getImageData(x, y, 1, 1).data;
  return [d[0] as number, d[1] as number, d[2] as number, d[3] as number];
}

const RED = [255, 0, 0, 255];
const BLACK = [0, 0, 0, 255];
const CLEAR = [0, 0, 0, 0];

beforeEach(() => {
  Konva.pixelRatio = 1;
});

afterEach(() => {
  setCompositorFactory(null);
  vi.restoreAllMocks();
});

describe("initNodeEffects", () => {
  it("routes drawing through the chain", () => {
    const { layer, rect } = scene();
    rect.setAttr("effects", [flood("rgb(255,0,0)")]);
    initNodeEffects(rect);
    layer.draw();
    expect(pixelAt(layer, 40, 40)).toEqual(RED);
  });

  it("draws normally when the chain is empty", () => {
    const { layer, rect } = scene();
    rect.setAttr("effects", []);
    initNodeEffects(rect);
    layer.draw();
    expect(pixelAt(layer, 40, 40)).toEqual(BLACK);
  });

  it("draws normally when there is no effects attr at all", () => {
    const { layer, rect } = scene();
    initNodeEffects(rect);
    layer.draw();
    expect(pixelAt(layer, 40, 40)).toEqual(BLACK);
  });

  it("draws normally when every effect is disabled", () => {
    const { layer, rect } = scene();
    rect.setAttr("effects", [{ ...flood("rgb(255,0,0)"), enabled: () => false }]);
    initNodeEffects(rect);
    layer.draw();
    expect(pixelAt(layer, 40, 40)).toEqual(BLACK);
  });

  it("is idempotent — installing twice does not double-apply", () => {
    const { layer, rect } = scene();
    rect.setAttr("effects", [flood("rgb(255,0,0)")]);
    initNodeEffects(rect);
    initNodeEffects(rect);
    layer.draw();
    expect(pixelAt(layer, 40, 40)).toEqual(RED);
  });

  it("captures the node's own pixels before the passes run", () => {
    const { layer, rect } = scene();
    // source-atop clips to what was captured, so a hit proves the capture worked.
    const clipToContent: SmooveEffect = {
      ...flood("rgb(255,0,0)"),
      passes: (): EffectPass[] => [
        {
          kind: "composite",
          run: (ctx, fc) => {
            ctx.globalCompositeOperation = "source-atop";
            ctx.fillStyle = "rgb(255,0,0)";
            ctx.fillRect(0, 0, fc.width, fc.height);
          },
        },
      ],
    };
    rect.setAttr("effects", [clipToContent]);
    initNodeEffects(rect);
    layer.draw();
    expect(pixelAt(layer, 40, 40)).toEqual(RED);
    // Outside the rect nothing was captured, so source-atop left it clear.
    expect(pixelAt(layer, 5, 5)).toEqual(CLEAR);
  });

  it("paints outside the node's bbox when the effect pads", () => {
    const { layer, rect } = scene();
    rect.setAttr("effects", [flood("rgb(0,255,0)", () => 16)]);
    initNodeEffects(rect);
    layer.draw();
    // 8px above the rect's top edge: inside the padded region, outside the bbox.
    expect(pixelAt(layer, 40, 12)).toEqual([0, 255, 0, 255]);
  });

  it("honours per-side padding — pads up but not down", () => {
    const { layer, rect } = scene();
    rect.setAttr("effects", [
      flood("rgb(0,0,255)", () => ({ top: 18, right: 0, bottom: 0, left: 0 })),
    ]);
    initNodeEffects(rect);
    layer.draw();
    expect(pixelAt(layer, 40, 10)).toEqual([0, 0, 255, 255]);
    // Below the rect there is no padding, so nothing was painted.
    expect(pixelAt(layer, 40, 75)).toEqual(CLEAR);
  });

  it("asks each effect for its passes exactly once per draw", () => {
    const { layer, rect } = scene();
    const passes = vi.fn((fc: EffectFrameContext): EffectPass[] =>
      flood("rgb(255,0,0)").passes(fc),
    );
    rect.setAttr("effects", [{ ...flood("rgb(255,0,0)"), passes }]);
    initNodeEffects(rect);
    layer.draw();
    expect(passes).toHaveBeenCalledTimes(1);
  });

  it("hands passes a frame context sized to the captured region", () => {
    const { layer, rect } = scene();
    let seen: EffectFrameContext | null = null;
    rect.setAttr("effects", [
      {
        ...flood("rgb(255,0,0)"),
        passes: (fc): EffectPass[] => {
          seen = fc;
          return [];
        },
      },
    ]);
    initNodeEffects(rect);
    layer.draw();
    expect(seen).not.toBeNull();
    const fc = seen as unknown as EffectFrameContext;
    expect(fc.width).toBeGreaterThanOrEqual(40);
    expect(fc.height).toBeGreaterThanOrEqual(40);
    expect(fc.pixelRatio).toBe(1);
    expect(fc.time).toBe(fc.frame / fc.fps);
  });

  it("locates the node's own box inside the padded region", () => {
    const { layer, rect } = scene();
    let seen: EffectFrameContext | null = null;
    rect.setAttr("effects", [
      {
        ...flood("rgb(255,0,0)", () => 16),
        passes: (fc): EffectPass[] => {
          seen = fc;
          return [];
        },
      },
    ]);
    initNodeEffects(rect);
    layer.draw();
    const fc = seen as unknown as EffectFrameContext;
    // 40x40 at (20,20) padded by 16: the region starts at (4,4), so the node
    // sits 16 px in on both axes.
    expect(fc.contentRect).toEqual({ x: 16, y: 16, width: 40, height: 40 });
  });

  it("reports the node's box in device px at 2x", () => {
    const { layer, rect } = scene(2);
    let seen: EffectFrameContext | null = null;
    rect.setAttr("effects", [
      {
        ...flood("rgb(255,0,0)", () => 16),
        passes: (fc): EffectPass[] => {
          seen = fc;
          return [];
        },
      },
    ]);
    initNodeEffects(rect);
    layer.draw();
    const fc = seen as unknown as EffectFrameContext;
    expect(fc.contentRect).toEqual({ x: 32, y: 32, width: 80, height: 80 });
  });

  it("applies a css filter pass", () => {
    const { layer, rect } = scene();
    rect.setAttr("effects", [
      {
        ...flood("rgb(255,0,0)"),
        passes: (): EffectPass[] => [{ kind: "css", filter: "invert(1)" }],
      },
    ]);
    initNodeEffects(rect);
    layer.draw();
    // Inverting opaque black gives opaque white.
    expect(pixelAt(layer, 40, 40)).toEqual([255, 255, 255, 255]);
  });

  it("gives a pixels pass the captured bytes", () => {
    const { layer, rect } = scene();
    rect.setAttr("effects", [
      {
        ...flood("rgb(255,0,0)"),
        passes: (): EffectPass[] => [
          {
            kind: "pixels",
            run: (data) => {
              for (let i = 0; i < data.length; i += 4) {
                if ((data[i + 3] as number) > 0) {
                  data[i] = 255;
                  data[i + 1] = 0;
                  data[i + 2] = 0;
                }
              }
            },
          },
        ],
      },
    ]);
    initNodeEffects(rect);
    layer.draw();
    expect(pixelAt(layer, 40, 40)).toEqual(RED);
  });

  it("works at pixelRatio 2", () => {
    const { layer, rect } = scene(2);
    rect.setAttr("effects", [flood("rgb(255,0,0)")]);
    initNodeEffects(rect);
    layer.draw();
    // Rect centre is CSS (40,40) -> device (80,80).
    expect(pixelAt(layer, 80, 80)).toEqual(RED);
  });

  it("skips a shader pass when no GL platform exists, warning once", () => {
    const { layer, rect } = scene();
    setCompositorFactory(() => null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rect.setAttr("effects", [
      {
        ...flood("rgb(255,0,0)"),
        passes: (): EffectPass[] => [{ kind: "shader", fragment: "void main(){}", uniforms: {} }],
      },
    ]);
    initNodeEffects(rect);
    layer.draw();
    layer.draw();
    // The node still drew its own content, undistorted.
    expect(pixelAt(layer, 40, 40)).toEqual(BLACK);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
