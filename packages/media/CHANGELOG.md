# @smoove/media

## 0.3.3

### Patch Changes

- Updated dependencies []:
  - @smoove/core@0.3.3

## 0.3.2

### Patch Changes

- [`e21d9ca`](https://github.com/smoove-dev/smoove/commit/e21d9ca2f2e94742bda897c855e8332a1b032804) Thanks [@shemi](https://github.com/shemi)! - `Video` gains the same `.measure()` as the core wrappers: stage-space bounds on demand, at any frame, without seeking or decoding the clip.

- Updated dependencies [[`e21d9ca`](https://github.com/smoove-dev/smoove/commit/e21d9ca2f2e94742bda897c855e8332a1b032804)]:
  - @smoove/core@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [[`f94883e`](https://github.com/smoove-dev/smoove/commit/f94883ea196f7bc435f2f5ca7122aa54c40574f3)]:
  - @smoove/core@0.3.1

## 0.3.0

### Minor Changes

- [#15](https://github.com/smoove-dev/smoove/pull/15) [`02bb26c`](https://github.com/smoove-dev/smoove/commit/02bb26cb64d605f8f478b6d4221fa9f037d98063) Thanks [@shemi](https://github.com/shemi)! - Audio introspection: pass `introspect: true` (or `{ bands: N }`) to `Audio` and
  read the clip's real sound as frame-pure signals — `rmsAt(frame)` /
  `peakAt(frame, { holdFrames })` for loudness (with a `{ normalized: true }`
  option), `bandsAt(frame)` / `noveltyAt(frame)` for spectrum and onsets,
  `waveform(from, to, buckets)` for a static outline, and the raw table on the
  `audio.envelope` signal (exported as `AudioEnvelope`). Everything is decoded
  once before frame 0 in both preview and server renders, so audio-reactive
  visuals (meters, EQ bars, waveforms, beat-synced motion) scrub and render
  deterministically.

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

### Patch Changes

- [#15](https://github.com/smoove-dev/smoove/pull/15) [`02bb26c`](https://github.com/smoove-dev/smoove/commit/02bb26cb64d605f8f478b6d4221fa9f037d98063) Thanks [@shemi](https://github.com/shemi)! - Escape hatches for advanced media work. `audio.source` and `video.source`
  return the node's live media source, and the default Mediabunny sources
  expose their `input` demuxer for direct mediabunny access (track metadata,
  extra sinks). The audio analysis utilities also ship as plain functions:
  `buildEnvelope(src, opts)` decodes any file into an `AudioEnvelope`, read
  with `envelopeRmsAt`, `envelopePeakAt`, `envelopeBandsAt`,
  `envelopeNoveltyAt`, and `envelopeWaveform`.
- Updated dependencies [[`02bb26c`](https://github.com/smoove-dev/smoove/commit/02bb26cb64d605f8f478b6d4221fa9f037d98063)]:
  - @smoove/core@0.3.0
