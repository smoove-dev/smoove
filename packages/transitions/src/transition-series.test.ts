import { Composition } from "@smoove/core";
import Konva from "konva";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type GlCompositor, setCompositorFactory } from "./gl/compositor.js";
import { fade } from "./presentations/fade.js";
import { zoomBlur } from "./presentations/zoom-blur.js";
import { linearTiming } from "./timings/linear-timing.js";
import { TransitionSeries } from "./transition-series.js";

// A no-op compositor. These tests assert the layer *visibility contract* of a
// Tier B transition, which is independent of the blended pixels, so `render()`
// just hands back a blank canvas for the overlay image. Installing it makes
// `getCompositor()` return non-null so the GL path runs headlessly (real WebGL
// is unavailable in Node).
function stubCompositor(): GlCompositor {
  return {
    render: () => Konva.Util.createCanvasElement(),
  } as unknown as GlCompositor;
}

let n = 0;
function makeComp(): Composition {
  n += 1;
  return new Composition({
    id: `ts-t${n}`,
    fps: 30,
    durationInFrames: 300,
    width: 100,
    height: 100,
  });
}

function rect(name: string): Konva.Rect {
  return new Konva.Rect({ name, x: 0, y: 0, width: 100, height: 100, fill: "#fff" });
}

/**
 * Two 60-frame scenes joined by a 10-frame transition. The transition overlaps
 * the outgoing scene's tail and the incoming scene's head, so:
 *   scene A: [0, 60)   scene B: [50, 110)   overlap/overlay: [50, 60)
 */
function buildSeries(comp: Composition, presentation: () => ReturnType<typeof zoomBlur>) {
  const series = new TransitionSeries({ composition: comp, from: 0 });
  series.scene({ durationInFrames: 60, name: "a" }, (seq) => seq.add(rect("rectA")));
  series.transition({
    presentation: presentation(),
    timing: linearTiming({ durationInFrames: 10 }),
  });
  series.scene({ durationInFrames: 60, name: "b" }, (seq) => seq.add(rect("rectB")));
  comp.add(series);

  const layers = comp.getLayers();
  const layerA = layers.find((l) => l.findOne(".rectA"));
  const layerB = layers.find((l) => l.findOne(".rectB"));
  const overlay = layers.find((l) => l.getChildren()[0] instanceof Konva.Image);
  if (!layerA || !layerB) throw new Error("scene layers not found");
  return { comp, layerA, layerB, overlay };
}

describe("TransitionSeries — Tier B (GL) scene visibility", () => {
  beforeEach(() => setCompositorFactory(stubCompositor));
  afterEach(() => setCompositorFactory(null));

  it("creates a GL overlay sequence for the transition", () => {
    const { overlay } = buildSeries(makeComp(), zoomBlur);
    expect(overlay).toBeDefined();
    expect(overlay?.getChildren()[0]).toBeInstanceOf(Konva.Image);
  });

  it("hides both participating scene layers during the overlap so only the overlay paints", () => {
    // Regression: the raw scene layers used to keep painting at full opacity
    // under a not-fully-opaque overlay, so the incoming scene bled through from
    // the overlap's first frame and the outgoing scene lingered on its last.
    const { comp, layerA, layerB, overlay } = buildSeries(makeComp(), zoomBlur);

    comp.setFrame(55); // inside the overlap [50, 60)
    expect(layerA.visible()).toBe(false);
    expect(layerB.visible()).toBe(false);
    expect(overlay?.visible()).toBe(true);
    // The overlay actually captured + composited (its image was set).
    expect((overlay?.getChildren()[0] as Konva.Image).image()).toBeTruthy();
  });

  it("re-shows the incoming scene once the overlap ends", () => {
    const { comp, layerA, layerB, overlay } = buildSeries(makeComp(), zoomBlur);

    comp.setFrame(70); // past the overlap; only scene B is live
    expect(layerB.visible()).toBe(true);
    expect(layerA.visible()).toBe(false); // scene A ended at 60
    expect(overlay?.visible()).toBe(false); // overlay window [50, 60) is closed
  });

  it("draws the incoming scene synchronously on the frame it is revealed", () => {
    // The overlay hid the incoming layer through the overlap, freezing its own
    // canvas. On the first frame past the overlap it is shown again — draw it
    // synchronously there (as Sequence._apply does on activation) so live
    // preview doesn't flash one frame of stale pixels via the async batchDraw.
    const { comp, layerB } = buildSeries(makeComp(), zoomBlur);
    comp.setFrame(55); // scene B is active but hidden by the overlay
    const drawSpy = vi.spyOn(layerB, "draw");
    comp.setFrame(60); // first frame past the overlap [50, 60) — the reveal
    expect(drawSpy).toHaveBeenCalled(); // synchronous draw, not the async batchDraw
  });

  it("shows the outgoing scene normally before the overlap begins", () => {
    const { comp, layerA, overlay } = buildSeries(makeComp(), zoomBlur);

    comp.setFrame(30); // mid scene A, before the overlap
    expect(layerA.visible()).toBe(true);
    expect(overlay?.visible()).toBe(false);
  });
});

describe("TransitionSeries — Tier A (non-GL) transitions are unaffected", () => {
  it("does not hide scene layers during a fade overlap (no overlay, opacity-driven)", () => {
    // The hide/re-show only applies to GL overlays. A fade animates the layer's
    // own opacity, so the scene must stay visible through the overlap.
    const comp = makeComp();
    const { layerA, layerB, overlay } = buildSeries(
      comp,
      () => fade() as ReturnType<typeof zoomBlur>,
    );

    expect(overlay).toBeUndefined(); // Tier A: no GL overlay sequence
    comp.setFrame(55); // inside the overlap
    expect(layerA.visible()).toBe(true);
    expect(layerB.visible()).toBe(true);
  });
});
