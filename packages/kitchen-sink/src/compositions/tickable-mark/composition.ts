import { Composition, Group, Rect, Sequence } from "@smoove/core";
import { smooveMark } from "./smoove-mark";

// ---------------------------------------------------------------------------
// Tickable mark — proving ground for shareable Clip components.
//
// Three copies of the same smooveMark() at different sizes play in perfect
// sync: the component computes all geometry from its `size` and all timing in
// seconds from `info.time`, so it looks and plays the same anywhere. The
// smallest copy is buried two Groups deep — the host still finds and ticks
// it, because a Clip is discovered wherever it sits in the subtree. A fourth
// copy uses the Clip's own range gating (`from`) plus a seconds `delay`.
// ---------------------------------------------------------------------------

const width = 1280;
const height = 720;
const fps = 30;

const comp = new Composition({
  id: "tickable-mark",
  fps,
  durationInFrames: fps * 8,
  width,
  height,
  loop: true,
});

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
comp.add(main);

const LOOP = 4; // every copy replays on the same 4s cycle

// The hero mark, and a half-size sibling.
main.add(smooveMark({ size: 420, x: 160, y: 130, loop: LOOP }));
main.add(smooveMark({ size: 210, x: 700, y: 235, loop: LOOP }));

// A small copy nested inside plain Groups — no wiring, it still ticks.
const nest = new Group({ x: 1000, y: 290 });
const inner = new Group();
inner.add(smooveMark({ size: 105, x: 0, y: 0, loop: LOOP }));
nest.add(inner);
main.add(nest);

// A gated copy: the clip's own `from` hides it for the first 2 seconds, and
// its clock starts there — plus an extra half-second `delay` in seconds.
main.add(smooveMark({ size: 105, x: 1000, y: 470, from: fps * 2, delay: 0.5, loop: LOOP }));

export default comp;
