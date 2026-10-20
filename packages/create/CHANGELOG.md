# create-smoove

## 0.5.0

### Minor Changes

- [#46](https://github.com/smoove-dev/smoove/pull/46) [`bf5e04f`](https://github.com/smoove-dev/smoove/commit/bf5e04ffb1c27b9176cebd7557f5eb807aeffe2f) Thanks [@shemi](https://github.com/shemi)! - A studio project is now just its compositions. The studio app ships inside `@smoove/studio` and runs from there, so `npm create smoove studio` writes a `compositions/` folder, an empty `smoove.config.ts`, and a `package.json` with every smoove package installed, and studio updates arrive with the package.

  Each composition is a folder under `compositions/` with an `index.ts` that default-exports its registry entry. The studio finds them itself, so there's no `registry.ts` to edit: add a folder and it shows up in the sidebar. A folder without an `index.ts`, or two folders with the same id, is reported by name in the terminal and in the studio.

  `smoove.config.ts` takes `defineConfig({ name, logo, primaryColor, render })`. `render: false` hides the render buttons and the queue and turns the render routes off.

  `npx smoove studio detach` copies the app into the project's `studio/` folder for good, when you want to change the studio itself. The copy keeps finding compositions and reading `smoove.config.ts` through the new `smooveStudio()` Vite plugin (`@smoove/studio/vite`).

  `smoove()` from `@smoove/vite` takes a `root` option, for when the project root isn't Vite's root. In core, `defineChecks()` and `runChecks()` accept a composition with typed props.

  To move an existing studio project over: move `src/compositions/*` to `compositions/`, delete the app files (`src/`, `vite.config.ts`, `react-router.config.ts`, `vitest.config.ts`), add `smoove.config.ts`, and take the scripts, dependencies and `tsconfig.json` from a fresh `npm create smoove studio`. Projects that keep their own app keep working as they are.

### Patch Changes

- [#42](https://github.com/smoove-dev/smoove/pull/42) [`c7325ad`](https://github.com/smoove-dev/smoove/commit/c7325ad40c0241a5e82be49508aa5f83073074f2) Thanks [@shemi](https://github.com/shemi)! - The studio fits a narrow window, such as a third of a laptop screen beside a coding agent's terminal. It picks a layout from its own width: below 640 pixels the library and the inspector open as drawers over the stage from header buttons, and from 640 to 1099 pixels the library can be collapsed and the inspector is a drawer. The timeline header wraps instead of spilling, the ruler spaces its labels to fit, the layered timeline takes a share of the height you can drag, and its tracks take their names from the composition's plan. Wide screens look as before.

  The agent bridge resends a request when the studio tab reloads while answering it (Vite reloads the page as it optimizes dependencies on a project's first run), instead of failing.

  `npm create smoove` installs the smoove-video skill for the studio template without asking, and works without a terminal. The studio template ships the `smoove` command, an AGENTS.md built around it, a CLAUDE.md pointer, pre-approved read-only `smoove` commands for Claude Code, and a sample composition that registers its plan.

## 0.4.2

## 0.4.1

### Patch Changes

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
