# Designing for video

A frame is watched once, at speed, often on a phone, then gone. Sizes and
habits from web pages don't survive that: small type turns to mush after
compression, hairline borders vanish, and a lone centered block looks like a
page that hasn't finished loading. Design for the screen the video plays on.

Read the brief first ([planning.md](planning.md)): where the video plays
decides the aspect ratio, and the aspect ratio decides the sizes below.

## Scale to the canvas

Every size here assumes a canvas whose short side is 1080 pixels. That is
1920 by 1080 landscape, 1080 by 1920 vertical, and 1080 by 1080 square. For
any other canvas, multiply by one factor taken from the short side:

```ts
const width = 1080;
const height = 1920;
const u = Math.min(width, height) / 1080; // 1 at 1080p, landscape or vertical
const headline = new Text({ text: "Ship it", fontSize: Math.round(96 * u), fill: "#f4efe6" });
```

Starting sizes, each times `u`:

- Headlines: 64 to 120 pixels. A web page would use about half that.
- Body copy: 28 to 42 pixels.
- Labels and captions: 18 to 24 pixels.
- Strokes, rules and borders: 2 to 4 pixels.
- Padding from the frame edge and between groups: 60 to 140 pixels.
- Decorative shapes and ghost type: 12 to 25 percent opacity.

Text smaller than 24 times `u` needs a reason, and decoration fainter than
10 percent disappears once the video is compressed. For a clip that will be
watched small in a social feed, start at the top of each range.

## Layers: backdrop, subject, detail

A frame that feels finished usually has three layers:

- A backdrop: a soft radial glow, huge faded type bleeding off the edge, a
  grid, grain, or a block of color. It gives the frame a sense of place in the
  first few frames, before the subject has landed.
- The subject: the headline, the number, the screenshot, the thing the beat
  is about.
- Detail: small labels, rules, a corner tag, a monospace caption, tick marks.
  Small, specific marks like these are what make a frame feel cared for.

How much of each depends on the format. A lower-third needs very little; a
brand spot can carry a lot. Detail stays decorative: it never adds a claim,
a number or a line of copy that isn't in the brief.

## Composing the frame

- Give the eye at least two places to go in every frame.
- Let hero text take most of the width, roughly 60 to 80 percent of it.
- Pin content to an edge, or divide the frame into zones (a figure on one
  side and its explanation on the other, a header strip over a full-width
  image). A single block floating in the middle is the web habit to break.
- Use rules and dividers as structure. They give the eye a path and are easy
  to animate (grow a `Rect` from width 0).
- Every line needs a reason. If you can't say where a line starts, where it
  ends, and what it points at, delete it.

## Vertical safe zones

A vertical video in a social feed shares the screen with the app: the account
name and progress bar along the top, buttons down the right side, and the
caption and controls across the bottom. Anything important placed there gets
covered. Platforms differ and change their layouts, so treat these margins as
a rough guide and keep the takeaway, faces and key text inside them:

```ts
const safe = {
  top: Math.round(0.08 * height),
  right: Math.round(width - 0.12 * width),
  bottom: Math.round(height - 0.2 * height),
  left: Math.round(0.05 * width),
};
```

Backdrops, glows and decoration can still run edge to edge. Only the content
that has to be read or seen stays inside. A landscape video played full
screen doesn't need these margins beyond normal padding.

## Color

With no brand to follow, start from a look in [looks.md](looks.md) instead
of inventing a palette. Either way, decide the palette once, as constants,
before you create a single node:

```ts
const palette = { bg: "#14110f", fg: "#f4efe6", accent: "#ff6a3d" };
```

If the user gives you brand colors or fonts, those exact values go into the
palette and the font choice, and they don't change. What you adapt for video
is how they're used: sizes, spacing, stroke weights, how much of the frame
each color covers. A brand that only ever appears as a thin accent on a web
page might need to fill a whole background in a video. Never nudge a brand
hex to make it "work better", and never swap a brand font for a similar one.

- One accent. Keep the same background for every scene, so cuts feel like
  one video.
- Lean the neutrals toward the accent. A warm accent wants warm grays and an
  off-white; a cool one wants cool grays. Avoid pure `#000` and `#fff`.
- Every frame needs one spot of color strong enough to pull the eye. A quiet
  palette still needs that one spot.
- Text needs contrast against what's really behind it: a ratio of at least
  4.5 to 1 under 48 times `u`, and 3 to 1 at 48 times `u` or more.
  `npx smoove agent check` measures it on the frame and names a palette color that
  passes. A look's `accent` is meant for large type for this reason.

## What compression eats

Every video gets compressed before anyone sees it, and the encoder throws
away some kinds of detail first. Style for what survives:

- Color is stored at a lower resolution than brightness. Thin text in a
  saturated color on another strong color (red on blue, green on purple)
  comes out with fuzzy, bleeding edges. Make colored text bold and large, or
  let brightness carry the contrast: light text on dark, or dark on light.
- Hairlines thinner than about 2 times `u` shimmer and break up as things
  move. Make lines thicker, or leave them out.
- A smooth linear gradient across a whole dark frame shows visible bands.
  Use a solid fill with a radial glow behind the subject;
  [performance.md](performance.md) has the glow recipe, and it's cheap to
  draw.
- Very fine repeating patterns (tight stripes, dense dot grids) turn to
  mush or flicker. Scale the pattern up until each mark is several pixels
  wide.

## First-draft habits

These are what a model reaches for when nobody decides. Each one is fine as
a deliberate choice for this subject; just make it a choice.

- Headline text filled with a gradient.
- A teal or violet glow on near-black.
- A grid of identical cards.
- Everything stacked down the center line at the same weight.
- A reflex font as the display face (see "Picking faces" in
  [fonts.md](fonts.md)).

## Numbers on screen

A viewer gets a few seconds with a figure, not a minute.

- Give each number something to stand on: a bar filling to its value, a ring
  closing, a shape scaled to it. On its own, a figure is just text.
- When several numbers describe the same thing (four quarters, three
  metrics for one product), keep them in the same place and style and let
  only the value change. Save a change of style for a change of subject.
- Skip the office-report furniture: pie charts, legends, gridlines, axis
  ticks, double axes, and dashboards with many panels.

## Photos and footage

A still dropped flat onto the canvas reads as a slide. Give it some life:

- A slow push: scale from 1 to 1.04 across the whole beat.
- A device frame: a `Block` with `cornerRadius`, a `borderSize` of 2 to 4
  times `u`, and the image inside.
- Depth: a cut-out subject moving slightly faster than the plate behind it.

If the entrance animates a wrapper, put the slow push on the child inside
it, so two updaters never fight over the same `scale`. A node inside a
`Flex`/`Block` has its position set by layout, so animate its scale or
opacity, not its `x`/`y` (see [animation.md](animation.md)).
