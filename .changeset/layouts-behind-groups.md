---
"@smoove/core": patch
---

A `Flex` or `Block` inside a plain `Group` now reflows during playback. Every frame, a `Sequence` or `Clip` lays out each layout below it that no other layout places, at any depth, so a component that wraps its layout in a `Group` for a transform plays and seeks correctly. Before, only layouts added straight to the `Sequence` or `Clip` were reflowed, and one behind a `Group` painted at stale positions on a seek.

```ts
const body = new Group({ x: 540, y: 900, scaleX: 1.1, scaleY: 1.1 });
clip.add(body);
body.add(row); // a Block: now laid out every frame, no measure() call needed
```

`measure()` lays out the root that actually places the node, so a layout behind a `Group` that itself sits inside another layout measures correctly too.

A plain `Group` can also sit directly in a `Flex`/`Block` now. It's placed at its slot; before, the layout pass threw.
