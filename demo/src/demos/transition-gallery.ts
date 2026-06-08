/* ============================================================
   One isolated A → B demo per @konva-motion/transitions
   presentation — written to be read. Every demo follows the
   same four-step shape so you can see exactly how the API works:

     const comp   = makeComp("id");                 // 1. a Composition
     const series = new TransitionSeries({ composition: comp });
     series.scene({ durationInFrames: 60 }, sceneA);  // 2. outgoing scene
     series.transition({                              // 3. the transition
       presentation: fade(),                          //    how it looks
       timing: linearTiming({ durationInFrames: 30 }),//    how progress moves
     });
     series.scene({ durationInFrames: 60 }, sceneB);  // 4. incoming scene
     comp.add(series);                                //    add every layer

   The two scenes (`sceneA` / `sceneB`) and the Composition
   (`makeComp`) are shared helpers — the interesting, per-demo
   line is `presentation: <factory>(...)`.

   `live(props, (p) => …)` is DEMO-ONLY sugar: it re-reads the
   studio form every frame so the sliders update the running
   transition. In your own app you'd just write the factory call
   directly, e.g. `presentation: dissolve({ spreadColor: "#ff0000" })`.
   ============================================================ */
import { Composition, type Sequence } from "@konva-motion/core";
import {
  type Presentation,
  TransitionSeries,
  bookFlip,
  clockWipe,
  crossZoom,
  crosswarp,
  dissolve,
  dreamyZoom,
  fade,
  filmBurn,
  flip,
  iris,
  linearBlur,
  linearTiming,
  none,
  ripple,
  slide,
  swap,
  wipe,
  zoomBlur,
  zoomInOut,
} from "@konva-motion/transitions";
import Konva from "konva";
import { type KmInfer, type KmSchema, kf } from "../studio/kf.js";
import type { DemoDef, PropsSignal } from "./types.js";

// ── Shared timing/size, and the two scenes every demo reuses ────────────────

const W = 1280;
const H = 720;
const SCENE = 60; // each scene is 60 frames long
const TRANSITION = 30; // …and they overlap for 30 while the transition plays
const TOTAL = SCENE * 2 - TRANSITION; // → 90; the overlap is frames [30, 60), mid at 45

/** A fresh, looping 1280×720 Composition — the canvas every demo animates on. */
function makeComp(id: string): Composition {
  return new Composition({ id, fps: 30, durationInFrames: TOTAL, width: W, height: H, loop: true });
}

type SceneSpec = { bg: string; fg: string; ring: string; letter: string };

function paintScene(spec: SceneSpec): (seq: Sequence) => void {
  return (seq) => {
    seq.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: spec.bg }));
    // Corner markers make translation / clipping / warping legible.
    for (const [x, y] of [
      [120, 120],
      [W - 120, 120],
      [120, H - 120],
      [W - 120, H - 120],
    ] as const) {
      seq.add(new Konva.Rect({ x: x - 40, y: y - 40, width: 80, height: 80, fill: spec.ring }));
    }
    seq.add(new Konva.Circle({ x: W / 2, y: H / 2, radius: 170, fill: spec.fg }));
    seq.add(
      new Konva.Text({
        x: 0,
        y: H / 2 - 95,
        width: W,
        align: "center",
        text: spec.letter,
        fontSize: 180,
        fontStyle: "700",
        fontFamily: "system-ui, sans-serif",
        fill: "#0d1117",
      }),
    );
  };
}

/** Scene A (outgoing) and Scene B (incoming) — identical across every demo. */
const sceneA = paintScene({ bg: "#0d1117", fg: "#4ea1ff", ring: "#1f6feb", letter: "A" });
const sceneB = paintScene({ bg: "#2d0b1a", fg: "#ffd166", ring: "#ff6b6b", letter: "B" });

/**
 * DEMO-ONLY: rebuild the presentation from the live form props every frame, so
 * editing a slider updates the running transition without rebuilding. In real
 * code you'd skip this and pass a fixed `presentation: dissolve({ … })`.
 */
function live<P>(props: PropsSignal, make: (p: P) => Presentation): Presentation {
  const read = () => make(props.get() as P);
  const sample = read();
  if (sample.gl) {
    // Tier B (shader): the fragment is fixed; only the uniforms re-read props.
    return {
      gl: {
        fragment: sample.gl.fragment,
        uniforms: (progress, dims) => read().gl?.uniforms?.(progress, dims) ?? {},
      },
    };
  }
  // Tier A (geometric): enter/exit re-read props.
  return {
    enter: (layer, progress, dims) => read().enter?.(layer, progress, dims),
    exit: (layer, progress, dims) => read().exit?.(layer, progress, dims),
  };
}

/** Shared 4-way direction control (slide / wipe / flip / book flip). */
const directionField = (def: "from-left" | "from-right" | "from-top" | "from-bottom") =>
  kf.select({
    label: "Direction",
    default: def,
    options: [
      { value: "from-left", label: "From left" },
      { value: "from-right", label: "From right" },
      { value: "from-top", label: "From top" },
      { value: "from-bottom", label: "From bottom" },
    ] as const,
  });

// ── Tier A — geometric (Konva-native) ───────────────────────────────────────

const fadeDemo: DemoDef = {
  id: "tr-fade",
  name: "Fade",
  build() {
    const comp = makeComp("tr-fade");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: fade(),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const slideSchema = kf.object({ fields: { direction: directionField("from-right") } });
const slideDemo: DemoDef = {
  id: "tr-slide",
  name: "Slide",
  schema: slideSchema,
  build(props) {
    const comp = makeComp("tr-slide");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof slideSchema>>(props, (p) =>
        slide({ direction: p.direction }),
      ),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const wipeSchema = kf.object({ fields: { direction: directionField("from-left") } });
const wipeDemo: DemoDef = {
  id: "tr-wipe",
  name: "Wipe",
  schema: wipeSchema,
  build(props) {
    const comp = makeComp("tr-wipe");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof wipeSchema>>(props, (p) =>
        wipe({ direction: p.direction }),
      ),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const clockWipeDemo: DemoDef = {
  id: "tr-clock-wipe",
  name: "Clock wipe",
  build() {
    const comp = makeComp("tr-clock-wipe");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: clockWipe(), // defaults to the stage size
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const irisDemo: DemoDef = {
  id: "tr-iris",
  name: "Iris",
  build() {
    const comp = makeComp("tr-iris");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: iris(),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const flipSchema = kf.object({ fields: { direction: directionField("from-left") } });
const flipDemo: DemoDef = {
  id: "tr-flip",
  name: "Flip",
  schema: flipSchema,
  build(props) {
    const comp = makeComp("tr-flip");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof flipSchema>>(props, (p) =>
        flip({ direction: p.direction }),
      ),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const noneDemo: DemoDef = {
  id: "tr-none",
  name: "None",
  build() {
    const comp = makeComp("tr-none");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: none(), // hard cut — drives only the timing
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

// ── Tier B — GLSL shaders (shared WebGL compositor) ─────────────────────────

const dissolveSchema = kf.object({
  fields: {
    lineWidth: kf.number({ label: "Line width", min: 0, max: 1, step: 0.01, default: 0.1 }),
    spreadColor: kf.color({ label: "Spread color", default: "#ff0000" }),
    hotColor: kf.color({ label: "Hot color", default: "#e6e633" }),
    pow: kf.number({ label: "Power", min: 0, max: 10, step: 0.1, default: 5 }),
    intensity: kf.number({ label: "Intensity", min: 0, max: 3, step: 0.05, default: 1 }),
  },
});
const dissolveDemo: DemoDef = {
  id: "tr-dissolve",
  name: "Dissolve",
  schema: dissolveSchema,
  build(props) {
    const comp = makeComp("tr-dissolve");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof dissolveSchema>>(props, (p) =>
        dissolve({
          lineWidth: p.lineWidth,
          spreadColor: p.spreadColor,
          hotColor: p.hotColor,
          pow: p.pow,
          intensity: p.intensity,
        }),
      ),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const crosswarpDemo: DemoDef = {
  id: "tr-crosswarp",
  name: "Crosswarp",
  build() {
    const comp = makeComp("tr-crosswarp");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: crosswarp(),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const crossZoomSchema = kf.object({
  fields: { strength: kf.number({ label: "Strength", min: 0, max: 2, step: 0.05, default: 0.4 }) },
});
const crossZoomDemo: DemoDef = {
  id: "tr-cross-zoom",
  name: "Cross zoom",
  schema: crossZoomSchema,
  build(props) {
    const comp = makeComp("tr-cross-zoom");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof crossZoomSchema>>(props, (p) =>
        crossZoom({ strength: p.strength }),
      ),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const dreamyZoomSchema = kf.object({
  fields: {
    rotation: kf.number({ label: "Rotation", min: 0, max: 30, step: 0.5, default: 6, unit: "°" }),
    scale: kf.number({ label: "Scale", min: 1, max: 3, step: 0.05, default: 1.2 }),
  },
});
const dreamyZoomDemo: DemoDef = {
  id: "tr-dreamy-zoom",
  name: "Dreamy zoom",
  schema: dreamyZoomSchema,
  build(props) {
    const comp = makeComp("tr-dreamy-zoom");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof dreamyZoomSchema>>(props, (p) =>
        dreamyZoom({ rotation: p.rotation, scale: p.scale }),
      ),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const filmBurnSchema = kf.object({
  fields: { seed: kf.number({ label: "Seed", min: 0, max: 10, step: 0.01, default: 2.31 }) },
});
const filmBurnDemo: DemoDef = {
  id: "tr-film-burn",
  name: "Film burn",
  schema: filmBurnSchema,
  build(props) {
    const comp = makeComp("tr-film-burn");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof filmBurnSchema>>(props, (p) => filmBurn({ seed: p.seed })),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const linearBlurSchema = kf.object({
  fields: {
    intensity: kf.number({ label: "Intensity", min: 0, max: 1, step: 0.01, default: 0.1 }),
  },
});
const linearBlurDemo: DemoDef = {
  id: "tr-linear-blur",
  name: "Linear blur",
  schema: linearBlurSchema,
  build(props) {
    const comp = makeComp("tr-linear-blur");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof linearBlurSchema>>(props, (p) =>
        linearBlur({ intensity: p.intensity }),
      ),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const rippleSchema = kf.object({
  fields: {
    amplitude: kf.number({ label: "Amplitude", min: 0, max: 300, step: 1, default: 100 }),
    speed: kf.number({ label: "Speed", min: 0, max: 200, step: 1, default: 50 }),
  },
});
const rippleDemo: DemoDef = {
  id: "tr-ripple",
  name: "Ripple",
  schema: rippleSchema,
  build(props) {
    const comp = makeComp("tr-ripple");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof rippleSchema>>(props, (p) =>
        ripple({ amplitude: p.amplitude, speed: p.speed }),
      ),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const zoomBlurSchema = kf.object({
  fields: {
    rotation: kf.number({
      label: "Rotation",
      min: 0,
      max: 3.14,
      step: 0.05,
      default: 0.52,
      unit: "rad",
    }),
  },
});
const zoomBlurDemo: DemoDef = {
  id: "tr-zoom-blur",
  name: "Zoom blur",
  schema: zoomBlurSchema,
  build(props) {
    const comp = makeComp("tr-zoom-blur");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof zoomBlurSchema>>(props, (p) =>
        zoomBlur({ rotation: p.rotation }),
      ),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const zoomInOutDemo: DemoDef = {
  id: "tr-zoom-in-out",
  name: "Zoom in/out",
  build() {
    const comp = makeComp("tr-zoom-in-out");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: zoomInOut(),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const swapSchema = kf.object({
  fields: {
    reflection: kf.number({ label: "Reflection", min: 0, max: 1, step: 0.05, default: 0.4 }),
    perspective: kf.number({ label: "Perspective", min: 0, max: 1, step: 0.05, default: 0.2 }),
    depth: kf.number({ label: "Depth", min: 1, max: 6, step: 0.1, default: 3 }),
  },
});
const swapDemo: DemoDef = {
  id: "tr-swap",
  name: "Swap",
  schema: swapSchema,
  build(props) {
    const comp = makeComp("tr-swap");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof swapSchema>>(props, (p) =>
        swap({ reflection: p.reflection, perspective: p.perspective, depth: p.depth }),
      ),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

const bookFlipSchema = kf.object({ fields: { direction: directionField("from-right") } });
const bookFlipDemo: DemoDef = {
  id: "tr-book-flip",
  name: "Book flip",
  schema: bookFlipSchema,
  build(props) {
    const comp = makeComp("tr-book-flip");
    const series = new TransitionSeries({ composition: comp });
    series.scene({ durationInFrames: SCENE }, sceneA);
    series.transition({
      presentation: live<KmInfer<typeof bookFlipSchema>>(props, (p) =>
        bookFlip({ direction: p.direction }),
      ),
      timing: linearTiming({ durationInFrames: TRANSITION }),
    });
    series.scene({ durationInFrames: SCENE }, sceneB);
    comp.add(series);
    return comp;
  },
};

// ── Registry consumed by the studio catalog ─────────────────────────────────

export type GalleryItem = { def: DemoDef; title: string; tier: "A" | "B"; desc: string };

export const TRANSITION_GALLERY: GalleryItem[] = [
  {
    def: fadeDemo,
    title: "Fade",
    tier: "A",
    desc: "Opacity cross-dissolve — both layers reach 50% at the midpoint.",
  },
  {
    def: slideDemo,
    title: "Slide",
    tier: "A",
    desc: "Incoming layer slides in; outgoing pushes out the opposite side.",
  },
  {
    def: wipeDemo,
    title: "Wipe",
    tier: "A",
    desc: "Rectangular clip reveal of the incoming layer.",
  },
  {
    def: clockWipeDemo,
    title: "Clock wipe",
    tier: "A",
    desc: "Angular pie-sweep clip from 12 o'clock.",
  },
  { def: irisDemo, title: "Iris", tier: "A", desc: "Expanding circular clip from the centre." },
  {
    def: flipDemo,
    title: "Flip",
    tier: "A",
    desc: "Fake-3D card flip via scaleX/scaleY (Konva has no real 3D).",
  },
  {
    def: noneDemo,
    title: "None",
    tier: "A",
    desc: "Hard cut — no transform, incoming replaces outgoing.",
  },
  {
    def: dissolveDemo,
    title: "Dissolve",
    tier: "B",
    desc: "Burning dissolve with a glowing edge.",
  },
  { def: crosswarpDemo, title: "Crosswarp", tier: "B", desc: "Warping cross-dissolve." },
  { def: crossZoomDemo, title: "Cross zoom", tier: "B", desc: "Zoom-blur cross-dissolve." },
  { def: dreamyZoomDemo, title: "Dreamy zoom", tier: "B", desc: "Spiralling zoom blend." },
  { def: filmBurnDemo, title: "Film burn", tier: "B", desc: "Fiery film-burn dissolve." },
  { def: linearBlurDemo, title: "Linear blur", tier: "B", desc: "Directionless blur dissolve." },
  { def: rippleDemo, title: "Ripple", tier: "B", desc: "Concentric ripple distortion." },
  { def: zoomBlurDemo, title: "Zoom blur", tier: "B", desc: "Counter-rotating radial zoom blur." },
  { def: zoomInOutDemo, title: "Zoom in/out", tier: "B", desc: "Punch-in / punch-out crossfade." },
  { def: swapDemo, title: "Swap", tier: "B", desc: "Perspective card swap with floor reflection." },
  { def: bookFlipDemo, title: "Book flip", tier: "B", desc: "Page-turn / book flip." },
];
