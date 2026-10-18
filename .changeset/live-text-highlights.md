---
"@smoove/core": patch
---

`Text` highlights repaint on their own. Mutate a highlight in place from an updater (`hl.progress = …`, or move `start`/`end` to box the word being spoken) and the marks update on the same frame, wherever the `Text` sits. Before, a `Text` added straight to a sequence, with no typewriter and no flex parent, only repainted after a call to the internal `_layoutText()`.

```ts
const spoken: HighlightConfig = { start: 0, end: 5, background: "#FFD43B" };
const caption = new Text({ text: "hello world", fontSize: 72, highlights: [spoken] });
seq.add(caption);
seq.register((frame) => {
  spoken.progress = interpolate(frame, [0, 4], [0, 1], { extrapolateRight: "clamp" });
});
```

Replacing the array with `setAttr("highlights", [...])` repaints right away. A frame where no highlight changed skips the repaint.
