# @smoove/renderer

## 0.5.1

### Patch Changes

- Updated dependencies [[`2c0d29e`](https://github.com/smoove-dev/smoove/commit/2c0d29e6e7a6772993a923bdf5588144671d6c75)]:
  - @smoove/core@0.5.1
  - @smoove/transitions@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [[`6aa4d05`](https://github.com/smoove-dev/smoove/commit/6aa4d053bf7ecd8f167e709259800e42b1fdbe5c), [`c5bb99c`](https://github.com/smoove-dev/smoove/commit/c5bb99ce9abc55596d08d657ab4667396d34e15c), [`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f)]:
  - @smoove/core@0.5.0
  - @smoove/transitions@0.5.0

## 0.4.2

### Patch Changes

- Updated dependencies [[`5b2420d`](https://github.com/smoove-dev/smoove/commit/5b2420da72645d8c30c4bd90a2e9f9b93c151f44)]:
  - @smoove/core@0.4.2
  - @smoove/transitions@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [[`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b)]:
  - @smoove/core@0.4.1
  - @smoove/transitions@0.4.1

## 0.4.0

### Patch Changes

- [#29](https://github.com/smoove-dev/smoove/pull/29) [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326) Thanks [@shemi](https://github.com/shemi)! - Add `@smoove/effects` with `flameWrap`: fire wrapped around a node, with heat distortion, sparks, a molten rim, smoke and scorching. It wraps the node's rounded box by default (`radius` to match your corners) or its alpha edge with `shape: "silhouette"`, so a burning `Text` burns letter by letter. Nodes and Sequences gain an `effects` chain (`card.effects([flameWrap()])`), and effects read the frame clock, so a burn scrubs and renders the same in the browser and on the server.

  The WebGL bridge moves from `@smoove/transitions` into `@smoove/core` so both transitions and effects share one compositor. Everything is re-exported from `@smoove/transitions`, so existing imports keep working.

- [#31](https://github.com/smoove-dev/smoove/pull/31) [`6b058bb`](https://github.com/smoove-dev/smoove/commit/6b058bb533d9dfae7d1b17d8b63b17a043518d5f) Thanks [@shemi](https://github.com/shemi)! - Fix server renders getting slower the longer they run, on compositions that use shader effects or shader transitions. The canvas that carries a GL frame back into skia was never truncated, so each readback appended to a drawing record that the next pixel read replayed from the start. Cost grew with frame count, and a long export could crawl to a halt well before it finished.

  Per-frame cost now holds flat for the length of a render. On a 400 frame shader-effect composition at 1280x720, the last twenty frames used to cost eight times what the first twenty did, with memory climbing past 1.7 GB. Both stay steady.

- Updated dependencies [[`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af), [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326), [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af), [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af)]:
  - @smoove/core@0.4.0
  - @smoove/transitions@0.4.0

## 0.3.6

### Patch Changes

- Updated dependencies [[`8e7bbc1`](https://github.com/smoove-dev/smoove/commit/8e7bbc1268451777fc4223d5f8b88534ad748cec), [`5c49115`](https://github.com/smoove-dev/smoove/commit/5c49115e0c64c11779f7702adce321764aac50ea)]:
  - @smoove/core@0.3.6
  - @smoove/transitions@0.3.6

## 0.3.5

### Patch Changes

- Updated dependencies [[`e3df493`](https://github.com/smoove-dev/smoove/commit/e3df49360b6c2746a24b89895a98939e8ce1a5e4)]:
  - @smoove/core@0.3.5
  - @smoove/transitions@0.3.5

## 0.3.4

### Patch Changes

- Updated dependencies [[`f965fa3`](https://github.com/smoove-dev/smoove/commit/f965fa3ecb66d99a395eed79aab14f3c1f888420)]:
  - @smoove/core@0.3.4
  - @smoove/transitions@0.3.4

## 0.3.3

### Patch Changes

- Updated dependencies [[`15a1d0d`](https://github.com/smoove-dev/smoove/commit/15a1d0deae232c1f03712c4a3d1be98e5191da87)]:
  - @smoove/transitions@0.3.3
  - @smoove/core@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies [[`e21d9ca`](https://github.com/smoove-dev/smoove/commit/e21d9ca2f2e94742bda897c855e8332a1b032804)]:
  - @smoove/core@0.3.2
  - @smoove/transitions@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [[`f94883e`](https://github.com/smoove-dev/smoove/commit/f94883ea196f7bc435f2f5ca7122aa54c40574f3)]:
  - @smoove/core@0.3.1
  - @smoove/transitions@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [[`02bb26c`](https://github.com/smoove-dev/smoove/commit/02bb26cb64d605f8f478b6d4221fa9f037d98063)]:
  - @smoove/core@0.3.0
  - @smoove/transitions@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [[`194d6b2`](https://github.com/smoove-dev/smoove/commit/194d6b28bd7c6f804343038c4f91626766f8a912), [`1d08c62`](https://github.com/smoove-dev/smoove/commit/1d08c623b1efa3864257ccdbfcff8d9210246821), [`bce47d8`](https://github.com/smoove-dev/smoove/commit/bce47d880632b3c3149368f8416772c7b35c15c5), [`3139b13`](https://github.com/smoove-dev/smoove/commit/3139b13a10f650e625096e17b7dab07f28763010)]:
  - @smoove/core@0.2.0
  - @smoove/transitions@0.2.0

## 0.1.8

### Patch Changes

- Updated dependencies []:
  - @smoove/core@0.1.8
  - @smoove/transitions@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies []:
  - @smoove/core@0.1.7
  - @smoove/transitions@0.1.7
