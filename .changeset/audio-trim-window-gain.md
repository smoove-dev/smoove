---
"@smoove/core": minor
---

`Audio` gains a `trim: { start, play }` play-window as friendlier sugar over `trimBefore`/`trimAfter` (maps to `trimBefore = start`, `trimAfter = start + play`), and `volume` now accepts values above `1` to amplify — honored by the preview Web Audio path and the render mux (the legacy `HTMLAudioElement` source still caps at `1`).
