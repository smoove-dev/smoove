---
"@smoove/core": minor
---

Add `Text#setFill(color)` and `Text#setFont(font)` for post-construction mutation. `setFill` recolors without re-measuring; `setFont` swaps the face, re-lays-out, and re-lays-out again once the new face loads. Removes the need for the transparent-`highlight` tint workaround when animating text color.
