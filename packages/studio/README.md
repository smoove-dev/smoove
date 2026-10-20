# @smoove/studio

A composable React studio UI for [smoove](https://smoove.dev)
compositions: catalog sidebar, stage, timeline, props panel, and render
dialogs, assembled from a `<Studio>` compound component.

Declare your composition catalog with `defineRegistry()`, wrap `<Studio>`
around it, and compose the panels you want. The demo app in the smoove repo
is exactly this: a registry plus routing around `@smoove/studio`.

## Install

```sh
pnpm add konva react react-dom @smoove/core @smoove/player @smoove/studio
```

`konva`, `react`, `react-dom`, `@smoove/core`, and `@smoove/player` are
peer dependencies. `@smoove/renderer` is an optional peer. Add it to
enable the render dialogs and queue.

## Quick example

```tsx
import { defineRegistry, Studio } from "@smoove/studio";
import "@smoove/studio/styles.css";
import orbit from "./compositions/orbit";
import pulse from "./compositions/pulse";

const registry = defineRegistry([pulse, orbit]);

export function App() {
  return (
    <Studio registry={registry} onNavigate={(id) => console.log(id)}>
      <Studio.Sidebar>
        <Studio.Brand />
        <Studio.Library />
      </Studio.Sidebar>
      <Studio.Body>
        <Studio.Stage />
        <Studio.Timeline />
      </Studio.Body>
      <Studio.Toasts />
    </Studio>
  );
}
```

Hooks (`useStudio`, `useComposition`, `usePlayback`, `usePropsForm`, ...)
are exported for building your own panels on the same state.

Pair with [`@smoove/vite`](https://www.npmjs.com/package/@smoove/vite) for
invisible hot-reload of registry compositions.

## The ready-made studio

A project made with `npm create smoove` doesn't build its own studio: this
package ships one, and the `smoove` command from `@smoove/cli` runs it. The
project holds only its `compositions/` folder, a `smoove.config.ts`, and a
`package.json`:

```sh
npx smoove start      # the studio, on port 5174
npx smoove build      # the production build
npx smoove new        # a new composition folder
```

The studio finds every `compositions/<folder>/index.ts` that default-exports
a registry entry, so there's no `defineRegistry()` call to keep in sync.
`smoove.config.ts` sets the studio's name, logo, accent color, and whether
it renders:

```ts
import { defineConfig } from "@smoove/studio";

export default defineConfig({ name: "Acme Videos", primaryColor: "#15cda8" });
```

To change the app itself, `npx smoove studio detach` copies it into the
project's `studio/` folder, with its Vite and React Router configs. The
copy keeps using `smooveStudio()` from `@smoove/studio/vite`, so the
compositions folder and `smoove.config.ts` work the same afterwards.

## Docs

Full documentation lives at [smoove.dev](https://smoove.dev).

## License

MIT
