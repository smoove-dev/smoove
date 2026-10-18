---
"@smoove/core": patch
---

A `Text` with no width now re-measures when its font face finishes loading. It used to keep the width it measured against the fallback face, so a label in a wider face got clipped, most visibly with `wrap: "none"`. Now it hugs the loaded glyphs, as the fonts guide promises, and no longer needs an explicit width.

```ts
const mono = new IBMPlexMono({ weights: ["400"] });
seq.add(mono);
seq.add(new Text({ text: "radius 6  stroke 2  snappy", font: mono.face("400"), fontSize: 26, wrap: "none" }));
```

`setFont()` re-hugs the same way, on the swap and again when the new face loads.
