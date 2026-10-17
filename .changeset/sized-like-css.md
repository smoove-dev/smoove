---
"@smoove/core": minor
"@smoove/media": patch
"@smoove/code": patch
"@smoove/lottie": patch
---

`width()` and `height()` now size every node, inside a layout or not.

Setting a size is the size you want, and a `Flex` or `Block` reflows around it
on the same frame. It takes pixels, a percentage, or `"auto"` to hand the size
back to the layout:

```ts
seq.register((frame) => {
  card.width(`${40 + frame}%`);
  hero.height(320);
  badge.width("auto");
});
```

Reading always returns the laid-out size in pixels, and a read right after a
set already sees the new layout.

This replaces the `flexWidth` and `flexHeight` attrs. Layout no longer reads
them, and setting one logs a warning that points at `width()` or `height()`.
Change `node.setAttr("flexWidth", 600)` to `node.width(600)`.

A percentage on a root `Flex` or `Block` (one added straight to a `Sequence`)
is now a share of the composition, so `width: "100%"` fills the frame. It used
to be ignored. A root `Flex` that hugs its content also reports that size from
`width()`, where it used to read 0.
