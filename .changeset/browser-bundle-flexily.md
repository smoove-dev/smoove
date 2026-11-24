---
"@smoove/core": patch
"@smoove/player": patch
"@smoove/studio": patch
---

`@smoove/core` bundles for the browser with no setup. A plain Vite app that imports it used to fail with `"createRequire" is not exported by "__vite-browser-external"`, or build and then throw on load in Vite 8, because the layout engine it depends on (flexily) imported `node:module`. If you stubbed `node:module` to get past that, you can delete the stub and write only this:

```ts
import { Sequence } from "@smoove/core";
```

flexily is now pinned to 0.8.1. Layouts don't move: later versions round text widths to whole pixels, which can break a label onto a second line.
