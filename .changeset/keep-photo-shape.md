---
"@smoove/core": patch
"@smoove/cli": patch
"@smoove/agent": patch
---

Photos keep their shape. `npx smoove agent check` has a new `layout/stretched` finding for a picture or video drawn at a different shape from its source, by `objectFit: "fill"` in a box of another shape or by scaling one axis more than the other. It's an error once it holds. Scale on a scene's own layer, like a `flip` transition, doesn't count.

`media_info` now reads still images too, and reports a photo's size and shape as it draws, with a phone's rotation tag applied. Videos report their shape as well, and `asset_add` names it when it adds a picture.
