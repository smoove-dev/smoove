---
"@smoove/core": patch
"create-smoove": patch
---

Every `npm create smoove` project is testable from the first install. The studio and both composition templates ship vitest, a `test` script, a vitest config with the smoove plugin, a setup file that loads the server renderer's Node canvas and font loaders, and a sample test for the hello-smoove composition. `npm test` passes on a fresh scaffold, and the "Next steps" note mentions it.

`probeAt` and `countAt` in `@smoove/core/testing` now accept a composition with typed props. A `Composition<{ slogan: string }>` used to fail to type-check against them, so a test for any composition with props needed a cast.

```ts
const comp = new Composition({ id: "intro", fps: 30, durationInFrames: 90, width, height, props: { slogan: "hi" } });
probeAt(comp, { time: 1 }, ".title"); // type-checks
```
