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
  card.width(220 + frame);                                  // any node's own size
  row.setAttr("gap", 4 + 24 * Math.sin(frame / 30));
});

// 🚫 avoid: re-deriving each child's x by hand
children.forEach((c, i) => c.x(i * (120 + gap)));
```

Save manual `x`/`y` math for one-off motion on a node that isn't part of the
layout's structure (see the root-vs-child gotcha below) — not for
positioning things a `Flex`/`Block` could lay out for you.

**Gotcha: a Flex/Block child's `x()`/`y()` belong to the layout.** Each
tick, `Sequence._apply` runs your updaters *first*, then walks every top-level
`Flex`/`Block` and recomputes layout, which re-places every child and
overwrites any `x()`/`y()` you set on a *child* in the same frame. `x()`/`y()`
**do** work on the **root** `Flex`/`Block` (the one you `sequence.add()`'d
directly), since nothing places it but you: see
`rules/assets/flex-card.composition.ts` for a card whose root `Flex` slides via
`card.x()`. To place a node by hand, take it out of the Flex: add it to the
`Sequence` (or a plain `Group`) instead. `opacity()`, `scale()` and
`rotation()` are untouched by layout and are always safe on any node.

**Size is `width()`/`height()`, on every node.** Setting it is the size you
want, and layout reflows around it on the same frame:

```ts
card.width(600);                 // px
card.width(`${40 + frame}%`);    // percent of the parent's content box
card.width("auto");              // back to hugging its content
card.width();                    // always reads the laid-out size in px
```

Reading right after a set already sees the new layout. Write percentages from
the frame, as above: the getter returns pixels, so `width(width() + 1)` pins the
node to px from then on.

## Sizing

`width`/`height` accept `number` (px), `` `${number}%` `` (percent of the
parent's content box; on a root `Flex`/`Block`, of the composition), or
`"auto"`. Omit `width`/`height` on a leaf (shape/Image) to let
it report its intrinsic size (`getSelfRect()`-based) instead of being
flex-grown — give it an explicit size if you want it to shrink/grow.

See `rules/assets/flex-card.composition.ts` for a complete worked example
(gradient `Block` card, `Image` cover, `Text` heading/body, animated root
width).

## Measuring nodes

`measure(node)` (or `node.measure()` on any smoove wrapper) returns stage-space
bounds `{ x, y, width, height }`, laying the node out on demand — it works even
for sequences that haven't been on screen, so never keep a dead sequence alive
just to read geometry from it. Pass `{ at: localFrame }` to measure at a
specific frame of the node's own sequence (e.g. a previous beat's final frame).
`Text` results add `lines[]` with per-line `ink` rects and `baseline` — anchor
underlines to `baseline` and masks to `ink`, not to the box. Bounds are final
only once fonts are ready (`await comp.whenReady()`).
