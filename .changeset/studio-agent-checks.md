---
"@smoove/core": patch
"@smoove/agent": patch
"@smoove/studio": patch
"@smoove/vite": patch
---

`smoove check`: one command that sweeps a composition for what you'd otherwise catch by watching, and names the node, frames, beat and source line of each finding. It lints the project for code that breaks scrubbing, then, in the studio's headless tab, compares jumped-to frames with playback, finds layout children moved by x or y, text cut by an ellipsis or running off the canvas, low contrast against what's really behind the text, colors and fonts outside the declared palette, frozen stretches, and the intents in a composition's checks file. `@smoove/core/testing` gains `runChecks`, `defineChecks` and the intents `appearsBy`, `before`, `staysInFrame` and `keepsMoving`, so a test can hold a composition to the same checks. `@smoove/core` exports `parseColor`, `contrastRatio` and `relativeLuminance`. A studio registry entry takes an optional `checks` import.
