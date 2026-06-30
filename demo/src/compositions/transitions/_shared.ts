/* ============================================================
   Shared scaffolding for the transition gallery — one isolated
   A → B demo per @smoove/transitions presentation.

   Every demo is the same four-step shape:

     const comp   = makeComp("id", defaults);        // 1. a Composition
     const series = new TransitionSeries({ composition: comp });
     series.scene({ durationInFrames: SCENE }, sceneA); // 2. outgoing scene
     series.transition({                               // 3. the transition
       presentation: …,                                //    how it looks
       timing: linearTiming({ durationInFrames }),     //    how progress moves
     });
     series.scene({ durationInFrames: SCENE }, sceneB); // 4. incoming scene
     comp.add(series);

   `transitionComp(id, defaults, make)` packages all of that — each
   per-transition `composition.ts` is then a single line. `make(p)` is
   re-read every frame (via `live`) so editing a slider updates the
   running transition without rebuilding. In your own app you'd skip
   `live` and pass a fixed `presentation: dissolve({ … })`.
   ============================================================ */
import { Composition, type Sequence } from "@smoove/core";
import { kf } from "@smoove/studio";
import { type Presentation, TransitionSeries, linearTiming } from "@smoove/transitions";
import Konva from "konva";

export const W = 1280;
export const H = 720;
export const SCENE = 60; // each scene is 60 frames long
export const TRANSITION = 30; // …and they overlap for 30 while the transition plays
export const TOTAL = SCENE * 2 - TRANSITION; // → 90; the overlap is frames [30, 60), mid at 45

/** The 4-way direction union shared by slide / wipe / flip / book flip. */
export type Direction = "from-left" | "from-right" | "from-top" | "from-bottom";

/** A fresh, looping 1280×720 Composition — the canvas every demo animates on. */
export function makeComp<P extends Record<string, unknown>>(id: string, props: P): Composition<P> {
  return new Composition<P>({
    id,
    fps: 30,
    durationInFrames: TOTAL,
    width: W,
    height: H,
    loop: true,
    props,
  });
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
export const sceneA = paintScene({ bg: "#0d1117", fg: "#4ea1ff", ring: "#1f6feb", letter: "A" });
export const sceneB = paintScene({ bg: "#2d0b1a", fg: "#ffd166", ring: "#ff6b6b", letter: "B" });

/**
 * DEMO-ONLY: rebuild the presentation from the live props every frame, so
 * editing a slider updates the running transition without rebuilding. In real
 * code you'd skip this and pass a fixed `presentation: dissolve({ … })`.
 */
export function live<P>(props: { get(): P }, make: (p: P) => Presentation): Presentation {
  const read = () => make(props.get());
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

/** Build a complete single-transition A → B composition in one call. */
export function transitionComp<P extends Record<string, unknown>>(
  id: string,
  defaults: P,
  make: (p: P) => Presentation,
): Composition<P> {
  const comp = makeComp<P>(id, defaults);
  // `Composition<P>` is invariant in P (via setProps), so a concretely-typed
  // comp isn't assignable to the series' `Composition<Record<string,unknown>>`.
  const series = new TransitionSeries({ composition: comp as Composition });
  series.scene({ durationInFrames: SCENE }, sceneA);
  series.transition({
    presentation: live<P>(comp.props, make),
    timing: linearTiming({ durationInFrames: TRANSITION }),
  });
  series.scene({ durationInFrames: SCENE }, sceneB);
  comp.add(series);
  return comp;
}

/** Shared 4-way direction control (slide / wipe / flip / book flip). */
export const directionField = (def: Direction) =>
  kf.select({
    label: "Direction",
    default: def,
    options: [
      { value: "from-left", label: "From left" },
      { value: "from-right", label: "From right" },
      { value: "from-top", label: "From top" },
      { value: "from-bottom", label: "From bottom" },
    ],
  });
