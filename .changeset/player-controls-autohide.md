---
"@smoove/player": minor
---

Auto-hiding controls, plus default-chrome polish.

The control bar now fades out — cursor included — after three seconds of inactivity while playing, and comes back on pointer movement, a keypress, or a tap. It stays put whenever it should: while paused, while scrubbing, while hovered, or while a control holds keyboard focus. Set `always-show-controls` (or the `alwaysShowControls` property) to opt out and keep it pinned.

Also in the default chrome: the progress fill is a solid green instead of a red-to-green gradient, the loop icon matches the studio's, and dragging the scrubber now works on touch instead of scrolling the page.
