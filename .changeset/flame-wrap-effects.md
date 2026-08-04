---
"@smoove/core": patch
"@smoove/effects": patch
"@smoove/transitions": patch
"@smoove/renderer": patch
---

Add `@smoove/effects` with `flameWrap`: fire wrapped around a node, with heat distortion, sparks, a molten rim, smoke and scorching. It wraps the node's rounded box by default (`radius` to match your corners) or its alpha edge with `shape: "silhouette"`, so a burning `Text` burns letter by letter. Nodes and Sequences gain an `effects` chain (`card.effects([flameWrap()])`), and effects read the frame clock, so a burn scrubs and renders the same in the browser and on the server.

The WebGL bridge moves from `@smoove/transitions` into `@smoove/core` so both transitions and effects share one compositor. Everything is re-exported from `@smoove/transitions`, so existing imports keep working.
