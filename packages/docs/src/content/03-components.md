---
title: Components & Typography
group: Components
order: 3
eyebrow: Components
description: The konva-motion documentation template — every content component, themeable in light and dark.
icon: type
---

This page is the living style reference for konva-motion docs. Every content element below is a building block — write it in plain Markdown and it inherits this rhythm, spacing, and color automatically, in both light and dark themes.

:::note A template, not a page
The header, sidebar, table of contents, and footer stay identical across every doc. Only the article in the middle changes — so authoring a new page means writing a Markdown file, **no HTML required**.
:::

## Headings

Headings establish the document outline and feed the "On this page" index on the right.
`h2` sections open with a hairline rule; deeper levels nest without one. Hover any
heading to reveal its anchor link.

### Third-level heading

Use `h3` for sub-topics inside a section. They appear indented in the table of contents.

#### Fourth-level heading

Reserve `h4` for fine-grained labels — option groups, edge cases, footnoted details.

## Text & inline elements

Body copy runs at a comfortable measure of about 68 characters. You can mix **bold
emphasis**, *italics*, and [inline links](/docs/introduction) freely. Reference an API
with inline code like `tl.to()` or a value such as `easeInOut`. Keyboard shortcuts
render as keys: press [[Space]] to play and [[⌘]][[K]] to search.

Status is communicated with badges: {{accent:stable}} {{good:v1.0}} {{warn:beta}} {{deprecated}}.

## Lists

Unordered lists use a compact accent marker:

- Declarative, timeline-driven animation for Konva — no framework required.
- Composable timelines with nested sequences
  - Stagger children with a single delay value.
  - Reverse, loop, or yoyo any segment.
- Works with any Konva node — shapes, text, groups, and images.

Ordered lists number each step in a monospaced chip:

1. Build your scene with Konva — a `Stage`, `Layer`, and shapes.
2. Create a `Timeline` to orchestrate the motion.
3. Tween any node with `tl.to(node, { … })`.

Task lists track progress:

- [x] Install the package
- [ ] Add a `Konva.Stage`
- [ ] Export an MP4

## Code blocks

Fenced code renders with a language label, window dots, and a one-click copy button.
Syntax is highlighted on the server and re-colored for whichever theme is active.

```js
import Konva from "konva";
import { Timeline, easeOut } from "konva-motion";

const tl = new Timeline({ loop: true });
tl.to(title, { y: 0, opacity: 1, duration: 0.9, easing: easeOut });
tl.play();
```

Shell commands work the same way:

```bash
npm install konva konva-motion
```

## Callouts

Four admonition styles draw the eye without shouting. Each pairs a tinted surface with an icon.

:::tip Tip
Chain tweens with `.to()` — each one starts after the last finishes, so you describe a sequence in the order it plays.
:::

:::danger Breaking in v1
The standalone `tween()` helper was removed. Use `timeline.to()` instead — it returns the timeline so calls stay chainable.
:::

## Blockquotes

> Animation is not the art of drawings that move, but the art of movements that are drawn.
>
> — Norman McLaren

## Tables & API reference

Tabular data scrolls horizontally on small screens without breaking the layout.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `duration` | `number` | `0.5` | Length of the tween, in seconds. |
| `delay` | `number` | `0` | Wait before the tween starts, in seconds. |
| `easing` | `function` | `linear` | Easing curve applied across the tween. |
| `loop` | `boolean` | `false` | Replay the timeline once it finishes. |

For longer entries, a property list reads better than a table:

:::prop timeline.to | (node, config) → Timeline
Tweens a Konva node's attributes to target values over a `duration`. Returns the timeline, so calls chain.
:::

:::prop timeline.from | (node, config) → Timeline | v1.0
Animates a node *from* the given attributes to its current ones — ideal for entrances.
:::

:::prop stagger | (amount) → number
Offsets each node's start time so a group of tweens cascades instead of firing at once.
:::

## Step-by-step

For guided walkthroughs, numbered steps connect along a single rail:

:::steps
1. **Create a Stage & Layer**

   Set up a Konva `Stage` bound to a container element, add a `Layer`, and place your shapes on it.

2. **Build a Timeline**

   Create a `Timeline` — it sequences your tweens and repaints the layer for you on every frame.

3. **Tween a node**

   Call `tl.to(node, { …attrs, duration })` to animate any Konva attribute, then `tl.play()`.
:::

## Live demo

Pages can embed a running example with the `<km-player>` web component from
`@konva-motion/player`. The element is registered in the browser, so it hydrates after
load and plays a composition like an HTML5 `<video>`:

```html
<km-player src="/demos/pulse.js" controls autoplay loop></km-player>
```

Until a composition is wired in, the themed canvas frame below holds its place — sized
16:9 and ready to mount a real preview.

:::demo 1280 × 720 canvas
:::

---

Every element on this page is driven by `prose.css`. Restyle it once and every doc updates together.
