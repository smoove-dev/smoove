---
"@smoove/core": patch
---

Add `@smoove/core/testing` probes, `Text.setFontSize`, CSS corner clamping on
`Image`, and a seeded `random`.

The new `@smoove/core/testing` subpath answers "what is on screen at this
frame" from a test. `probe(comp, selector)` reports each matching node's
stage-space box, effective opacity, whether it actually paints, and the fill it
resolved to; `probeAt(comp, at, selector)` drives the clock first, by frame or
by `{ time }` in seconds; `countAt` is the count of what paints. A spec that
says "26 elements at 6.0s" is now one assertion instead of a session in the
browser console. `Block` reports its resolved background through the same
probe, which it could not before because a `Block` paints through an internal
rect.

`Text` gained `fontSize()` and `setFontSize()`. Resizing text after
construction meant destroying the node and rebuilding it, and tracking the size
in composition state because nothing read it back. `fontSize()` reports the
size the glyphs actually render at, so with `fitText` you get the fitted size
rather than the one you asked for.

`Image` now clamps its corner radii the way CSS does: when two radii sharing an
edge overflow it, all four scale by one common factor. `cornerRadius: 9999` on
a square is the standard way to ask for a disc, and it used to draw a squircle.

`random(seed)` is a seeded generator (`range`, `int`, `pick`) for compositions
that need scatter. `Math.random` breaks frame purity, so every composition was
hand-rolling one of these with its own constants.
