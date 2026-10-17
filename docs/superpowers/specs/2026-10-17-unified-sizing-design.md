# One sizing API: `width()` / `height()` everywhere

## Why

Today a `Flex`/`Block` (and every leaf inside one) keeps two sizes: the size
you asked for, hidden in the `flexWidth`/`flexHeight` attrs, and the size it
came out, in Konva's `width()`/`height()`. The layout pass rewrites the second
from the first every tick, so `card.width(600)` in an updater is silently
thrown away and the docs have to teach `setAttr("flexWidth", 600)`.

Users should not need to know which kind of node they hold before resizing it.
In CSS you animate `width`; in smoove you call `width()`.

## The API

**Setter: "this is the size I want."** On every smoove node, Flex child or not:

```ts
node.width(600);      // pixels
node.width("50%");    // percent of the parent's content box
node.width("auto");   // hand the size back to layout (hug / intrinsic)
```

It accepts exactly what the `width`/`height` config accepts. The change takes
effect on the same frame: siblings and children reflow around it.

**Getter: "what size did it come out?"** Always pixels, the laid-out box:

```ts
node.width("50%");
node.width();         // → 640 (half of a 1280 parent), not "50%"
```

`"auto"` reads back as whatever the node hugged to. Scale and rotation are not
included; that is still `measure()`.

**Reads are always fresh.** Reading a size right after changing anything that
affects layout runs layout first, the way reading `offsetWidth` forces a
browser reflow. `card.width("50%"); card.width()` never returns last frame's
number.

**Animating a percentage** is written from the frame, as every smoove updater
is: `card.width(\`${50 + frame}%\`)`. `node.width(node.width() + 1)` also works
and pins the size to pixels from then on.

**Position does not change.** A Flex child is placed by its parent; its
`x()`/`y()` are overwritten every tick, as CSS overrides `left`/`top` on a
static flex item. To place something by hand, move it out of the Flex (to the
`Sequence` or a plain `Group`). There is no `position: "absolute"`. A root
`Flex`/`Block` is positioned with `x()`/`y()` as today.

## Breaking changes

- `flexWidth` / `flexHeight` stop being a public API. Setting either is
  ignored, with a one-time dev warning that names `width()`/`height()`.
- `width()`/`height()` on a smoove node now drive layout instead of being
  overwritten by it.
- `pre-1.0`: ships as a `minor` changeset for `@smoove/core` (and patch
  changesets for `media`, `lottie`, `code` if their internals change).

## How it works (builder notes)

- **Declared vs computed.** Each smoove layout node stores its declared size
  (`SizeValue | undefined`, `"auto"` normalises to `undefined`) under an
  internal attr key (e.g. `__kmWidth`), not a class field, so `clone()` and
  `toObject()` carry it. The computed pixel box stays in Konva's own
  `width`/`height`, which Konva draws, caches and hit-tests from. Konva is
  untouched.
- **Intercept at `setWidth`/`setHeight`, not just `width()`.** Konva's
  `width(v)` and `setAttrs({ width })` (including the constructor config) both
  route through `setWidth`, so overriding the pair catches every user path and
  lets the per-wrapper `pickKonvaConfig`/`pickLeafConfig` stop translating
  `width`/`height`. A px value is also written to `attrs.width` immediately.
- **Layout writes bypass the override.** `_kmPlace`, `leafPlace` and
  `layoutRoot` write the computed box through the *base Konva* setter
  (`super.setWidth`), never the smoove override, so the layout pass can't
  clobber the declared size. It must be the base setter rather than a raw
  `_setAttr`: for `Circle`, `Star`, `Ring` and other radius/points shapes,
  Konva's setter maps width onto geometry.
- **Flush on read.** `getWidth`/`getHeight` on a smoove node first make sure
  its layout root is current, then return the base Konva getter (again, a
  `Circle`'s width is its diameter, not an attr). A detached node, or one with
  no layout root, just returns the base getter. Use a global
  "layout epoch" counter (same pattern as `structureVersion`) bumped by size
  setters, layout-affecting attr changes (`gap`, `padding`, `flexGrow`, …) and
  structural changes; each root records the epoch it last laid out at. Guard
  against re-entrancy: layout itself must read `attrs.width`, never the getter.
  The per-tick layout pass in `Sequence` stays as it is.
- **All nodes.** `Flex`, `Block`, `Text`, `Image`, `Video` (media), `Lottie`,
  `Code`, and every `FlexShape` leaf. Internal checks of the form
  `attrs.flexWidth === undefined` (text.ts, code.ts, lottie.ts, image.ts) become
  "has no declared width".
- **Root `Flex` writes its size back.** `layoutRoot` currently writes a root
  `Flex`'s computed size only when it has an explicit px size (`Block` always
  does). It should always write it, so `flex.width()` on a hugging root returns
  the hugged size instead of `0`.
- **Outside a Flex.** A root `Flex`/`Block`, or a leaf with no Flex parent,
  resolves `"%"` against the composition's size, so `width: "100%"` on a root
  fills the frame. (Today a `%` on a root is ignored.)
- **The `flexWidth` warning.** `setAttr` does not go through `setWidth`, so
  detecting a stray `flexWidth` needs a `flexWidthChange` listener or a check
  in the layout pass; either is fine.
- **Raw Konva nodes** (`Konva.Rect`, `Konva.Text`, `Konva.Image` dropped into a
  Flex) keep today's behaviour: sized from their numeric `width`/`height`, or
  intrinsically. The new API is a smoove-wrapper feature.

## Docs and examples to update

- `packages/docs/content/docs/layout/flex.mdx`: replace the `flexWidth` callout
  with "animate `width()`", and add a short "breaking out of a Flex" section
  (move the node to another parent).
- `skills/smoove-video/rules/layout.md` and
  `rules/assets/flex-card.composition.ts`: same.
- Demos and compositions that call `setAttr("flexWidth"|"flexHeight")`:
  `docs/src/demos/{dynamic-props,flex-layout,wrapper-vs-raw}.ts`,
  `kitchen-sink/.../{snoove-showcase/scenes/03-layout,shapes-playground,text-fit}`.
- `core/conformance/cases/reflow.ts`.

## Tests (conformance + unit)

- Setting `width()` in an updater reflows siblings on the same frame.
- `width("50%")` then `width()` returns pixels without waiting a tick.
- `width("auto")` returns a Block to hugging its content.
- Root `width: "100%"` fills the composition.
- Konva drawing, `cache()` and `Transformer` still see numbers.
- Setting `flexWidth` warns once and has no effect.

## Non-goals

- No `position: "absolute"` or any other way to opt a child out of layout.
- No change to `x()`/`y()` semantics.
- No getter that returns the declared value (`"50%"`). If one is ever needed it
  is a separate, explicitly named method.
- No unit math helpers (`"50%" + 1`); updaters compute from the frame.

## Left to the builder

- The exact epoch/dirty mechanism and where the flush lives.
- Whether `minWidth`/`maxWidth` join now or later (not required).
- Wording of the dev warning.
