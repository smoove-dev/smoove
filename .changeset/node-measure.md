---
"@smoove/core": patch
---

Lifetime-independent measurement: `measure(node, { at? })` (also `.measure()` on every smoove wrapper) lays a node out on demand and returns its stage-space bounds, even inside a sequence that has never been on screen. Pass `{ at }` to measure at any local frame of the owning sequence; active sequences are restored to their live frame afterwards. `Text` measurements include per-line rects, glyph-tight ink bounds, and the alphabetic baseline, so masks and underlines can anchor to real glyph edges.
