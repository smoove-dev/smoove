# @smoove/transitions

## 0.4.1

### Patch Changes

- Updated dependencies [[`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b)]:
  - @smoove/core@0.4.1

## 0.4.0

### Patch Changes

- [#29](https://github.com/smoove-dev/smoove/pull/29) [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326) Thanks [@shemi](https://github.com/shemi)! - Add `@smoove/effects` with `flameWrap`: fire wrapped around a node, with heat distortion, sparks, a molten rim, smoke and scorching. It wraps the node's rounded box by default (`radius` to match your corners) or its alpha edge with `shape: "silhouette"`, so a burning `Text` burns letter by letter. Nodes and Sequences gain an `effects` chain (`card.effects([flameWrap()])`), and effects read the frame clock, so a burn scrubs and renders the same in the browser and on the server.

  The WebGL bridge moves from `@smoove/transitions` into `@smoove/core` so both transitions and effects share one compositor. Everything is re-exported from `@smoove/transitions`, so existing imports keep working.

- Updated dependencies [[`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af), [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326), [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af), [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af)]:
  - @smoove/core@0.4.0

## 0.3.6

### Patch Changes

- [`5c49115`](https://github.com/smoove-dev/smoove/commit/5c49115e0c64c11779f7702adce321764aac50ea) Thanks [@shemi](https://github.com/shemi)! - Fix a scene inheriting its own exit transition on the next pass over the
  timeline. A presentation only sets the state it animates, and nothing put that
  state back when the scene left range, so after a loop (or a scrub backwards) a
  scene re-entered still carrying the transform its outgoing transition left
  behind. Any incoming presentation that didn't happen to own the same property
  kept it for the whole overlap — with `none()`, which owns nothing, the scene
  played its entire hand-off translated off-screen and snapped into place the
  frame the overlap ended. Each transitioning scene now resets its layer before
  the presentation applies, so what a frame looks like depends only on that frame.
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

- [`15a1d0d`](https://github.com/smoove-dev/smoove/commit/15a1d0deae232c1f03712c4a3d1be98e5191da87) Thanks [@shemi](https://github.com/shemi)! - Fix scene bleed-through during Tier B (GL) transitions. The two scene layers a shader transition blends were still painting at full opacity beneath the overlay, so wherever the composited overlay wasn't fully opaque (e.g. a scene that reads over a shared base layer) the raw layers showed through — the incoming scene appeared from the transition's first frame and the outgoing scene lingered on its last. The overlay now hides both scene layers for the duration of the overlap so only the blended result paints, over the same backdrop each scene composites over normally. The incoming scene is drawn synchronously on the frame it is revealed so live preview doesn't flash a stale frame after the transition ends.

- Updated dependencies []:
  - @smoove/core@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies [[`e21d9ca`](https://github.com/smoove-dev/smoove/commit/e21d9ca2f2e94742bda897c855e8332a1b032804)]:
  - @smoove/core@0.3.2

## 0.3.1

### Patch Changes

- [#17](https://github.com/smoove-dev/smoove/pull/17) [`f94883e`](https://github.com/smoove-dev/smoove/commit/f94883ea196f7bc435f2f5ca7122aa54c40574f3) Thanks [@shemi](https://github.com/shemi)! - Timeline markers: name a scene in a `Series` or `TransitionSeries` and anchor anything to it. `series.marker("code")` returns a lazily-resolving handle with `start`, `end`, and `settled` points (each offsettable via `.add(n)`); `from:` accepts a marker anywhere a frame number worked, `Sequence` gains a marker-aware `until:`, and standalone sequences hand out their own via `sequence.marker()`. Retime a beat and every cue anchored to it moves in lockstep.

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

- Updated dependencies []:
  - @smoove/core@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies []:
  - @smoove/core@0.1.7
