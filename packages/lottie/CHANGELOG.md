# @smoove/lottie

## 0.4.0

### Patch Changes

- [#32](https://github.com/smoove-dev/smoove/pull/32) [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af) Thanks [@shemi](https://github.com/shemi)! - `width()` and `height()` now size every node, inside a layout or not.

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

- Updated dependencies [[`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af), [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326), [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af), [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af)]:
  - @smoove/core@0.4.0

## 0.3.6

### Patch Changes

- [#28](https://github.com/smoove-dev/smoove/pull/28) [`497ca93`](https://github.com/smoove-dev/smoove/commit/497ca93bd479970a2ecd8a61abe3f2fcde4e0418) Thanks [@shemi](https://github.com/shemi)! - New package: `@smoove/lottie`, for playing Lottie animations on the smoove
  timeline.

  A Lottie file carries its own frame rate. The `Lottie` node maps your
  composition's frames onto it, including the positions between the animation's
  own frames, so a 24 fps animation runs on a 30 fps timeline without stuttering
  and without anything needing to match.

  ```ts
  import { Lottie } from "@smoove/lottie";

  main.add(
    new Lottie({ src: "/spinner.json", width: 240, height: 240, loop: true }),
  );
  ```

  `speed`, `loop`, `segment`, `marker`, `trimBefore` and `trimAfter` control what
  plays and when. Sizing, `objectFit`, `objectPosition` and `cornerRadius` are
  spelled the way `Image` and `Video` spell them, and the node lays out inside a
  `Flex` like any other child.

  Drawing goes through a WebAssembly rasterizer, the same one in the browser and
  in a headless render. The browser fetches it from a CDN unless you point
  `setLottieWasmUrl` at your own copy; Node reads it from disk and needs no
  network.

- Updated dependencies [[`8e7bbc1`](https://github.com/smoove-dev/smoove/commit/8e7bbc1268451777fc4223d5f8b88534ad748cec)]:
  - @smoove/core@0.3.6
