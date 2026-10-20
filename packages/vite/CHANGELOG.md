# @smoove/vite

## 0.5.0

### Patch Changes

- [#39](https://github.com/smoove-dev/smoove/pull/39) [`a5ef1f7`](https://github.com/smoove-dev/smoove/commit/a5ef1f7687310f6047cd5c8a14073c0315a69bfc) Thanks [@shemi](https://github.com/shemi)! - A coding agent can now see the studio. The new `@smoove/agent` package is a dev-server bridge: while the studio runs, an agent asks the open tab for its status, moves it to a composition and frame, and gets a frame back as a PNG under `.smoove/snaps/`, drawn by the real tab without moving the user's playhead. `@smoove/vite` mounts the bridge in development (turn it off with `smoove({ agent: false })`), it writes `.smoove/agent.json` with the URL and a per-run token, and `<Studio>` connects to it unless you pass `agent={false}`. In the preview, a seeking video now holds `renderFrame()` until the right frame lands, so a snapshot shows the video at the requested frame.

- [#44](https://github.com/smoove-dev/smoove/pull/44) [`6aa4d05`](https://github.com/smoove-dev/smoove/commit/6aa4d053bf7ecd8f167e709259800e42b1fdbe5c) Thanks [@shemi](https://github.com/shemi)! - `smoove agent check`: one command that sweeps a composition for what you'd otherwise catch by watching, and names the node, frames, beat and source line of each finding. It lints the project for code that breaks scrubbing, then, in the studio's headless tab, compares jumped-to frames with playback, finds layout children moved by x or y, text cut by an ellipsis or running off the canvas, low contrast against what's really behind the text, colors and fonts outside the declared palette, frozen stretches, and the intents in a composition's checks file. `@smoove/core/testing` gains `runChecks`, `defineChecks` and the intents `appearsBy`, `before`, `staysInFrame` and `keepsMoving`, so a test can hold a composition to the same checks. `@smoove/core` exports `parseColor`, `contrastRatio` and `relativeLuminance`. A studio registry entry takes an optional `checks` import.

- [#43](https://github.com/smoove-dev/smoove/pull/43) [`d2ea504`](https://github.com/smoove-dev/smoove/commit/d2ea504c7e9680da968b531b6f4b54e2ca43bf8c) Thanks [@shemi](https://github.com/shemi)! - Point at things in the studio. Drag a rectangle over the frame, and `smoove agent context` tells the agent what you marked: the frame and its beat, an image of the frame with your rectangle on it, and every node more than 60 percent inside, smallest first, with its name, type, text, box and the file and line that created it. Reading the mark clears it from the stage.

  In development, the Vite plugin tags each node created in a project file with where it was created, so even an unnamed node leads straight to its line. Production builds are untouched.

- [#46](https://github.com/smoove-dev/smoove/pull/46) [`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f) Thanks [@shemi](https://github.com/shemi)! - A studio project is now just its compositions. The studio app ships inside `@smoove/studio` and runs from there, so `npm create smoove studio` writes a `compositions/` folder, an empty `smoove.config.ts`, and a `package.json` with every smoove package installed, and studio updates arrive with the package.

  Each composition is a folder under `compositions/` with an `index.ts` that default-exports its registry entry. The studio finds them itself, so there's no `registry.ts` to edit: add a folder and it shows up in the sidebar. A folder without an `index.ts`, or two folders with the same id, is reported by name in the terminal and in the studio.

  `smoove.config.ts` takes `defineConfig({ name, logo, primaryColor, render })`. `render: false` hides the render buttons and the queue and turns the render routes off.

  `npx smoove studio detach` copies the app into the project's `studio/` folder for good, when you want to change the studio itself. The copy keeps finding compositions and reading `smoove.config.ts` through the new `smooveStudio()` Vite plugin (`@smoove/studio/vite`).

  `smoove()` from `@smoove/vite` takes a `root` option, for when the project root isn't Vite's root. In core, `defineChecks()` and `runChecks()` accept a composition with typed props.

  To move an existing studio project over: move `src/compositions/*` to `compositions/`, delete the app files (`src/`, `vite.config.ts`, `react-router.config.ts`, `vitest.config.ts`), add `smoove.config.ts`, and take the scripts, dependencies and `tsconfig.json` from a fresh `npm create smoove studio`. Projects that keep their own app keep working as they are.

- Updated dependencies [[`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f), [`a5ef1f7`](https://github.com/smoove-dev/smoove/commit/a5ef1f7687310f6047cd5c8a14073c0315a69bfc), [`6aa4d05`](https://github.com/smoove-dev/smoove/commit/6aa4d053bf7ecd8f167e709259800e42b1fdbe5c), [`c5bb99c`](https://github.com/smoove-dev/smoove/commit/c5bb99ce9abc55596d08d657ab4667396d34e15c), [`9d6ce76`](https://github.com/smoove-dev/smoove/commit/9d6ce7651ebb4d8470643f9c9bcec4773b2a14ab), [`d2ea504`](https://github.com/smoove-dev/smoove/commit/d2ea504c7e9680da968b531b6f4b54e2ca43bf8c), [`c7325ad`](https://github.com/smoove-dev/smoove/commit/c7325ad40c0241a5e82be49508aa5f83073074f2)]:
  - @smoove/agent@0.5.0

## 0.4.2

## 0.4.1

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
