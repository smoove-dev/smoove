import { Block, Composition, Marker, Sequence } from "@smoove/core";
import { diagramCtx } from "./components/frame";
import { header } from "./components/header";
import { beat, childClips, laneTree } from "./components/lane";
import { progress } from "./components/progress";
import { ruler } from "./components/ruler";
import { T } from "./theme";

// ---------------------------------------------------------------------------
// Nested timelines, visualized — a score, a clip tree, and a page.
//
// This file only says WHAT exists: named ranges (the score), the clips that
// play them, and the page they hang on. Every pixel is decided by the
// components in ./components, and every number below is a frame count with a
// name — no coordinates, no widths, no offsets.
//
// The diagram builds itself from the clip tree: `laneTree` walks the clips
// under the sequence and emits a lane per clip, recursing into nested clips.
// Adding a lane is adding a clip; nothing else in this file changes.
// ---------------------------------------------------------------------------

const fps = 30;

const comp = new Composition({
  id: "clip-timelines",
  fps,
  durationInFrames: fps * 8,
  width: 1280,
  height: 720,
  loop: true,
});

const main = new Sequence();
comp.add(main);

// -- the score: named ranges, chained where chaining is what we mean ---------
const A = new Marker({ start: 30, durationInFrames: 75 });
const B = new Marker({ start: A.end, durationInFrames: 60 }); // picks up where A ends
const C = new Marker({ start: 60, until: 210 }); // deliberately overlaps A and B
// Nested ranges are written relative to C and stay absolute markers: a Clip
// re-bases marker anchors onto its parent, so `span:` works at any depth.
const C1 = new Marker({ start: C.start.add(15), durationInFrames: 45 });
const C2 = new Marker({ start: C.start.add(75), durationInFrames: 90 }); // outlives C
const C1a = new Marker({ start: C1.start.add(10), durationInFrames: 20 }); // two levels deep

// -- the clip tree: what actually runs --------------------------------------
const a = beat("A", "span: A", { span: A });
const b = beat("B", "span: A.end + 60f", { span: B });
const c = beat("C", "span: C, until 210", { span: C });
const c1 = beat("C.1", "span: C.start + 15f", { span: C1 });
const c1a = beat("C.1.a", "span: C.1.start + 10f", { span: C1a });
const c2 = beat("C.2", "span: C.start + 75f, outlives C", { span: C2 });

c1.add(c1a); // two levels deep — the lane appears by itself
c.add(c1);
c.add(c2);
main.add(a);
main.add(b);
main.add(c);

// -- the page ---------------------------------------------------------------
const ctx = diagramCtx(main);

const page = new Block({
  x: 0,
  y: 0,
  width: comp.width(),
  height: comp.height(),
  background: T.ink,
  flexDirection: "column",
  padding: T.pagePad,
  gap: T.pageGap,
});
main.add(page);

page.add(header(ctx, "nested timelines"));
page.add(ruler(ctx));
page.add(progress(ctx));

const lanes = new Block({
  flexDirection: "column",
  gap: T.laneGap,
  width: "100%",
  flexGrow: 1,
});
page.add(lanes);
for (const laneRow of laneTree(childClips(main), ctx)) lanes.add(laneRow);

export default comp;
