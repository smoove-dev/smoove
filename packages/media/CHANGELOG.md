# @smoove/media

## 0.5.0

### Patch Changes

- [#39](https://github.com/smoove-dev/smoove/pull/39) [`a5ef1f7`](https://github.com/smoove-dev/smoove/commit/a5ef1f7687310f6047cd5c8a14073c0315a69bfc) Thanks [@shemi](https://github.com/shemi)! - A coding agent can now see the studio. The new `@smoove/agent` package is a dev-server bridge: while the studio runs, an agent asks the open tab for its status, moves it to a composition and frame, and gets a frame back as a PNG under `.smoove/snaps/`, drawn by the real tab without moving the user's playhead. `@smoove/vite` mounts the bridge in development (turn it off with `smoove({ agent: false })`), it writes `.smoove/agent.json` with the URL and a per-run token, and `<Studio>` connects to it unless you pass `agent={false}`. In the preview, a seeking video now holds `renderFrame()` until the right frame lands, so a snapshot shows the video at the requested frame.

- [#41](https://github.com/smoove-dev/smoove/pull/41) [`c5bb99c`](https://github.com/smoove-dev/smoove/commit/c5bb99ce9abc55596d08d657ab4667396d34e15c) Thanks [@shemi](https://github.com/shemi)! - The `smoove` command. Run it from a studio project: `smoove agent start` runs the dev server in the background and prints the URL to give the user, `smoove agent snap` and `smoove agent sheet` write a frame or a contact sheet (one tile per beat) as a PNG, `smoove agent timeline` lists the beats and sequences in frames, `smoove agent seek` moves the user's playhead, and `smoove render` renders through the studio's queue. Every command takes `--json`. A request about a composition nobody has open goes to a headless Chrome the dev server starts on its own, so looking never changes what the user sees.

  In core, `plan()` names each marker after its key (`marker.name`), and a composition takes its plan with `new Composition({ plan })` or `comp.setPlan()`, so tools can find each beat. In the preview, a video that's still loading now holds `renderFrame()` until it can draw the requested frame.

- Updated dependencies [[`6aa4d05`](https://github.com/smoove-dev/smoove/commit/6aa4d053bf7ecd8f167e709259800e42b1fdbe5c), [`c5bb99c`](https://github.com/smoove-dev/smoove/commit/c5bb99ce9abc55596d08d657ab4667396d34e15c), [`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f)]:
  - @smoove/core@0.5.0

## 0.4.2

### Patch Changes

- Updated dependencies [[`5b2420d`](https://github.com/smoove-dev/smoove/commit/5b2420da72645d8c30c4bd90a2e9f9b93c151f44)]:
  - @smoove/core@0.4.2

## 0.4.1

### Patch Changes

- [#34](https://github.com/smoove-dev/smoove/pull/34) [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b) Thanks [@shemi](https://github.com/shemi)! - A hidden `Video` stops decoding. When the video, or any group above it, is `visible(false)`, it skips the seek and decode for that frame, since nothing would paint it. Its sound plays on: audio follows the sequence range, `setMuted()` and `setVolume()`, never visibility.

  That makes hiding the cheap way to cut away from footage. Put a full-screen graphic over the speaker and hide their `Video`, and the voice keeps going while the decoder rests. Showing it again seeks straight to the current frame, and a server render still waits for that frame before capturing it.

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

- [#21](https://github.com/smoove-dev/smoove/pull/21) [`f965fa3`](https://github.com/smoove-dev/smoove/commit/f965fa3ecb66d99a395eed79aab14f3c1f888420) Thanks [@shemi](https://github.com/shemi)! - `probeMedia(src)` reads a media file's container metadata (duration, video size, track shape) without decoding frames, in the browser and in Node. Await it at module top level and feed `meta.durationInFrames(fps)` into a timeline plan so real clip lengths drive the beat layout. Results are memoized per src.

- Updated dependencies [[`f965fa3`](https://github.com/smoove-dev/smoove/commit/f965fa3ecb66d99a395eed79aab14f3c1f888420)]:
  - @smoove/core@0.3.4

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
