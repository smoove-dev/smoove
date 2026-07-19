# Performance

Everything in an active sequence repaints every frame — a smoove scene where
everything moves is a full-canvas redraw at the composition's fps. Per-frame
paint cost therefore IS the frame rate. Three levers control it: **what you
draw** (shadow blur is the dominant cost), **how many pixels** (composition
size × pixel ratio), and **how often** (fps).

## Never `shadowBlur` in animated scenes

Canvas `shadowBlur` re-runs a Gaussian blur for every shadowed shape on every
frame. Profiled on a glow-heavy full-viewport scene (dozens of glowing
shapes), shadows alone cost 3–4× everything else combined — the difference
between ~20fps and smooth on large/retina screens, and worse on weaker GPUs.
`shadowBlur` is fine in a *static* scene that draws once; in anything
animated, fake the glow instead:

**Glowing dot / orb** — one radial-gradient disc sized to the glow extent,
solid core, transparent rim. Add a mid-stop: a Gaussian falloff is much
steeper than a linear fade, so without one the glow reads as a heavy bokeh
blob instead of a halo.

```ts
// ✅ glow via gradient — near-free to draw
const spark = new Circle({
  x, y,
  radius: r * 3.5, // the glow extent, not the body
  fillRadialGradientStartPoint: { x: 0, y: 0 },
  fillRadialGradientEndPoint: { x: 0, y: 0 },
  fillRadialGradientStartRadius: 0,
  fillRadialGradientEndRadius: r * 3.5,
  // solid core → mid-stop → transparent rim (mimics Gaussian falloff)
  fillRadialGradientColorStops: [0, color, 0.28, color, 0.5, `${color}40`, 1, `${color}00`],
  listening: false,
});

// 🚫 same look, one Gaussian blur per shape per frame
const slow = new Circle({ x, y, radius: r, fill: color, shadowColor: color, shadowBlur: 10 });
```

**Glowing line / ribbon** — draw it twice over the same points: a wide,
faint under-stroke as the glow, the crisp stroke on top.

```ts
const glow = new Line({ points, stroke: color, strokeWidth: sw * 3, opacity: op * 0.35, lineCap: "round", tension: 0.4 });
const line = new Line({ points, stroke: color, strokeWidth: sw, opacity: op, lineCap: "round", tension: 0.4 });
scene.add(glow, line); // update both .points() in register()
```

**Sharp shape with a halo** (diamond, star, text) — put a gradient-disc
`Circle` behind it and drive both `x`/`y`/`opacity` in `register()` (halo at
~0.5–0.6× the shape's opacity).

**Gotcha — gradient radii live in local coordinates.** They don't track an
animated `radius()`. To breathe/pulse a gradient shape, animate `scale`, not
`radius`, so the gradient scales with the body:

```ts
// ✅ gradient breathes with the body
const k = 1 + 0.2 * Math.sin((frame / total) * Math.PI * 2);
orb.scaleX(k); orb.scaleY(k);
// 🚫 body grows, gradient stays put
orb.radius(base + 40 * Math.sin(...));
```

## Match fps to the motion

`fps` is the redraw rate. 30fps reads identically for ambient/background
motion (drifting orbs, slow loops) and halves the paint work; reserve 60fps
for fast motion the eye tracks (quick slides, snappy UI mockups). Duration
math stays in seconds either way (`durationInFrames: fps * 30`).

## Big canvases multiply everything

Cost scales with backing pixels: a 1200×1200 composition at device pixel
ratio 2 rasterizes 5.76 MP per frame. When a composition is embedded as a
dim page backdrop (masked, semi-transparent), retina density is invisible —
cap it with the player's `max-pixel-ratio="1"` attribute. That's a player
concern, but it changes what the comp can afford: budget the scene for the
resolution it will actually render at.

## Misc

- `listening: false` on every node in a non-interactive scene skips
  hit-graph work.
- Fewer, bigger shapes beat many tiny ones only when shadowed; plain fills
  and gradients are cheap — dozens of gradient discs profile fine.
