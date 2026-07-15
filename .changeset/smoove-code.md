---
"@smoove/code": patch
---

Add `@smoove/code`: an animated, syntax-highlighted code node. `Code` renders highlighted source and morphs between snapshots with a per-token diff, driven by the frame. Ships `interpolateCode`, `interpolateEdit`, and `interpolateSelection`, a `LezerHighlighter` over any Lezer grammar, and a set of theme presets (`nordDark`, `nordLight`, `dracula`, `githubLight`, plus `makeHighlightStyle`).
