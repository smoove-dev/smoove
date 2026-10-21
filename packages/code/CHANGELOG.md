# @smoove/code

## 0.5.2

### Patch Changes

- Updated dependencies [[`9ebd2b3`](https://github.com/smoove-dev/smoove/commit/9ebd2b3a0f3b574d177682fc9d5adfc08d695148)]:
  - @smoove/core@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [[`2c0d29e`](https://github.com/smoove-dev/smoove/commit/2c0d29e6e7a6772993a923bdf5588144671d6c75)]:
  - @smoove/core@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [[`6aa4d05`](https://github.com/smoove-dev/smoove/commit/6aa4d053bf7ecd8f167e709259800e42b1fdbe5c), [`c5bb99c`](https://github.com/smoove-dev/smoove/commit/c5bb99ce9abc55596d08d657ab4667396d34e15c), [`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f)]:
  - @smoove/core@0.5.0

## 0.4.2

### Patch Changes

- Updated dependencies [[`5b2420d`](https://github.com/smoove-dev/smoove/commit/5b2420da72645d8c30c4bd90a2e9f9b93c151f44)]:
  - @smoove/core@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [[`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b)]:
  - @smoove/core@0.4.1

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

- Updated dependencies [[`8e7bbc1`](https://github.com/smoove-dev/smoove/commit/8e7bbc1268451777fc4223d5f8b88534ad748cec)]:
  - @smoove/core@0.3.6

## 0.3.5

### Patch Changes

- Updated dependencies [[`e3df493`](https://github.com/smoove-dev/smoove/commit/e3df49360b6c2746a24b89895a98939e8ce1a5e4)]:
  - @smoove/core@0.3.5

## 0.3.4

### Patch Changes

- Updated dependencies [[`f965fa3`](https://github.com/smoove-dev/smoove/commit/f965fa3ecb66d99a395eed79aab14f3c1f888420)]:
  - @smoove/core@0.3.4

## 0.3.3

### Patch Changes

- Updated dependencies []:
  - @smoove/core@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies [[`e21d9ca`](https://github.com/smoove-dev/smoove/commit/e21d9ca2f2e94742bda897c855e8332a1b032804)]:
  - @smoove/core@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [[`f94883e`](https://github.com/smoove-dev/smoove/commit/f94883ea196f7bc435f2f5ca7122aa54c40574f3)]:
  - @smoove/core@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [[`02bb26c`](https://github.com/smoove-dev/smoove/commit/02bb26cb64d605f8f478b6d4221fa9f037d98063)]:
  - @smoove/core@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [[`194d6b2`](https://github.com/smoove-dev/smoove/commit/194d6b28bd7c6f804343038c4f91626766f8a912), [`1d08c62`](https://github.com/smoove-dev/smoove/commit/1d08c623b1efa3864257ccdbfcff8d9210246821), [`bce47d8`](https://github.com/smoove-dev/smoove/commit/bce47d880632b3c3149368f8416772c7b35c15c5), [`3139b13`](https://github.com/smoove-dev/smoove/commit/3139b13a10f650e625096e17b7dab07f28763010)]:
  - @smoove/core@0.2.0

## 0.1.8

### Patch Changes

- [#7](https://github.com/smoove-dev/smoove/pull/7) [`26cff06`](https://github.com/smoove-dev/smoove/commit/26cff0602b333e58cc0e0738e422fedcaeb4c5eb) Thanks [@shemi](https://github.com/shemi)! - Add `@smoove/code`: an animated, syntax-highlighted code node. `Code` renders highlighted source and morphs between snapshots with a per-token diff, driven by the frame. Ships `interpolateCode`, `interpolateEdit`, and `interpolateSelection`, a `LezerHighlighter` over any Lezer grammar, and a set of theme presets (`nordDark`, `nordLight`, `dracula`, `githubLight`, plus `makeHighlightStyle`).

- Updated dependencies []:
  - @smoove/core@0.1.8
