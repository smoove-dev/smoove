# Layout — Flex and Block

`Flex` and `Block` (both extend `Konva.Group`) give CSS-flexbox-like auto
layout, built on [flexily](https://www.npmjs.com/package/flexily) (sync, no
async init). Any top-level `Flex`/`Block` added to a `Sequence` is
re-laid-out every tick — animated sizes/gaps/content reflow automatically,
no manual wiring.

## Flex — layout only, no paint

```ts
import { Flex } from "@smoove/core";

const row = new Flex({
  x: 0, y: 0, width: 1280, height: 720,   // root needs an explicit frame
  flexDirection: "row",                    // "row" | "column" | "row-reverse" | "column-reverse"
  justifyContent: "center",                // flex-start | center | flex-end | space-between | space-around | space-evenly
  alignItems: "center",                    // flex-start | center | flex-end | stretch
  gap: 40,
  padding: 16,                             // number | [v,h] | [t,r,b,l] | {top,right,bottom,left}
});
row.add(childA, childB);
```

## Block — Flex + paint (background/border/shadow/radius)

```ts
import { Block } from "@smoove/core";

const card = new Block({
  width: "100%",            // px number or "NN%" string — every size prop accepts both
  flexDirection: "column",
  padding: 18,
  gap: 14,
  background: "#161b22",    // or a gradient (below)
  borderSize: 1,
  borderColor: "#374151",
  cornerRadius: 14,
  shadow: { color: "#000", blur: 24, offsetY: 8, opacity: 0.45 },
});
```

Gradient background:

```ts
background: {
  gradient: {
    type: "linear",          // or "radial"
    stops: [[0, "#1f2937"], [1, "#111827"]], // [offset 0..1, color][]
    angle: 135,
  },
},
```

`borderColor`/`borderSize` accept a single value or per-edge
`[top, right, bottom, left]` / `{top, right, bottom, left}`, same shape as
`padding`/`margin`.

## Child props (on Flex/Block children, and on shape/Image/Text wrappers)

`flexGrow`, `flexShrink`, `flexBasis`, `alignSelf` (`auto | flex-start |
center | flex-end | stretch`), `margin` — all only meaningful on a
`@smoove/core` wrapper (`Block`, `Flex`, `Image`, `Text`, shape wrappers like
`Rect`/`Circle`/`Star`), so import from core rather than `Konva.*` for
anything that needs to sit inside a `Flex`/`Block`.

## Animating layout — let it reflow, don't hand-position structure

Mutate flex *props* (`gap`, `padding`, `flexGrow`, size) in
`sequence.register()` and let the engine recompute positions, rather than
re-deriving every child's `x`/`y` by hand — hand-positioned structure drifts
out of sync the moment content or sizes change, while layout that reflows
stays correct for free:

```ts
// ✅ do: animate the container, children follow
main.register((frame) => {
  growKid.setAttr("flexGrow", 1 + Math.sin(frame / 20));   // layout recomputes from this
  card.width(220 + frame);                                  // root Flex/Block's own size
  row.setAttr("gap", 4 + 24 * Math.sin(frame / 30));
});

// 🚫 avoid: re-deriving each child's x by hand
children.forEach((c, i) => c.x(i * (120 + gap)));
```

Save manual `x`/`y` math for one-off motion on a node that isn't part of the
layout's structure (see the root-vs-child gotcha below) — not for
positioning things a `Flex`/`Block` could lay out for you.

**Gotcha — don't animate `x()`/`y()`/`width()`/`height()` directly on a
*child* of a Flex/Block.** Each tick, `Sequence._apply` runs your updaters
*first*, then walks every top-level `Flex`/`Block` and recomputes layout —
which re-`_kmPlace`s every child from its flex props, overwriting any
`x()`/`y()` you set on a *child* node in the same frame. This does work on
the **root** `Flex`/`Block` itself (the one you `sequence.add()`'d directly)
since nothing places it but you — see `rules/assets/flex-card.composition.ts`
for a card whose root `Flex` slides via `card.x()`/`card.width()`.
`opacity()`, `scale()`, `rotation()` are untouched by layout and are always
safe to animate on any node, child or root.

## Sizing

`width`/`height` accept `number` (px) or `` `${number}%` `` (percent of the
parent's content box). Omit `width`/`height` on a leaf (shape/Image) to let
it report its intrinsic size (`getSelfRect()`-based) instead of being
flex-grown — give it an explicit size if you want it to shrink/grow.

See `rules/assets/flex-card.composition.ts` for a complete worked example
(gradient `Block` card, `Image` cover, `Text` heading/body, animated root
width).
