# @smoove/studio

## 0.5.1

### Patch Changes

- [#51](https://github.com/smoove-dev/smoove/pull/51) [`2c0d29e`](https://github.com/smoove-dev/smoove/commit/2c0d29e6e7a6772993a923bdf5588144671d6c75) Thanks [@shemi](https://github.com/shemi)! - Fixes from building a 30-second explainer in a fresh studio project.

  - `npx smoove agent check` no longer fails with "Maximum update depth exceeded" on a long composition. The contrast sweep drove the studio's React views through every sample; the studio now holds them while a check, snapshot or sheet draws frames, and they catch up once afterwards.
  - `appearsBy(selector, at)` passes when every match has been visible on some frame up to `at`, so a caption that fades out before `beats.hook.end` still counts. When a shared selector has a match that comes later, the finding says so and suggests a name of its own.
  - The contrast check leaves a Text that's partway through a fade for the frames where it holds, so a fade in or out no longer needs an allow entry.
  - A contact sheet's tile for a beat is two thirds of the way from its settled frame to its last frame before the next beat, instead of that last frame, so a scene that fades out shows up whole. Beats gain `heldTo`, the last frame of that held stretch, which the checks use as before.
  - After a hot reload that changes a composition's props schema, the studio fits the props someone edited to the new schema: dropped keys go, new keys get their defaults, and edits to keys that stay are kept.
  - `smoove test` hands its arguments to Vitest (`smoove test compositions/intro -t checks --reporter=default`), and a test gets a minute by default, so a check sweep over a long composition doesn't time out.

- Updated dependencies [[`2c0d29e`](https://github.com/smoove-dev/smoove/commit/2c0d29e6e7a6772993a923bdf5588144671d6c75)]:
  - @smoove/core@0.5.1
  - @smoove/agent@0.5.1
  - @smoove/vite@0.5.1
  - @smoove/player@0.5.1
  - @smoove/renderer@0.5.1

## 0.5.0

### Minor Changes

- [#46](https://github.com/smoove-dev/smoove/pull/46) [`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f) Thanks [@shemi](https://github.com/shemi)! - A studio project is now just its compositions. The studio app ships inside `@smoove/studio` and runs from there, so `npm create smoove studio` writes a `compositions/` folder, an empty `smoove.config.ts`, and a `package.json` with every smoove package installed, and studio updates arrive with the package.

  Each composition is a folder under `compositions/` with an `index.ts` that default-exports its registry entry. The studio finds them itself, so there's no `registry.ts` to edit: add a folder and it shows up in the sidebar. A folder without an `index.ts`, or two folders with the same id, is reported by name in the terminal and in the studio.

  `smoove.config.ts` takes `defineConfig({ name, logo, primaryColor, render })`. `render: false` hides the render buttons and the queue and turns the render routes off.

  `npx smoove studio detach` copies the app into the project's `studio/` folder for good, when you want to change the studio itself. The copy keeps finding compositions and reading `smoove.config.ts` through the new `smooveStudio()` Vite plugin (`@smoove/studio/vite`).

  `smoove()` from `@smoove/vite` takes a `root` option, for when the project root isn't Vite's root. In core, `defineChecks()` and `runChecks()` accept a composition with typed props.

  To move an existing studio project over: move `src/compositions/*` to `compositions/`, delete the app files (`src/`, `vite.config.ts`, `react-router.config.ts`, `vitest.config.ts`), add `smoove.config.ts`, and take the scripts, dependencies and `tsconfig.json` from a fresh `npm create smoove studio`. Projects that keep their own app keep working as they are.

### Patch Changes

- [#39](https://github.com/smoove-dev/smoove/pull/39) [`a5ef1f7`](https://github.com/smoove-dev/smoove/commit/a5ef1f7687310f6047cd5c8a14073c0315a69bfc) Thanks [@shemi](https://github.com/shemi)! - A coding agent can now see the studio. The new `@smoove/agent` package is a dev-server bridge: while the studio runs, an agent asks the open tab for its status, moves it to a composition and frame, and gets a frame back as a PNG under `.smoove/snaps/`, drawn by the real tab without moving the user's playhead. `@smoove/vite` mounts the bridge in development (turn it off with `smoove({ agent: false })`), it writes `.smoove/agent.json` with the URL and a per-run token, and `<Studio>` connects to it unless you pass `agent={false}`. In the preview, a seeking video now holds `renderFrame()` until the right frame lands, so a snapshot shows the video at the requested frame.

- [#44](https://github.com/smoove-dev/smoove/pull/44) [`6aa4d05`](https://github.com/smoove-dev/smoove/commit/6aa4d053bf7ecd8f167e709259800e42b1fdbe5c) Thanks [@shemi](https://github.com/shemi)! - `smoove agent check`: one command that sweeps a composition for what you'd otherwise catch by watching, and names the node, frames, beat and source line of each finding. It lints the project for code that breaks scrubbing, then, in the studio's headless tab, compares jumped-to frames with playback, finds layout children moved by x or y, text cut by an ellipsis or running off the canvas, low contrast against what's really behind the text, colors and fonts outside the declared palette, frozen stretches, and the intents in a composition's checks file. `@smoove/core/testing` gains `runChecks`, `defineChecks` and the intents `appearsBy`, `before`, `staysInFrame` and `keepsMoving`, so a test can hold a composition to the same checks. `@smoove/core` exports `parseColor`, `contrastRatio` and `relativeLuminance`. A studio registry entry takes an optional `checks` import.

- [#41](https://github.com/smoove-dev/smoove/pull/41) [`c5bb99c`](https://github.com/smoove-dev/smoove/commit/c5bb99ce9abc55596d08d657ab4667396d34e15c) Thanks [@shemi](https://github.com/shemi)! - The `smoove` command. Run it from a studio project: `smoove agent start` runs the dev server in the background and prints the URL to give the user, `smoove agent snap` and `smoove agent sheet` write a frame or a contact sheet (one tile per beat) as a PNG, `smoove agent timeline` lists the beats and sequences in frames, `smoove agent seek` moves the user's playhead, and `smoove render` renders through the studio's queue. Every command takes `--json`. A request about a composition nobody has open goes to a headless Chrome the dev server starts on its own, so looking never changes what the user sees.

  In core, `plan()` names each marker after its key (`marker.name`), and a composition takes its plan with `new Composition({ plan })` or `comp.setPlan()`, so tools can find each beat. In the preview, a video that's still loading now holds `renderFrame()` until it can draw the requested frame.

- [#43](https://github.com/smoove-dev/smoove/pull/43) [`d2ea504`](https://github.com/smoove-dev/smoove/commit/d2ea504c7e9680da968b531b6f4b54e2ca43bf8c) Thanks [@shemi](https://github.com/shemi)! - Point at things in the studio. Drag a rectangle over the frame, and `smoove agent context` tells the agent what you marked: the frame and its beat, an image of the frame with your rectangle on it, and every node more than 60 percent inside, smallest first, with its name, type, text, box and the file and line that created it. Reading the mark clears it from the stage.

  In development, the Vite plugin tags each node created in a project file with where it was created, so even an unnamed node leads straight to its line. Production builds are untouched.

- [#42](https://github.com/smoove-dev/smoove/pull/42) [`c7325ad`](https://github.com/smoove-dev/smoove/commit/c7325ad40c0241a5e82be49508aa5f83073074f2) Thanks [@shemi](https://github.com/shemi)! - The studio fits a narrow window, such as a third of a laptop screen beside a coding agent's terminal. It picks a layout from its own width: below 640 pixels the library and the inspector open as drawers over the stage from header buttons, and from 640 to 1099 pixels the library can be collapsed and the inspector is a drawer. The timeline header wraps instead of spilling, the ruler spaces its labels to fit, the layered timeline takes a share of the height you can drag, and its tracks take their names from the composition's plan. Wide screens look as before.

  The agent bridge resends a request when the studio tab reloads while answering it (Vite reloads the page as it optimizes dependencies on a project's first run), instead of failing.

  `npm create smoove` installs the smoove-video skill for the studio template without asking, and works without a terminal. The studio template ships the `smoove` command, an AGENTS.md built around it, a CLAUDE.md pointer, pre-approved read-only `smoove` commands for Claude Code, and a sample composition that registers its plan.

- Updated dependencies [[`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f), [`a5ef1f7`](https://github.com/smoove-dev/smoove/commit/a5ef1f7687310f6047cd5c8a14073c0315a69bfc), [`6aa4d05`](https://github.com/smoove-dev/smoove/commit/6aa4d053bf7ecd8f167e709259800e42b1fdbe5c), [`c5bb99c`](https://github.com/smoove-dev/smoove/commit/c5bb99ce9abc55596d08d657ab4667396d34e15c), [`9d6ce76`](https://github.com/smoove-dev/smoove/commit/9d6ce7651ebb4d8470643f9c9bcec4773b2a14ab), [`d2ea504`](https://github.com/smoove-dev/smoove/commit/d2ea504c7e9680da968b531b6f4b54e2ca43bf8c), [`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f), [`c7325ad`](https://github.com/smoove-dev/smoove/commit/c7325ad40c0241a5e82be49508aa5f83073074f2)]:
  - @smoove/agent@0.5.0
  - @smoove/vite@0.5.0
  - @smoove/core@0.5.0
  - @smoove/player@0.5.0
  - @smoove/renderer@0.5.0

## 0.4.2

### Patch Changes

- Updated dependencies [[`5b2420d`](https://github.com/smoove-dev/smoove/commit/5b2420da72645d8c30c4bd90a2e9f9b93c151f44)]:
  - @smoove/core@0.4.2
  - @smoove/player@0.4.2
  - @smoove/renderer@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [[`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b)]:
  - @smoove/core@0.4.1
  - @smoove/player@0.4.1
  - @smoove/renderer@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [[`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af), [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326), [`6b058bb`](https://github.com/smoove-dev/smoove/commit/6b058bb533d9dfae7d1b17d8b63b17a043518d5f), [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af), [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af)]:
  - @smoove/core@0.4.0
  - @smoove/renderer@0.4.0
  - @smoove/player@0.4.0

## 0.3.6

### Patch Changes

- Updated dependencies [[`8e7bbc1`](https://github.com/smoove-dev/smoove/commit/8e7bbc1268451777fc4223d5f8b88534ad748cec)]:
  - @smoove/core@0.3.6
  - @smoove/player@0.3.6
  - @smoove/renderer@0.3.6

## 0.3.5

### Patch Changes

- Updated dependencies [[`e3df493`](https://github.com/smoove-dev/smoove/commit/e3df49360b6c2746a24b89895a98939e8ce1a5e4)]:
  - @smoove/core@0.3.5
  - @smoove/player@0.3.5
  - @smoove/renderer@0.3.5

## 0.3.4

### Patch Changes

- Updated dependencies [[`f965fa3`](https://github.com/smoove-dev/smoove/commit/f965fa3ecb66d99a395eed79aab14f3c1f888420)]:
  - @smoove/core@0.3.4
  - @smoove/player@0.3.4
  - @smoove/renderer@0.3.4

## 0.3.3

### Patch Changes

- Updated dependencies []:
  - @smoove/core@0.3.3
  - @smoove/player@0.3.3
  - @smoove/renderer@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies [[`e21d9ca`](https://github.com/smoove-dev/smoove/commit/e21d9ca2f2e94742bda897c855e8332a1b032804)]:
  - @smoove/core@0.3.2
  - @smoove/player@0.3.2
  - @smoove/renderer@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [[`f94883e`](https://github.com/smoove-dev/smoove/commit/f94883ea196f7bc435f2f5ca7122aa54c40574f3)]:
  - @smoove/core@0.3.1
  - @smoove/player@0.3.1
  - @smoove/renderer@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [[`02bb26c`](https://github.com/smoove-dev/smoove/commit/02bb26cb64d605f8f478b6d4221fa9f037d98063)]:
  - @smoove/core@0.3.0
  - @smoove/renderer@0.3.0
  - @smoove/player@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [[`194d6b2`](https://github.com/smoove-dev/smoove/commit/194d6b28bd7c6f804343038c4f91626766f8a912), [`1d08c62`](https://github.com/smoove-dev/smoove/commit/1d08c623b1efa3864257ccdbfcff8d9210246821), [`bce47d8`](https://github.com/smoove-dev/smoove/commit/bce47d880632b3c3149368f8416772c7b35c15c5), [`3139b13`](https://github.com/smoove-dev/smoove/commit/3139b13a10f650e625096e17b7dab07f28763010)]:
  - @smoove/core@0.2.0
  - @smoove/player@0.2.0
  - @smoove/renderer@0.2.0

## 0.1.8

### Patch Changes

- Updated dependencies [[`b4d6fdb`](https://github.com/smoove-dev/smoove/commit/b4d6fdb0f24d5775d9d26cc65d7ccfe5b8e66cbf)]:
  - @smoove/player@0.1.8
  - @smoove/core@0.1.8
  - @smoove/renderer@0.1.8

## 0.1.7

### Patch Changes

- [#5](https://github.com/smoove-dev/smoove/pull/5) [`060725d`](https://github.com/smoove-dev/smoove/commit/060725d6784ee4a702431ec93c06620b2336d9e5) Thanks [@shemi](https://github.com/shemi)! - Restyle the render and export dialogs to match the rest of the studio. The
  export-frame preview now shows the real captured frame, sized to the
  composition's aspect ratio, instead of a placeholder, and a still reports a
  realistic file size. In the render dialog, width and height stay locked to the
  source aspect ratio (edit either, the other follows) and the resolution preset
  dropdown is gone; the range control appears only when a loop region is set.
  Primary buttons use a solid accent color and form inputs are borderless filled
  fields, shared with the props inspector so the two surfaces stay consistent.
- Updated dependencies []:
  - @smoove/core@0.1.7
  - @smoove/player@0.1.7
  - @smoove/renderer@0.1.7
