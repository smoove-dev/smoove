# @smoove/cli

## 0.5.3

### Patch Changes

- [#54](https://github.com/smoove-dev/smoove/pull/54) [`54a320b`](https://github.com/smoove-dev/smoove/commit/54a320b2552e1eaa00b622647c70c895d926dec7) Thanks [@shemi](https://github.com/shemi)! - Media tools for coding agents: bring footage into a project whole, map its audio and picture, see it as contact sheets, transcribe it (locally or through an API), and plan a recut that plays ranges of the original file, with `smoove new --template recut` and `cut_plan`. Asset tools search Openverse, add images and sounds with their credits, and take screenshots of pages.

  The agent package gains the media tools' result types and paths, and `captureScreenshot` in its server entry.

- [#54](https://github.com/smoove-dev/smoove/pull/54) [`54a320b`](https://github.com/smoove-dev/smoove/commit/54a320b2552e1eaa00b622647c70c895d926dec7) Thanks [@shemi](https://github.com/shemi)! - Photos keep their shape. `npx smoove agent check` has a new `layout/stretched` finding for a picture or video drawn at a different shape from its source, by `objectFit: "fill"` in a box of another shape or by scaling one axis more than the other. It's an error once it holds. Scale on a scene's own layer, like a `flip` transition, doesn't count.

  `media_info` now reads still images too, and reports a photo's size and shape as it draws, with a phone's rotation tag applied. Videos report their shape as well, and `asset_add` names it when it adds a picture.

- Updated dependencies [[`54a320b`](https://github.com/smoove-dev/smoove/commit/54a320b2552e1eaa00b622647c70c895d926dec7), [`54a320b`](https://github.com/smoove-dev/smoove/commit/54a320b2552e1eaa00b622647c70c895d926dec7)]:
  - @smoove/agent@0.5.3
  - @smoove/media@0.5.3
  - @smoove/studio@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @smoove/agent@0.5.2
  - @smoove/studio@0.5.2

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
  - @smoove/agent@0.5.1
  - @smoove/studio@0.5.1

## 0.5.0

### Minor Changes

- [#46](https://github.com/smoove-dev/smoove/pull/46) [`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f) Thanks [@shemi](https://github.com/shemi)! - The `smoove` command moves to its own package, `@smoove/cli`, and gets commands for people as well as agents: `smoove start` runs the studio (`--prod` serves the build), `smoove build` builds it, `smoove new` creates a composition folder with a title card (it asks for the title, id, group, description, format and length, or takes them as flags), `smoove test` runs the compositions' tests, and `smoove render` renders.

  The agent commands move under `smoove agent`: `smoove agent start` (the background start), `stop`, `status`, `seek`, `snap`, `sheet`, `timeline`, `context`, `check`, `render_status` and `mcp`. The old spellings, like `smoove snap`, now point at the new ones. The MCP tool names don't change, and `new` joins them.

  `@smoove/agent` keeps the bridge between the studio and the command, and no longer ships a `smoove` binary. Existing projects add `@smoove/cli` as a dev dependency and change `npx smoove snap` to `npx smoove agent snap`, and `.mcp.json` to `["smoove", "agent", "mcp"]`.

### Patch Changes

- [#44](https://github.com/smoove-dev/smoove/pull/44) [`6aa4d05`](https://github.com/smoove-dev/smoove/commit/6aa4d053bf7ecd8f167e709259800e42b1fdbe5c) Thanks [@shemi](https://github.com/shemi)! - `smoove agent check`: one command that sweeps a composition for what you'd otherwise catch by watching, and names the node, frames, beat and source line of each finding. It lints the project for code that breaks scrubbing, then, in the studio's headless tab, compares jumped-to frames with playback, finds layout children moved by x or y, text cut by an ellipsis or running off the canvas, low contrast against what's really behind the text, colors and fonts outside the declared palette, frozen stretches, and the intents in a composition's checks file. `@smoove/core/testing` gains `runChecks`, `defineChecks` and the intents `appearsBy`, `before`, `staysInFrame` and `keepsMoving`, so a test can hold a composition to the same checks. `@smoove/core` exports `parseColor`, `contrastRatio` and `relativeLuminance`. A studio registry entry takes an optional `checks` import.

- [#41](https://github.com/smoove-dev/smoove/pull/41) [`c5bb99c`](https://github.com/smoove-dev/smoove/commit/c5bb99ce9abc55596d08d657ab4667396d34e15c) Thanks [@shemi](https://github.com/shemi)! - The `smoove` command. Run it from a studio project: `smoove agent start` runs the dev server in the background and prints the URL to give the user, `smoove agent snap` and `smoove agent sheet` write a frame or a contact sheet (one tile per beat) as a PNG, `smoove agent timeline` lists the beats and sequences in frames, `smoove agent seek` moves the user's playhead, and `smoove render` renders through the studio's queue. Every command takes `--json`. A request about a composition nobody has open goes to a headless Chrome the dev server starts on its own, so looking never changes what the user sees.

  In core, `plan()` names each marker after its key (`marker.name`), and a composition takes its plan with `new Composition({ plan })` or `comp.setPlan()`, so tools can find each beat. In the preview, a video that's still loading now holds `renderFrame()` until it can draw the requested frame.

- [#45](https://github.com/smoove-dev/smoove/pull/45) [`9d6ce76`](https://github.com/smoove-dev/smoove/commit/9d6ce7651ebb4d8470643f9c9bcec4773b2a14ab) Thanks [@shemi](https://github.com/shemi)! - `smoove agent mcp`: the `smoove` commands as MCP tools, over standard input and output, for agents that prefer tools over a shell. Each tool carries its command's name and options and returns the command's own output; `snap` and `sheet` hand back the image itself. The command line and the server now run every command from one shared definition, so they can't drift apart. The studio template registers the server in `.mcp.json` and pre-approves the read-only tools; `seek` and `render` still ask.

- [#43](https://github.com/smoove-dev/smoove/pull/43) [`d2ea504`](https://github.com/smoove-dev/smoove/commit/d2ea504c7e9680da968b531b6f4b54e2ca43bf8c) Thanks [@shemi](https://github.com/shemi)! - Point at things in the studio. Drag a rectangle over the frame, and `smoove agent context` tells the agent what you marked: the frame and its beat, an image of the frame with your rectangle on it, and every node more than 60 percent inside, smallest first, with its name, type, text, box and the file and line that created it. Reading the mark clears it from the stage.

  In development, the Vite plugin tags each node created in a project file with where it was created, so even an unnamed node leads straight to its line. Production builds are untouched.

- Updated dependencies [[`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f), [`a5ef1f7`](https://github.com/smoove-dev/smoove/commit/a5ef1f7687310f6047cd5c8a14073c0315a69bfc), [`6aa4d05`](https://github.com/smoove-dev/smoove/commit/6aa4d053bf7ecd8f167e709259800e42b1fdbe5c), [`c5bb99c`](https://github.com/smoove-dev/smoove/commit/c5bb99ce9abc55596d08d657ab4667396d34e15c), [`9d6ce76`](https://github.com/smoove-dev/smoove/commit/9d6ce7651ebb4d8470643f9c9bcec4773b2a14ab), [`d2ea504`](https://github.com/smoove-dev/smoove/commit/d2ea504c7e9680da968b531b6f4b54e2ca43bf8c), [`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f), [`c7325ad`](https://github.com/smoove-dev/smoove/commit/c7325ad40c0241a5e82be49508aa5f83073074f2)]:
  - @smoove/agent@0.5.0
  - @smoove/studio@0.5.0
