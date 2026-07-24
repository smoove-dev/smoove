---
"@smoove/transitions": patch
---

Fix a scene inheriting its own exit transition on the next pass over the
timeline. A presentation only sets the state it animates, and nothing put that
state back when the scene left range, so after a loop (or a scrub backwards) a
scene re-entered still carrying the transform its outgoing transition left
behind. Any incoming presentation that didn't happen to own the same property
kept it for the whole overlap — with `none()`, which owns nothing, the scene
played its entire hand-off translated off-screen and snapped into place the
frame the overlap ended. Each transitioning scene now resets its layer before
the presentation applies, so what a frame looks like depends only on that frame.
