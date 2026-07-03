# @smoove/studio

A composable React studio UI for [smoove](https://smoove.dev)
compositions — catalog sidebar, stage, timeline, props panel, and render
dialogs, assembled from a `<Studio>` compound component.

Declare your composition catalog with `defineRegistry()`, wrap `<Studio>`
around it, and compose the panels you want. The demo app in the smoove repo
is exactly this: a registry plus routing around `@smoove/studio`.

## Install

```sh
pnpm add konva react react-dom @smoove/core @smoove/player @smoove/studio
```

`konva`, `react`, `react-dom`, `@smoove/core`, and `@smoove/player` are
peer dependencies. `@smoove/renderer` is an optional peer — add it to
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

## Docs

Full documentation lives at [smoove.dev](https://smoove.dev).

## License

MIT
