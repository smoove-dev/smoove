---
"@smoove/studio": minor
"create-smoove": minor
"@smoove/vite": patch
"@smoove/core": patch
---

A studio project is now just its compositions. The studio app ships inside `@smoove/studio` and runs from there, so `npm create smoove studio` writes a `compositions/` folder, an empty `smoove.config.ts`, and a `package.json` with every smoove package installed, and studio updates arrive with the package.

Each composition is a folder under `compositions/` with an `index.ts` that default-exports its registry entry. The studio finds them itself, so there's no `registry.ts` to edit: add a folder and it shows up in the sidebar. A folder without an `index.ts`, or two folders with the same id, is reported by name in the terminal and in the studio.

`smoove.config.ts` takes `defineConfig({ name, logo, primaryColor, render })`. `render: false` hides the render buttons and the queue and turns the render routes off.

`npx smoove studio detach` copies the app into the project's `studio/` folder for good, when you want to change the studio itself. The copy keeps finding compositions and reading `smoove.config.ts` through the new `smooveStudio()` Vite plugin (`@smoove/studio/vite`).

`smoove()` from `@smoove/vite` takes a `root` option, for when the project root isn't Vite's root. In core, `defineChecks()` and `runChecks()` accept a composition with typed props.

To move an existing studio project over: move `src/compositions/*` to `compositions/`, delete the app files (`src/`, `vite.config.ts`, `react-router.config.ts`, `vitest.config.ts`), add `smoove.config.ts`, and take the scripts, dependencies and `tsconfig.json` from a fresh `npm create smoove studio`. Projects that keep their own app keep working as they are.
