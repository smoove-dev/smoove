# Transitions (optional: `@smoove/transitions`)

Not installed by default — recommend `pnpm add @smoove/transitions` (peer
deps: `konva` + `@smoove/core`) when a composition needs scene-to-scene
transitions instead of a hard cut.

## TransitionSeries

```ts
import { Composition } from "@smoove/core";
import { TransitionSeries, linearTiming, fade } from "@smoove/transitions";

const sceneFrames = 60;
const transitionFrames = 30;
const comp = new Composition({
  id: "ab-fade",
  fps: 30,
  durationInFrames: sceneFrames * 2 - transitionFrames, // overlap is shared, not additive
  width: 1280,
  height: 720,
});

const series = new TransitionSeries({ composition: comp });
series.scene({ durationInFrames: sceneFrames }, (seq) => {
  seq.add(/* scene A nodes */);
});
series.transition({
  presentation: fade(),
  timing: linearTiming({ durationInFrames: transitionFrames }), // overlaps the tail of A / head of B
});
series.scene({ durationInFrames: sceneFrames }, (seq) => {
  seq.add(/* scene B nodes */);
});

comp.add(series); // Composition.add accepts a SequenceProvider directly, same as Series
export default comp;
```

Each `scene()`/`transition()` call appends in order; `transition()`'s
`durationInFrames` frames overlap the end of the previous scene and the
start of the next one (so a 60+60-frame, 30-frame-transition series totals
90 frames, not 150 — the overlap is shared).

`TransitionSeries` validates the sequence and throws a descriptive error if:
a transition is first or last (nothing to overlap), two transitions are
adjacent, or a transition is longer than either scene it overlaps.

## Presentations

`fade()`, `slide({ direction })`, `wipe({ direction })`, `dissolve()`,
`iris()`, `flip({ direction })`, `bookFlip({ direction })`, `clockWipe()`,
`crossZoom()`, `crosswarp()`, `dreamyZoom()`, `filmBurn()`, `linearBlur()`,
`ripple()`, `swap()`, `zoomBlur()`, `zoomInOut()`, `none()` — all imported
from `@smoove/transitions`. Directional ones take `direction: "from-left" |
"from-right" | "from-top" | "from-bottom"`. `flip()` is a `scaleX`/`scaleY`
squash, not a true 3D rotation (Konva has no perspective transform).

Two tiers: `fade`/`slide`/`wipe`/`clockWipe`/`iris`/`flip`/`none` render
geometrically (Tier A — pure Konva, no special requirements). The rest
(`dissolve`, `crosswarp`, `crossZoom`, `dreamyZoom`, `filmBurn`,
`linearBlur`, `ripple`, `zoomBlur`, `swap`, `bookFlip`) are GLSL-shader-backed
(Tier B): each frame, both scene layers are captured as textures and blended
by a fragment shader. Tier B needs a WebGL2 context — when none is available
(including in-browser, depending on the host environment) every shader
transition silently falls back to `fade()` with a one-time `console.warn`.
Rendering Tier B headlessly (server-side) needs additional wiring and is out
of scope for this skill.

## Timing

`linearTiming({ durationInFrames })` is the default constant-rate progress
curve. For a spring-driven transition, `springTiming({ config })` +
`spring(...)`/`defaultSpringConfig`/`measureSpring(...)` (also from
`@smoove/transitions`) give a physically-modeled progress curve instead of
linear.

See `rules/assets/transition-series.composition.ts` for a complete A→B
example.
