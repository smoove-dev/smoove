---
"@smoove/studio": patch
---

Restyle the render and export dialogs to match the rest of the studio. The
export-frame preview now shows the real captured frame, sized to the
composition's aspect ratio, instead of a placeholder, and a still reports a
realistic file size. In the render dialog, width and height stay locked to the
source aspect ratio (edit either, the other follows) and the resolution preset
dropdown is gone; the range control appears only when a loop region is set.
Primary buttons use a solid accent color and form inputs are borderless filled
fields, shared with the props inspector so the two surfaces stay consistent.
