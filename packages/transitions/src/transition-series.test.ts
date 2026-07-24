import { Composition } from "@smoove/core";
import Konva from "konva";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type GlCompositor, setCompositorFactory } from "./gl/compositor.js";
import { fade } from "./presentations/fade.js";
import { none } from "./presentations/none.js";
import { slide } from "./presentations/slide.js";
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

describe("TransitionSeries — a scene's layer state is a pure function of the frame", () => {
  /**
   * Regression (showcase loop): a scene between two transitions inherits the
   * layer state its *outgoing* transition left behind. `slide().exit` translates
   * the layer and nothing puts it back — the layer is simply hidden when the
   * scene leaves range. On the next pass (a loop, or a scrub back) the scene
   * re-activates with that translation still applied, and every incoming
   * presentation that doesn't happen to own `position` leaves it there for the
   * whole overlap. `none()` owns nothing at all, so the scene played its entire
   * incoming transition ~1000px off-screen and snapped into place the frame the
   * overlap ended.
   */
  function buildLoopSeries() {
    const comp = makeComp();
    const series = new TransitionSeries({ composition: comp, from: 0 });
    series.scene({ durationInFrames: 60, name: "a" }, (seq) => seq.add(rect("rectA")));
    series.transition({ presentation: none(), timing: linearTiming({ durationInFrames: 20 }) });
    series.scene({ durationInFrames: 60, name: "b" }, (seq) => seq.add(rect("rectB")));
    series.transition({
      presentation: slide({ direction: "from-right" }),
      timing: linearTiming({ durationInFrames: 10 }),
    });
    series.scene({ durationInFrames: 60, name: "c" }, (seq) => seq.add(rect("rectC")));
    comp.add(series);
    const layerB = comp.getLayers().find((l) => l.findOne(".rectB"));
    if (!layerB) throw new Error("scene layer not found");
    // b: [40, 100) — its incoming none() overlap is [40, 60), its outgoing
    // slide() overlap [90, 100).
    return { comp, layerB, bStart: series.marker("b").start.resolve() };
  }

  it("re-enters a scene with an identity transform after its exit transition ran", () => {
    const { comp, layerB, bStart } = buildLoopSeries();

    comp.setFrame(95); // mid-exit: slide has pushed the layer off to the left
    expect(layerB.x()).toBeLessThan(0);

    comp.setFrame(120); // past scene b — it leaves range and is hidden
    comp.setFrame(0); // loop back to the top
    comp.setFrame(bStart); // scene b re-enters, inside its none() overlap

    expect(layerB.x()).toBe(0);
    expect(layerB.y()).toBe(0);
  });

  it("keeps the identity transform through the whole incoming overlap", () => {
    const { comp, layerB, bStart } = buildLoopSeries();

    comp.setFrame(95);
    comp.setFrame(120);
    comp.setFrame(0);
    for (let f = bStart; f < bStart + 20; f++) {
      comp.setFrame(f);
      expect(layerB.x()).toBe(0);
    }
  });

  it("still lets the incoming presentation own the state it animates", () => {
    // The reset must not stomp the transition itself: a slide-in still slides.
    const comp = makeComp();
    const series = new TransitionSeries({ composition: comp, from: 0 });
    series.scene({ durationInFrames: 60, name: "a" }, (seq) => seq.add(rect("rectA")));
    series.transition({
      presentation: slide({ direction: "from-right" }),
      timing: linearTiming({ durationInFrames: 10 }),
    });
    series.scene({ durationInFrames: 60, name: "b" }, (seq) => seq.add(rect("rectB")));
    comp.add(series);
    const layerB = comp.getLayers().find((l) => l.findOne(".rectB"));
    if (!layerB) throw new Error("scene layer not found");

    comp.setFrame(50); // first frame of the overlap — fully off to the right
    expect(layerB.x()).toBe(comp.width());
    comp.setFrame(55); // halfway in
    expect(layerB.x()).toBeCloseTo(comp.width() / 2);
    comp.setFrame(60); // settled
    expect(layerB.x()).toBe(0);
  });
});
