---
"@smoove/effects": patch
---

Add `droplets` to `@smoove/effects`: rain running down a pane of glass in front of a node. Drops swell, let go and slide, leaving wet trails through the fog, with a fine drizzle between them and everything behind bending through the water. `node.effects([droplets({ intensity: 1, blur: 4 })])`, then animate `intensity` for a squall that arrives and passes.

The glass is the node's own box and every pixel is gated on the node's alpha, so the effect asks for no padding and never paints outside what the node already covered. Lengths are in CSS px, so a 2x render matches its 1x preview, and the rain reads only from the frame clock, so it scrubs and renders the same in the browser and on the server.
