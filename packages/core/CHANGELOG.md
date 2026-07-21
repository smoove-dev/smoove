# @smoove/core

## 0.3.3

## 0.3.2

### Patch Changes

- [`e21d9ca`](https://github.com/smoove-dev/smoove/commit/e21d9ca2f2e94742bda897c855e8332a1b032804) Thanks [@shemi](https://github.com/shemi)! - Lifetime-independent measurement: `measure(node, { at? })` (also `.measure()` on every smoove wrapper) lays a node out on demand and returns its stage-space bounds, even inside a sequence that has never been on screen. Pass `{ at }` to measure at any local frame of the owning sequence; active sequences are restored to their live frame afterwards. `Text` measurements include per-line rects, glyph-tight ink bounds, and the alphabetic baseline, so masks and underlines can anchor to real glyph edges.

## 0.3.1

### Patch Changes

- [#17](https://github.com/smoove-dev/smoove/pull/17) [`f94883e`](https://github.com/smoove-dev/smoove/commit/f94883ea196f7bc435f2f5ca7122aa54c40574f3) Thanks [@shemi](https://github.com/shemi)! - Timeline markers: name a scene in a `Series` or `TransitionSeries` and anchor anything to it. `series.marker("code")` returns a lazily-resolving handle with `start`, `end`, and `settled` points (each offsettable via `.add(n)`); `from:` accepts a marker anywhere a frame number worked, `Sequence` gains a marker-aware `until:`, and standalone sequences hand out their own via `sequence.marker()`. Retime a beat and every cue anchored to it moves in lockstep.

## 0.3.0

### Minor Changes

- [#15](https://github.com/smoove-dev/smoove/pull/15) [`02bb26c`](https://github.com/smoove-dev/smoove/commit/02bb26cb64d605f8f478b6d4221fa9f037d98063) Thanks [@shemi](https://github.com/shemi)! - Extract the `Audio` and `Video` nodes (and their `mediabunny` decoders) into a
  new `@smoove/media` package. `@smoove/core` no longer depends on `mediabunny`
  (~10 MB) and no longer exports `Audio`, `Video`, `AudioConfig`, `VideoConfig`,
  `BrowserAudioSource`, `MediabunnyAudioSource`, `BrowserVideoSource`, or
  `MediabunnyVideoSource`.

  **Migration:** import media authoring from `@smoove/media` and add it as a
  dependency:

  ```ts
  // before
  import { Audio, Video } from "@smoove/core";
  // after
  import { Audio, Video } from "@smoove/media";
  ```

  Importing `@smoove/media` (browser) auto-registers its sources. `isAudioNode` /
  `isVideoNode` remain exported from `@smoove/core`. `@smoove/renderer` is
  unchanged for correctly-importing apps.

## 0.2.0

### Minor Changes

- [#11](https://github.com/smoove-dev/smoove/pull/11) [`194d6b2`](https://github.com/smoove-dev/smoove/commit/194d6b28bd7c6f804343038c4f91626766f8a912) Thanks [@shemi](https://github.com/shemi)! - `Audio` gains a `trim: { start, play }` play-window as friendlier sugar over `trimBefore`/`trimAfter` (maps to `trimBefore = start`, `trimAfter = start + play`), and `volume` now accepts values above `1` to amplify — honored by the preview Web Audio path and the render mux (the legacy `HTMLAudioElement` source still caps at `1`).

- [#10](https://github.com/smoove-dev/smoove/pull/10) [`1d08c62`](https://github.com/smoove-dev/smoove/commit/1d08c623b1efa3864257ccdbfcff8d9210246821) Thanks [@shemi](https://github.com/shemi)! - Add a `Group` container to `@smoove/core` — a thin `Konva.Group` subclass stamped with a marker attr (`isGroupNode`), mirroring how the media nodes flag themselves. Apps get the plain transform/grouping container without reaching into `Konva.*`, and the mark lets tooling tell author-created groups apart from the internal groups smoove builds inside `Text`/`Flex`. For automatic layout, reach for `Flex`/`Block`.

- [#12](https://github.com/smoove-dev/smoove/pull/12) [`bce47d8`](https://github.com/smoove-dev/smoove/commit/bce47d880632b3c3149368f8416772c7b35c15c5) Thanks [@shemi](https://github.com/shemi)! - Add `Text#setFill(color)` and `Text#setFont(font)` for post-construction mutation. `setFill` recolors without re-measuring; `setFont` swaps the face, re-lays-out, and re-lays-out again once the new face loads. Removes the need for the transparent-`highlight` tint workaround when animating text color.

- [#13](https://github.com/smoove-dev/smoove/pull/13) [`3139b13`](https://github.com/smoove-dev/smoove/commit/3139b13a10f650e625096e17b7dab07f28763010) Thanks [@shemi](https://github.com/shemi)! - `Text` now re-measures a bare `fontFamily` string once its webfont loads (browser). Previously only the declarative `font` prop reported readiness; a plain `fontFamily` measured against a fallback face and clipped (the "Comfortaa → Rote" bug), forcing an explicit `width` workaround. Core now probes `document.fonts.load(shorthand)` for the family and re-lays-out when it settles — no-op on the server (faces register up front) and harmless for missing/system fonts (it never rejects). Prefer the `font` prop with a `Font` for guaranteed buffering; its `whenReady()`/`isLoaded` remain the reliable readiness signal (unlike `document.fonts.check`, which reports `true` for fonts that don't exist).

## 0.1.8

## 0.1.7
