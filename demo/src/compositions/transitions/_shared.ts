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
import { Composition, type Sequence, Video } from "@smoove/core";
import { kf } from "@smoove/studio";
import { linearTiming, type Presentation, TransitionSeries } from "@smoove/transitions";
import sceneAUrl from "../../files/film/s1a.mp4";
import sceneBUrl from "../../files/film/s3a.mp4";

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

/** Paint a full-frame, muted video clip — the content each demo transitions between. */
function videoScene(src: string): (seq: Sequence) => void {
  return (seq) => {
    seq.add(
      new Video({
        src,
        x: 0,
        y: 0,
        width: W,
        height: H,
        objectFit: "cover",
        objectPosition: "center",
        muted: true,
      }),
    );
  };
}

/** Scene A (outgoing) and Scene B (incoming) — two clips from the Cohabit film, identical across every demo. */
export const sceneA = videoScene(sceneAUrl);
export const sceneB = videoScene(sceneBUrl);

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
