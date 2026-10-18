# create-smoove

## 0.4.1

### Patch Changes

- [#34](https://github.com/smoove-dev/smoove/pull/34) [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b) Thanks [@shemi](https://github.com/shemi)! - Every `npm create smoove` project is testable from the first install. The studio and both composition templates ship vitest, a `test` script, a vitest config with the smoove plugin, a setup file that loads the server renderer's Node canvas and font loaders, and a sample test for the hello-smoove composition. `npm test` passes on a fresh scaffold, and the "Next steps" note mentions it.

  `probeAt` and `countAt` in `@smoove/core/testing` now accept a composition with typed props. A `Composition<{ slogan: string }>` used to fail to type-check against them, so a test for any composition with props needed a cast.

  ```ts
  const comp = new Composition({
    id: "intro",
    fps: 30,
    durationInFrames: 90,
    width,
    height,
    props: { slogan: "hi" },
  });
  probeAt(comp, { time: 1 }, ".title"); // type-checks
  ```

## 0.4.0

## 0.3.6

## 0.3.5

## 0.3.4

## 0.3.3

## 0.3.2

## 0.3.1

## 0.3.0

## 0.2.0

## 0.1.8

## 0.1.7
