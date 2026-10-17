---
"@smoove/core": minor
---

`Block` borders now follow the CSS box model.

Three things change, all of them visible.

Per-edge `borderColor` and `borderSize` are painted rather than collapsed. The
types have always accepted `[top, right, bottom, left]`, but the implementation
stroked the whole outline at the largest of the four widths in the first colour.
Edges that differ are now drawn as four mitred bands, clipped to the corner
radius; a uniform border still takes the single-stroke path, so dashes and
rounded corners are unaffected.

A border occupies layout space. It insets the content box the way CSS does,
without changing the node's own size — a 20px border on a 240x120 `Block` now
leaves 200x80 for its children, where before the border reserved nothing and
overlapped its own content.

A border paints inside the box. Canvas centres a stroke on its path, so a border
used to sit half outside the node's bounds. It is now drawn wholly inside, which
moves a uniform border inward by half its width. At the 1-4px borders most
layouts use the shift is a pixel or two; a thick border will move noticeably.

`borderStyle: "dashed"` still requires a uniform border. Dashes ride a stroked
path, which per-edge painting replaces with filled polygons, so a dashed border
whose edges differ paints solid instead.
