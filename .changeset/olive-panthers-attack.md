---
"@smoove/core": patch
---

Fix two layout bugs found by the new layout conformance suite.

An `Image` with no explicit `width`/`height` measured 0x0 and contributed
nothing to a `Flex`/`Block`, even though every other leaf reports its intrinsic
size. It now measures its bitmap's natural dimensions, matching the raw
`Konva.Image` fallback and the documented behaviour.

Content added to a `Sequence` after that sequence was already activated at the
current frame was never laid out until the playhead moved — which included the
common `comp.add(seq)` then build then `setFrame(0)` order, leaving frame 0
un-laid-out for a first paint or a headless still capture. The frame dedupe in
`Composition.setFrame` and `Sequence._apply` now takes the scene-graph structure
version into account, so a structural change makes the same frame worth
re-applying.
