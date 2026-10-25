# @smoove/core

## 0.5.3

### Patch Changes

- [#54](https://github.com/smoove-dev/smoove/pull/54) [`54a320b`](https://github.com/smoove-dev/smoove/commit/54a320b2552e1eaa00b622647c70c895d926dec7) Thanks [@shemi](https://github.com/shemi)! - Photos keep their shape. `npx smoove agent check` has a new `layout/stretched` finding for a picture or video drawn at a different shape from its source, by `objectFit: "fill"` in a box of another shape or by scaling one axis more than the other. It's an error once it holds. Scale on a scene's own layer, like a `flip` transition, doesn't count.

  `media_info` now reads still images too, and reports a photo's size and shape as it draws, with a phone's rotation tag applied. Videos report their shape as well, and `asset_add` names it when it adds a picture.

## 0.5.2

### Patch Changes

- [#52](https://github.com/smoove-dev/smoove/pull/52) [`9ebd2b3`](https://github.com/smoove-dev/smoove/commit/9ebd2b3a0f3b574d177682fc9d5adfc08d695148) Thanks [@shemi](https://github.com/shemi)! - Server renders and composition tests no longer run out of memory on compositions with video.

  skia-canvas records every draw and replays the whole recording on each pixel read, and `clearRect` only adds to that recording. The Node video source, every Sequence layer and `captureCanvas()` cleared that way each frame, so they kept every frame they ever drew. A one-minute 1080p `Video` grew a `smoove test` run past 6 GB within a minute, and rendering it slowed from 16 fps to 8 fps before running out of memory. These canvases now `reset()` instead, which drops the recording. The same composition now renders all 1,817 frames at about 62 fps with memory flat under 1 GB.

## 0.5.1

### Patch Changes

- [#51](https://github.com/smoove-dev/smoove/pull/51) [`2c0d29e`](https://github.com/smoove-dev/smoove/commit/2c0d29e6e7a6772993a923bdf5588144671d6c75) Thanks [@shemi](https://github.com/shemi)! - Fixes from building a 30-second explainer in a fresh studio project.

  - `npx smoove agent check` no longer fails with "Maximum update depth exceeded" on a long composition. The contrast sweep drove the studio's React views through every sample; the studio now holds them while a check, snapshot or sheet draws frames, and they catch up once afterwards.
  - `appearsBy(selector, at)` passes when every match has been visible on some frame up to `at`, so a caption that fades out before `beats.hook.end` still counts. When a shared selector has a match that comes later, the finding says so and suggests a name of its own.
  - The contrast check leaves a Text that's partway through a fade for the frames where it holds, so a fade in or out no longer needs an allow entry.
  - A contact sheet's tile for a beat is two thirds of the way from its settled frame to its last frame before the next beat, instead of that last frame, so a scene that fades out shows up whole. Beats gain `heldTo`, the last frame of that held stretch, which the checks use as before.
  - After a hot reload that changes a composition's props schema, the studio fits the props someone edited to the new schema: dropped keys go, new keys get their defaults, and edits to keys that stay are kept.
  - `smoove test` hands its arguments to Vitest (`smoove test compositions/intro -t checks --reporter=default`), and a test gets a minute by default, so a check sweep over a long composition doesn't time out.

## 0.5.0

### Patch Changes

- [#44](https://github.com/smoove-dev/smoove/pull/44) [`6aa4d05`](https://github.com/smoove-dev/smoove/commit/6aa4d053bf7ecd8f167e709259800e42b1fdbe5c) Thanks [@shemi](https://github.com/shemi)! - `smoove agent check`: one command that sweeps a composition for what you'd otherwise catch by watching, and names the node, frames, beat and source line of each finding. It lints the project for code that breaks scrubbing, then, in the studio's headless tab, compares jumped-to frames with playback, finds layout children moved by x or y, text cut by an ellipsis or running off the canvas, low contrast against what's really behind the text, colors and fonts outside the declared palette, frozen stretches, and the intents in a composition's checks file. `@smoove/core/testing` gains `runChecks`, `defineChecks` and the intents `appearsBy`, `before`, `staysInFrame` and `keepsMoving`, so a test can hold a composition to the same checks. `@smoove/core` exports `parseColor`, `contrastRatio` and `relativeLuminance`. A studio registry entry takes an optional `checks` import.

- [#41](https://github.com/smoove-dev/smoove/pull/41) [`c5bb99c`](https://github.com/smoove-dev/smoove/commit/c5bb99ce9abc55596d08d657ab4667396d34e15c) Thanks [@shemi](https://github.com/shemi)! - The `smoove` command. Run it from a studio project: `smoove agent start` runs the dev server in the background and prints the URL to give the user, `smoove agent snap` and `smoove agent sheet` write a frame or a contact sheet (one tile per beat) as a PNG, `smoove agent timeline` lists the beats and sequences in frames, `smoove agent seek` moves the user's playhead, and `smoove render` renders through the studio's queue. Every command takes `--json`. A request about a composition nobody has open goes to a headless Chrome the dev server starts on its own, so looking never changes what the user sees.

  In core, `plan()` names each marker after its key (`marker.name`), and a composition takes its plan with `new Composition({ plan })` or `comp.setPlan()`, so tools can find each beat. In the preview, a video that's still loading now holds `renderFrame()` until it can draw the requested frame.

- [#46](https://github.com/smoove-dev/smoove/pull/46) [`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f) Thanks [@shemi](https://github.com/shemi)! - A studio project is now just its compositions. The studio app ships inside `@smoove/studio` and runs from there, so `npm create smoove studio` writes a `compositions/` folder, an empty `smoove.config.ts`, and a `package.json` with every smoove package installed, and studio updates arrive with the package.

  Each composition is a folder under `compositions/` with an `index.ts` that default-exports its registry entry. The studio finds them itself, so there's no `registry.ts` to edit: add a folder and it shows up in the sidebar. A folder without an `index.ts`, or two folders with the same id, is reported by name in the terminal and in the studio.

  `smoove.config.ts` takes `defineConfig({ name, logo, primaryColor, render })`. `render: false` hides the render buttons and the queue and turns the render routes off.

  `npx smoove studio detach` copies the app into the project's `studio/` folder for good, when you want to change the studio itself. The copy keeps finding compositions and reading `smoove.config.ts` through the new `smooveStudio()` Vite plugin (`@smoove/studio/vite`).

  `smoove()` from `@smoove/vite` takes a `root` option, for when the project root isn't Vite's root. In core, `defineChecks()` and `runChecks()` accept a composition with typed props.

  To move an existing studio project over: move `src/compositions/*` to `compositions/`, delete the app files (`src/`, `vite.config.ts`, `react-router.config.ts`, `vitest.config.ts`), add `smoove.config.ts`, and take the scripts, dependencies and `tsconfig.json` from a fresh `npm create smoove studio`. Projects that keep their own app keep working as they are.

## 0.4.2

### Patch Changes

- [#36](https://github.com/smoove-dev/smoove/pull/36) [`5b2420d`](https://github.com/smoove-dev/smoove/commit/5b2420da72645d8c30c4bd90a2e9f9b93c151f44) Thanks [@shemi](https://github.com/shemi)! - A `Text` with no width now re-measures when its font face finishes loading. It used to keep the width it measured against the fallback face, so a label in a wider face got clipped, most visibly with `wrap: "none"`. Now it hugs the loaded glyphs, as the fonts guide promises, and no longer needs an explicit width.

  ```ts
  const mono = new IBMPlexMono({ weights: ["400"] });
  seq.add(mono);
  seq.add(
    new Text({
      text: "radius 6  stroke 2  snappy",
      font: mono.face("400"),
      fontSize: 26,
      wrap: "none",
    }),
  );
  ```

  `setFont()` re-hugs the same way, on the swap and again when the new face loads.

## 0.4.1

### Patch Changes

- [#34](https://github.com/smoove-dev/smoove/pull/34) [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b) Thanks [@shemi](https://github.com/shemi)! - A `Flex` or `Block` inside a plain `Group` now reflows during playback. Every frame, a `Sequence` or `Clip` lays out each layout below it that no other layout places, at any depth, so a component that wraps its layout in a `Group` for a transform plays and seeks correctly. Before, only layouts added straight to the `Sequence` or `Clip` were reflowed, and one behind a `Group` painted at stale positions on a seek.

  ```ts
  const body = new Group({ x: 540, y: 900, scaleX: 1.1, scaleY: 1.1 });
  clip.add(body);
  body.add(row); // a Block: now laid out every frame, no measure() call needed
  ```

  `measure()` lays out the root that actually places the node, so a layout behind a `Group` that itself sits inside another layout measures correctly too.

  A plain `Group` can also sit directly in a `Flex`/`Block` now. It's placed at its slot; before, the layout pass threw.

- [#34](https://github.com/smoove-dev/smoove/pull/34) [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b) Thanks [@shemi](https://github.com/shemi)! - `Text` highlights repaint on their own. Mutate a highlight in place from an updater (`hl.progress = …`, or move `start`/`end` to box the word being spoken) and the marks update on the same frame, wherever the `Text` sits. Before, a `Text` added straight to a sequence, with no typewriter and no flex parent, only repainted after a call to the internal `_layoutText()`.

  ```ts
  const spoken: HighlightConfig = { start: 0, end: 5, background: "#FFD43B" };
  const caption = new Text({
    text: "hello world",
    fontSize: 72,
    highlights: [spoken],
  });
  seq.add(caption);
  seq.register((frame) => {
    spoken.progress = interpolate(frame, [0, 4], [0, 1], {
      extrapolateRight: "clamp",
    });
  });
  ```

  Replacing the array with `setAttr("highlights", [...])` repaints right away. A frame where no highlight changed skips the repaint.

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

- [#34](https://github.com/smoove-dev/smoove/pull/34) [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b) Thanks [@shemi](https://github.com/shemi)! - Add `Text.getText()`, the read side of `setText()`. It returns the full content you set, even while an ellipsis trims the line or a typewriter is halfway through, so a test can check a counter or a caption without reaching into private fields.

  ```ts
  counter.setText("45,999");
  counter.getText(); // "45,999"
  ```

## 0.4.0

### Minor Changes

- [#32](https://github.com/smoove-dev/smoove/pull/32) [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af) Thanks [@shemi](https://github.com/shemi)! - `Block` borders now follow the CSS box model.

  Three things change, all of them visible.

  Per-edge `borderColor` and `borderSize` are painted rather than collapsed. The
  types have always accepted `[top, right, bottom, left]`, but the implementation
  stroked the whole outline at the largest of the four widths in the first colour.
  Edges that differ are now drawn as four mitred bands, clipped to the corner
  radius; a uniform border still takes the single-stroke path, so dashes and
  rounded corners are unaffected.

  A border occupies layout space. It insets the content box the way CSS does,
  without changing the node's own size — a 20px border on a 240x120 `Block` now
  leaves 200x80 for its children, where before the border reserved nothing and
  overlapped its own content.

  A border paints inside the box. Canvas centres a stroke on its path, so a border
  used to sit half outside the node's bounds. It is now drawn wholly inside, which
  moves a uniform border inward by half its width. At the 1-4px borders most
  layouts use the shift is a pixel or two; a thick border will move noticeably.

  `borderStyle: "dashed"` still requires a uniform border. Dashes ride a stroked
  path, which per-edge painting replaces with filled polygons, so a dashed border
  whose edges differ paints solid instead.

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

### Patch Changes

- [#29](https://github.com/smoove-dev/smoove/pull/29) [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326) Thanks [@shemi](https://github.com/shemi)! - Add `@smoove/effects` with `flameWrap`: fire wrapped around a node, with heat distortion, sparks, a molten rim, smoke and scorching. It wraps the node's rounded box by default (`radius` to match your corners) or its alpha edge with `shape: "silhouette"`, so a burning `Text` burns letter by letter. Nodes and Sequences gain an `effects` chain (`card.effects([flameWrap()])`), and effects read the frame clock, so a burn scrubs and renders the same in the browser and on the server.

  The WebGL bridge moves from `@smoove/transitions` into `@smoove/core` so both transitions and effects share one compositor. Everything is re-exported from `@smoove/transitions`, so existing imports keep working.

- [#32](https://github.com/smoove-dev/smoove/pull/32) [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af) Thanks [@shemi](https://github.com/shemi)! - Fix two layout bugs found by the new layout conformance suite.

  An `Image` with no explicit `width`/`height` measured 0x0 and contributed
  nothing to a `Flex`/`Block`, even though every other leaf reports its intrinsic
  size. It now measures its bitmap's natural dimensions, matching the raw
  `Konva.Image` fallback and the documented behaviour.

  Content added to a `Sequence` after that sequence was already activated at the
  current frame was never laid out until the playhead moved — which included the
  common `comp.add(seq)` then build then `setFrame(0)` order, leaving frame 0
  un-laid-out for a first paint or a headless still capture. The frame dedupe in
  `Composition.setFrame` and `Sequence._apply` now takes the scene-graph structure
  version into account, so a structural change makes the same frame worth
  re-applying.

## 0.3.6

### Patch Changes

- [#27](https://github.com/smoove-dev/smoove/pull/27) [`8e7bbc1`](https://github.com/smoove-dev/smoove/commit/8e7bbc1268451777fc4223d5f8b88534ad748cec) Thanks [@shemi](https://github.com/shemi)! - Add `@smoove/core/testing` probes, `Text.setFontSize`, CSS corner clamping on
  `Image`, and a seeded `random`.

  The new `@smoove/core/testing` subpath answers "what is on screen at this
  frame" from a test. `probe(comp, selector)` reports each matching node's
  stage-space box, effective opacity, whether it actually paints, and the fill it
  resolved to; `probeAt(comp, at, selector)` drives the clock first, by frame or
  by `{ time }` in seconds; `countAt` is the count of what paints. A spec that
  says "26 elements at 6.0s" is now one assertion instead of a session in the
  browser console. `Block` reports its resolved background through the same
  probe, which it could not before because a `Block` paints through an internal
  rect.

  `Text` gained `fontSize()` and `setFontSize()`. Resizing text after
  construction meant destroying the node and rebuilding it, and tracking the size
  in composition state because nothing read it back. `fontSize()` reports the
  size the glyphs actually render at, so with `fitText` you get the fitted size
  rather than the one you asked for.

  `Image` now clamps its corner radii the way CSS does: when two radii sharing an
  edge overflow it, all four scale by one common factor. `cornerRadius: 9999` on
  a square is the standard way to ask for a disc, and it used to draw a squircle.

  `random(seed)` is a seeded generator (`range`, `int`, `pick`) for compositions
  that need scatter. `Math.random` breaks frame purity, so every composition was
  hand-rolling one of these with its own constants.

## 0.3.5

### Patch Changes

- [#23](https://github.com/smoove-dev/smoove/pull/23) [`e3df493`](https://github.com/smoove-dev/smoove/commit/e3df49360b6c2746a24b89895a98939e8ce1a5e4) Thanks [@shemi](https://github.com/shemi)! - feat: Clip nested timelines and shareable components. `Clip` is a range-gated, tickable Group with Sequence's option set (`from`/`durationInFrames`/`until`/`span`), nestable to any depth; components are plain functions returning a Clip. Updaters on Sequence and Clip now receive a second `FrameInfo` argument (`{ time, fps, durationInFrames, globalFrame }`). Every smoove node gains `getComposition()`/`getSequence()`/`getClip()`, and Composition/Sequence/Clip gain structure-version-cached `query()`/`queryOne()`. Sequence's internals moved onto a shared timeline mixin; public behavior is unchanged. Also fixes a flex layout bug: children of an `alignItems: "center"`/`"flex-end"` container with a hug (auto) cross size rendered at NaN positions (flexily computes the cross offset against the unresolved size); write-back now re-derives the offset from the resolved sizes.

## 0.3.4

### Patch Changes

- [#21](https://github.com/smoove-dev/smoove/pull/21) [`f965fa3`](https://github.com/smoove-dev/smoove/commit/f965fa3ecb66d99a395eed79aab14f3c1f888420) Thanks [@shemi](https://github.com/shemi)! - Declared timeline markers for planning a composition up front. `new Marker({ start, durationInFrames })` creates a named time range directly (start accepts any anchor, so markers chain: `start: intro.end`), and `plan()` lays out a whole set of named beats in one call with per-beat gap/overlap offsets. `Composition` now accepts a marker point as `durationInFrames` (resolved lazily, so the comp ends where the last beat ends), and `Sequence` gains `span: marker` as sugar for covering exactly a marker's range. Declared and Series-derived markers interoperate: either can anchor the other.

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
