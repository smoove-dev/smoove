---
"@smoove/core": minor
"@smoove/effects": minor
"@smoove/transitions": patch
"@smoove/renderer": minor
---

Add effects: an `effects: [...]` hook on every node and Sequence, and the new
@smoove/effects package with blur, chromaKey, shine, and water presets. The
GL bridge (GlPlatform, transpile, vertex shaders) moved from
@smoove/transitions to @smoove/core (transitions re-export it, no breaking
change). The renderer routes shader effect passes through headless-gl and
rasterizes pixel-free effect chains on the GPU (SMOOVE_EFFECTS_GPU=0 opts
out). To keep playback smooth on high-DPI displays, effects capture at a
capped pixelRatio during preview (`setEffectPreviewMaxPixelRatio`, default 1);
server renders always use full resolution. Also fixes server-side shader
transitions silently falling back in apps whose vite config stubs node:module.
