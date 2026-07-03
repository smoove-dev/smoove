# @smoove/vite

An optional [Vite](https://vite.dev) plugin for
[smoove](https://smoove.dev) projects. Everything works without it. What
it removes is two pieces of by-hand wiring:

- **Assets that render in both worlds:** rewrites media and font imports so
  the same `src` works in the browser player and in the Node renderer.
- **Invisible studio hot-reload:** writes the `import.meta.hot.accept`
  block a `defineRegistry` studio needs so a composition edit hot-swaps in
  place.

One call turns both on; if your project only does one of them, the other is
a no-op.

## Install

```sh
pnpm add -D @smoove/vite
```

`vite` is a peer dependency.

```ts
// vite.config.ts
import { smoove } from "@smoove/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [smoove()],
});
```

## When you need it

- You import media or fonts as Vite asset URLs **and** render the
  composition headlessly with `@smoove/renderer`.
- You build a studio with `defineRegistry` and want composition edits to
  hot-swap in place.

Skip it when your composition only plays in the browser, or you pass real
filesystem paths in a plain Node script with no Vite build in the loop.

## Docs

Full documentation lives at [smoove.dev](https://smoove.dev).

## License

MIT
