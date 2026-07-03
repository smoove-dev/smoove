# @smoove/player

A framework-agnostic web component that plays a
[smoove](https://smoove.dev) `Composition` like an HTML5 `<video>`.

`<smoove-player>` letterbox-scales the stage to its box and adds fullscreen,
click and keyboard control, an imperative API, and a set of DOM events. Use
it from plain HTML, React, Vue, Svelte, or anything that can put an element
on a page.

## Install

```sh
pnpm add konva @smoove/core @smoove/player
```

`konva` and `@smoove/core` are peer dependencies (`lit` and `@lit/context`
are bundled). Import the package once to register the elements, then opt
into the default styling:

```ts
import "@smoove/player"; // registers <smoove-player> and the controls
import "@smoove/player/styles.css"; // opt-in default styling
```

## Usage

Hand the player a composition in one of two ways.

**Assign it imperatively.** Set the `composition` property to a live
`Composition`. The player owns the canvas and mounts the stage itself:

```html
<smoove-player controls loop style="width: 640px; aspect-ratio: 16/9"></smoove-player>
```

```ts
document.querySelector("smoove-player").composition = comp;
```

**Point `src` at a module.** Like `<video src>`, the player `import()`s
the URL and resolves its default export (a `Composition`, or a sync/async
factory returning one):

```html
<smoove-player src="https://cdn.example/orbit.js" controls loop></smoove-player>
```

## No bundler? Use the CDN build

A self-contained build bundles Konva and the core authoring API, registers
every element, and exposes `window.Smoove`:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@smoove/player/dist/player.global.js"></script>
```

The same file is published on unpkg and through the
`@smoove/player/standalone` export.

## Docs

Full documentation lives at [smoove.dev](https://smoove.dev).

## License

MIT
