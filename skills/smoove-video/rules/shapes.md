# Shapes

`@smoove/core` re-exports every Konva drawing primitive as a flex-aware
wrapper with the **same name and config** as Konva's: `Rect`, `Circle`,
`Ellipse`, `Line`, `Arrow`, `Star`, `Ring`, `Arc`, `Wedge`, `RegularPolygon`,
`Path`, `TextPath`, `Sprite`. Each adds `flexGrow`/`flexShrink`/`flexBasis`/
`alignSelf`/`margin` plus px/`%` `width`/`height`, so it can sit inside a
`Flex`/`Block` and be positioned automatically.

```ts
import { Circle, Flex, RegularPolygon, Star } from "@smoove/core";

const row = new Flex({ x: 0, y: 0, width, height, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 40 });
row.add(
  new Circle({ radius: 75, fill: "#f472b6" }),
  new Star({ numPoints: 5, innerRadius: 45, outerRadius: 90, fill: "#facc15" }),
  new RegularPolygon({ sides: 6, radius: 80, fill: "#a78bfa" }),
);
```

## Prefer the core wrapper, always

Import shapes from `@smoove/core` (`Rect`, `Circle`, …), not `Konva.*` —
that's the project convention regardless of whether the shape ends up inside
a `Flex`/`Block` or is added directly to a `Sequence` with explicit `x`/`y`.
Outside a `Flex`/`Block` the wrapper costs nothing (`_kmMeasure`/`_kmPlace`
are simply never called, so it behaves exactly like the plain Konva shape),
and mutating it in `register()` is identical either way — same Konva setter
methods (`.fill()`, `.radius()`, `.rotation()`, `.scale()`, …).

Inside a `Flex`/`Block`, a raw `Konva.Rect` with a fixed pixel size is still
measured and placed (a generic size/position fallback), but it can't express
`%` sizes, `flexGrow`/`flexShrink`/`flexBasis`, or `alignSelf` — so it can't
grow to fill a row, take a percentage width, or align itself. Give the
container a `flexGrow` child and a fixed-size raw box side by side and grow
the container: the wrapper fills the new space, the raw box leaves a gap.

```ts
// ✅ do: layout-aware
import { Rect } from "@smoove/core";
row.add(new Rect({ width: 120, height: 120, fill: "#4ea1ff", flexGrow: 1 }));

// 🚫 avoid (unless intentional): renders, but never reflows in a Flex
import Konva from "konva";
row.add(new Konva.Rect({ width: 120, height: 120, fill: "#4ea1ff" }));
```

Reach for raw `Konva.*` only for what core doesn't wrap — e.g. a plain
`Konva.Group` with a custom `clipFunc` for a reveal-mask effect (core has no
unopinionated group wrapper; `Flex`/`Block` are layout-opinionated).

## Sizing and origin

Radius/points-based shapes (`Circle`, `Star`, `Ring`, `RegularPolygon`, …)
report their **intrinsic** size inside a flex layout and aren't stretched by
`flexGrow` — give them an explicit size (e.g. `radius`) for predictable
results; they won't grow to fill a flex row the way a sized `Block` would.
Positioning is origin-corrected: a centered-origin shape like `Circle` lands
its *bounding box* at the flex slot, not its center, so it lines up flush
with a top-left-origin `Rect` of the same box size in the same row — you
don't need to hand-correct for Konva's differing origin conventions.

## Relative positioning: getters over hardcoded numbers

When one node should track another, read the other node's own getters
instead of a guessed number — `next.x(prev.x() + gap)` keeps a fixed gap no
matter how `prev` moves. When two nodes need to match, read the computed box
with `getClientRect()` instead of copying a size by hand: it reports the
node's actual rendered bounds, so it stays correct as the source node
animates. This is the same "let it reflow" principle as `Flex`/`Block`
layout, applied to plain nodes outside a container.

```ts
// name follows the avatar with a fixed gap, whatever the avatar's radius
name.x(avatar.x() + avatar.radius() * 2 + 12);
name.y(avatar.y());

// underline matches the title's rendered width, even as the title animates
underline.width(title.getClientRect().width);
```

## Animating

Centralize all motion in the owning sequence's `register()` — don't attach
per-shape tickers. Safe to animate directly regardless of flex parentage:
`.rotation()`, `.scale()`, `.opacity()`, shape-specific attrs like
`.radius()`/`.innerRadius()`/`.outerRadius()`/`.sides()`. Position
(`x`/`y`/`width`/`height`) on a flex *child* is the one thing to avoid
animating directly — see the gotcha in [layout.md](layout.md) and
[animation.md](animation.md).
