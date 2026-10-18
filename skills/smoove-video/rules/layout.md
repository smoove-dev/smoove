# Layout — Flex and Block

`Flex` and `Block` (both extend `Konva.Group`) give CSS-flexbox-like auto
layout, built on [flexily](https://www.npmjs.com/package/flexily) (sync, no
async init). Every `Flex`/`Block` in a `Sequence` or `Clip`, at any depth
(inside a plain `Group` too), is re-laid-out every tick — animated
sizes/gaps/content reflow automatically, no manual wiring.

## When to use Flex

Flex earns its keep when you don't know the content up front. Use
`Flex`/`Block` when:

- text or data comes from `props`,
- a template renders many times with different names, dates or prices,
- a list's length varies.

The layout holds whatever goes in, so nobody re-does the math per render.

Use fixed positions when the copy is static and known up front: a one-off
video, a reel, an explainer with fixed lines. You already know every string,
so `x`/`y` are simpler, exact, and have fewer moving parts (and none of the
limitations below).

```ts
// static copy: place it
const title = new Text({ text: "SMALL GROUPS WIN", x: 90, y: 420, width: 900, fontSize: 120, ellipsis: false });
seq.add(title);
```

Mixing is fine. A fixed-position scene can hold one `Flex`/`Block` for the
part that is dynamic, say a lower third whose name comes from props. Position
its root with `x`/`y` like any other node.

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

Once you've chosen a layout (see "When to use Flex" above), mutate flex
*props* (`gap`, `padding`, `flexGrow`, size) in
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
tick, the sequence (or clip) runs your updaters *first*, then recomputes
every layout root below it, which re-places every child and
overwrites any `x()`/`y()` you set on a *child* in the same frame. `x()`/`y()`
**do** work on a **root** `Flex`/`Block` (one whose parent isn't a
`Flex`/`Block`: added to the sequence, a clip or a plain `Group`), since
nothing places it but you: see
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

Stage space includes every parent transform (a scaled `Group`, a moved
`Clip`). To place a node next to a laid-out one, convert into the space of
the parent you are adding to:

```ts
// a badge beside a laid-out label, both under `panel` (which is scaled)
const r = label.getClientRect({ relativeTo: panel }); // panel-local box
badge.x(r.x + r.width + 16);
badge.y(r.y + r.height / 2);

// or from a measure() box: map its corner back into panel space
// (a size converts by dividing by panel.getAbsoluteScale())
const m = measure(label);
const p = panel.getAbsoluteTransform().copy().invert().point({ x: m.x + m.width, y: m.y });
badge.x(p.x + 16);
badge.y(p.y);
```

## Current limitations

As of 0.4. These are bugs, not design: each one has a workaround until it is
fixed.

**On `@smoove/core` 0.4.0 and earlier, a layout behind a plain `Group`
isn't reflowed during playback.** Later versions reflow it. On those
versions only a `Flex`/`Block` added straight to a `Sequence` or `Clip` is
laid out each tick, and one inside a `Group` paints stale positions on a
seek. Add the layout straight to the `Sequence`/`Clip` (a `Clip` is a
`Group`, so put the transform on the clip), or call `measure(row)` at the end
of the owning updater.

**A width-less nested container doesn't hug `Text`.** Text straight in a
`Flex` sizes itself. One level deeper, a `Flex`/`Block` with no `width`
measures 0 wide as a column (siblings land on top of the text) and squeezes
the text as a row (glyphs clip). Give nested containers an explicit `width`.

**Auto-width `Text` can keep its fallback-font width in the browser.** The
comp is built before webfonts load, the label measures against the fallback
face, and the measurement isn't refreshed when the real face lands. A wider
real face then clips ("MASSIV") or truncates with an ellipsis. Node doesn't
show it, because fonts are ready there first. Give one-line labels an
explicit `width` and `ellipsis: false` (see [text.md](text.md)).
