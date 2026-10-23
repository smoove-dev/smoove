---
name: smoove-video
description: "Use when writing or changing a smoove video: a composition.ts in a smoove project, or any code that builds a Composition with @smoove/core, from a new explainer or promo to a one-line tweak. smoove is a timeline-driven animation engine built on top of Konva, where everything on screen is a function of the frame number. Covers planning the video and its beats, scenes and clips, Flex and Block layout, animating with interpolate, text, fonts and media, and checking the result in the studio with npx smoove agent (check, snapshots, contact sheets) instead of rendering."
metadata:
  tags: smoove, konva, video, animation, composition, motion
---

## When to use

Any time you're authoring or editing smoove (`@smoove/*`) composition code — a
new scene, an animated layout, text, shapes, or media. Out of scope: running
or previewing a composition (`@smoove/player`, the Studio) and rendering to
MP4/stills (`@smoove/renderer`) — this skill covers writing the
`composition.ts` code itself, plus the quick checks in "Check your work
without rendering" below.

## Mental model

`Composition extends Konva.Stage` and owns the frame clock (`fps` +
`durationInFrames`). `Sequence extends Konva.Layer` is range-gated — visible
and ticked only while the playhead is in `[from, from + durationInFrames)`.
Each frame, every active sequence runs its registered updaters, then
re-flows any `Flex`/`Block` layout, then draws. You animate by mutating Konva
node properties inside `sequence.register((localFrame) => { ... })` —
**imperative, per-frame, pull-based, and a pure function of the frame**. No
CSS transitions/keyframes, no React, no `setInterval`/`requestAnimationFrame`/
`Konva.Tween`, no `Date.now()`/`Math.random()` (core ships a seeded
`random(seed)` for scatter: call it for a float, or use `.range`/`.int`/
`.pick`) — anything not derived from `frame` (and `props`)
breaks scrubbing and headless rendering even though it looks fine during
real-time playback. `@smoove/core`
re-exports the whole drawing vocabulary (`Rect`, `Circle`, `Text`, `Image`,
…) — **import shapes and nodes from `@smoove/core`, not `Konva.*` directly**;
reach for raw Konva only for something core doesn't wrap (see
[rules/shapes.md](rules/shapes.md)).

## Plan the video first

For a new video, settle the plan before any code. Write a six-line brief
(who watches, the takeaway, length, where it plays, must-haves, the feel),
name the rhythm in a few words, and get the user to approve a numbered beat
list where every beat says what it does for the takeaway. The approved list
becomes a `plan()` call, one marker per beat, so retiming is a one-number
change. Skip all of this for edits to an existing composition. Details:
[rules/planning.md](rules/planning.md).

## Design for video

Frames are seen once, at speed, often on a phone. Size everything from the
canvas's short side (`u = Math.min(width, height) / 1080`): headlines of 64
to 120 times `u`, and nothing under 24 times `u` without a reason. Build
each frame in three layers (backdrop, subject, detail), give the eye two
places to go, and pin content to edges instead of floating it in the middle.
With no brand to follow, start from a look in
[rules/looks.md](rules/looks.md) for the palette and fonts. Details:
[rules/direction.md](rules/direction.md).

## Create a composition

A composition is a single module that default-exports a `Composition` built
from `@smoove/core` primitives — no other wiring required:

```ts
import { Circle, Composition, Rect, Sequence } from "@smoove/core";

const width = 1280;
const height = 720;
const fps = 30;
const comp = new Composition({ id: "my-scene", fps, durationInFrames: fps * 3, width, height });

const main = new Sequence(); // spans the whole composition — no options needed
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
const circle = new Circle({ x: 100, y: height / 2, radius: 60, fill: "#4ea1ff" });
main.add(circle);
comp.add(main);

main.register((frame) => {
  const total = comp.durationInFrames.get();
  circle.x(100 + frame * ((width - 200) / total));
});

export default comp;
```

## Sequence scenes & anchor cues

`Series` lays scenes back-to-back and computes each `Sequence`'s `from`. Give
scenes a `name` and anchor cues (SFX, captions, overlays) to **timeline
markers** instead of frame numbers: `new Sequence({ from:
series.marker("code").start.add(-10) })` moves with the beat when scenes are
retimed, and `until:` spans one beat to another. Never hand-pin a cue's frame
to a number derived from other scenes' durations. Frames that come from data
(a transcript's word timings, a beat map, a subtitle file) are the exception:
the data is the source of truth, so build markers from it. `comp.add` order
is z-order: later sequences paint on top. Details:
[rules/sequencing.md](rules/sequencing.md).

## Animate

`interpolate(frame, inputRange, outputRange, { easing, extrapolateLeft,
extrapolateRight })` + `Easing` (`Easing.in/out/inOut(Easing.cubic|quad|...)`,
`Easing.bezier(...)`, `Easing.spring`-style timings live in
`@smoove/transitions`). **Gotcha:** a `Flex`/`Block` child's `x()`/`y()` are
overwritten every tick by the layout pass that runs *after* updaters, so
animate `opacity()`, `scale()`, `rotation()`, its size, or flex props
(`flexGrow`, `gap`, `padding`, `alignSelf`) instead. Size is `width()`/
`height()` on every node (px, `"50%"` or `"auto"`), and layout reflows around
it on the same frame. Details: [rules/animation.md](rules/animation.md).

## Components & nested timelines

`Clip` is a range-gated, tickable `Group`: `Sequence` semantics without the
per-layer canvas, nestable to any depth. A shareable component is a plain
function that builds a `Clip`, registers an updater, and returns it:

```ts
export function pulseDot({ size, ...clipOpts }: Props): Clip {
  const clip = new Clip(clipOpts); // from/durationInFrames + any GroupConfig
  clip.add(new Circle({ /* geometry in a fixed unit box, scaled by size */ }));
  clip.register((frame, { time }) => { /* seconds via info.time = fps-portable */ });
  return clip;
}
seq.add(pulseDot({ size: 120, x: 400, y: 300, from: 60 }));
```

Every updater (on `Sequence` and `Clip`) receives `(frame, info)` with
`info = { time, fps, durationInFrames, globalFrame }`. Every smoove node has
`getComposition()`/`getSequence()`/`getClip()`, and `Composition`/`Sequence`/
`Clip` expose cached `query()`/`queryOne()` (Konva selectors: `#id`, `.name`,
`TypeName`), cheap to call every frame (e.g. duck the `#music` audio from a
voice-over updater). Keep `Audio`/`Video` directly in a `Sequence` for now.
Details: [rules/components.md](rules/components.md).

## Layout

Drop `Flex`/`Block` into a sequence for CSS-flexbox-like auto layout
(`flexDirection`, `justifyContent`, `alignItems`, `gap`, `padding`,
gradients/shadows/borders/`cornerRadius` on `Block`). Reflow is automatic —
no manual wiring. Reach for it when content is dynamic (props, templates,
lists of varying length); when every line of copy is static and known up
front, as in a reel or a one-off explainer, fixed `x`/`y` is simpler and
exact. Details, including the current limitations:
[rules/layout.md](rules/layout.md).

## Text & fonts

`Text` (extends `Konva.Group`, not `Konva.Text` — use `.setText()` for content
and `.setFontSize()` for size) supports `fitText`, `maxLines`/`ellipsis`, a
built-in `typewriter` reveal, and `highlights`. `.fontSize()` reads back the
size the glyphs actually render at, which is the fitted one under `fitText`.
`ellipsis` defaults to on and truncates silently, so give headlines and
labels a `width` and `ellipsis: false`. Word-by-word captions have a recipe.
Details: [rules/text.md](rules/text.md) and,
for installable Google Fonts, [rules/fonts.md](rules/fonts.md).

## Media

`Image` comes from `@smoove/core`; `Audio`/`Video` ship in `@smoove/media`
(add it as a dependency). Passing `introspect` to `Audio` turns the clip's
real sound into frame-pure signals — `rmsAt`/`peakAt`/`bandsAt`/`noveltyAt`/
`waveform` — for meters, EQ bars, waveforms, and beat-synced motion that
scrub and server-render deterministically. Editing real footage (cutting
silences, reframing 16:9 to 9:16, covering the speaker with a graphic) has
its own section, and long recordings have their own workflow (see "Long
footage and research" below). Details: [rules/media.md](rules/media.md).

## Performance

An animated scene is a full-canvas repaint every frame. **Never `shadowBlur`
in an animated scene** — canvas shadow blur re-runs per shape per frame and
profiles as the dominant cost (choppy on retina/mobile). Fake glows instead:
radial-gradient fills for dots/orbs, a wide faint under-stroke for lines, a
gradient disc behind sharp shapes for halos. Use 30fps for ambient/background
motion. Recipes + the scale-not-radius gotcha:
[rules/performance.md](rules/performance.md).

## Verify what you built

When a brief carries numbers ("the title lands by 0.5s", "six cards at the
end"), assert them instead of eyeballing a preview. `@smoove/core/testing`
drives the clock and reports what is on screen, headless:

```ts
import { countAt, probeAt } from "@smoove/core/testing";

await comp.whenReady();
probeAt(comp, { time: 0.5 }, ".title")[0]?.box.y; // stage-space, at that frame
countAt(comp, { time: 6.0 }, ".card"); // how many actually paint
```

Probes lay layouts out on demand, so they can pass while playback paints a
stale frame; [rules/testing.md](rules/testing.md) says how to check what
playback itself laid out, and the setup file that works with fonts.

## Working in the studio

MP4 renders are slow, and the user wants to see the result, not wait for it.
In a studio project (one made with `npm create smoove`, studio template),
look at your work with the `smoove` command:

1. Never render a video to check your work. Look with
   `npx smoove agent sheet`, `snap` and `timeline`, and the tests. Run
   `npx smoove render` only when the user asks for a video.
2. Start the studio yourself with `npx smoove agent start`, and give the
   user the URL it prints so they can watch.
3. A new composition starts with
   `npx smoove new --title "<title>" --format landscape|portrait|square`:
   one folder under `compositions/`, with the `index.ts` entry the studio
   needs. There's no registry to edit.
4. Loop: write, typecheck, test, `npx smoove agent check --comp <id>`, then
   one `npx smoove agent sheet --comp <id>` per pass. Read the image, fix,
   repeat. Fix every error check reports; fix each warning or allow it, with
   a reason, in the composition's checks file. One sheet per pass, not one
   image per beat; use `snap --at <beat>` for a closer look at one moment.
5. When the user says "this", "here" or "that one", run
   `npx smoove agent context` before anything else. It lists the nodes they
   marked on the frame, with the file and line that made each one. With no
   mark, ask them to drag a rectangle over the thing in the studio.

The project's `.mcp.json` also registers these commands as MCP tools
(`mcp__smoove__snap` and the rest). When you have them, use them: same
commands, same results, and `snap` and `sheet` hand you the image directly.

Pass the plan to the composition (`plan: beats`, see
[rules/planning.md](rules/planning.md)), so the sheet shows one tile per beat
and `--at` knows the names. The commands, what they print, and how to read a
sheet: [rules/studio.md](rules/studio.md).

Without a studio (a plain player app), prefer `tsc`, the headless tests
above, and the running preview. Either way, check this skill is installed in
the project: look for `.agents/skills/smoove-video`, and if it's missing run
`npx skills add smoove-dev/smoove -s smoove-video`.

## Long footage and research

When the user hands you a recording to edit (a lecture into a TikTok, the
quiet parts out), map it with the `smoove agent` media tools before editing,
and never cut the footage: a recut composition plays ranges of the original
file from its `cuts.json`, so every adjustment is a change to a number.
Bring it in with `footage_add`, then `media_info`, `media_audio`,
`media_sheet` and `transcribe`; shortlist the highlights with the user;
build with `smoove new --template recut` and `cut_plan`. Details:
[rules/footage.md](rules/footage.md), and for the words on screen,
[rules/captions.md](rules/captions.md).

For an explainer, research first, plan the beats from what you found, and
bring every picture in with `asset_add` so it's credited. Details:
[rules/research.md](rules/research.md).

Your own tools come first. If you can transcribe, search the web, find
images or take a screenshot yourself, do that, then hand the result to
smoove (`transcribe` imports a transcript, `asset_add` credits a file). Use
smoove's own `transcribe`, `asset_search` and `page_shot` when you have
nothing better, and never install a model without asking the user first.

## Effects (optional)

`@smoove/effects` is its own package: `npm i @smoove/effects`. As of 0.4 the
published 0.3.6 still peers on `@smoove/core@^0.3.6`, so in a 0.4 project
npm refuses it until you pass `--legacy-peer-deps` (it works at runtime).

`@smoove/effects` post-processes a node as it draws. `flameWrap` wraps fire
around a node — its rounded box by default, or its alpha edge with
`shape: "silhouette"` so a burning `Text` burns letter by letter:

```ts
import { flameWrap } from "@smoove/effects";

// color is [r, g, b] in 0..1; the default is blue ([0.31, 0.54, 1])
const fire = flameWrap({ radius: 40, intensity: 0, color: [1, 0.42, 0.08] }); // match your cornerRadius
card.effects([fire]);
seq.register((frame) => {
  fire.intensity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp" });
});
```

Three rules. `intensity: 0` disables the effect, so animate it from 0 to
ignite. Put the effect on the node you want burning, never on the `Sequence`,
because cost tracks the area being shaded. Keep that node's box near its
content: a centred `Text` with `width: 1280` makes the effect shade the whole
frame, so give it a width close to the glyphs and centre it with `x`.
`flameWrap` needs WebGL; where there is none the fire is skipped and the node
draws normally.

`droplets` puts rain on a pane of glass in front of a node, and inverts the
box rule: it refracts what is behind it, so its node is meant to hold a scene
(a `Video`, an `Image`, a `Group` with a whole layout), and it never paints
outside that node's alpha. Animate `intensity` for a squall; move `blur` with
it to fog the window up and clear it again.

```ts
import { droplets } from "@smoove/effects";

const rain = droplets({ intensity: 0, vignette: 0.5 });
pane.effects([rain]);
seq.register((frame) => {
  rain.intensity = interpolate(frame, [0, 60], [0, 1.15], { extrapolateLeft: "clamp" });
  rain.blur = 2 + rain.intensity * 4;
});
```

## Optional add-ons

- `@smoove/transitions` — `TransitionSeries` + presentations (fade, slide,
  wipe, dissolve, …) for scene-to-scene cuts. [rules/transitions.md](rules/transitions.md)
- `@smoove/google-fonts` — typed per-family classes (`import Roboto from
  "@smoove/google-fonts/roboto"`) for `Text`'s `font` prop. [rules/fonts.md](rules/fonts.md)

## Topic index

[planning](rules/planning.md) · [studio](rules/studio.md) · [direction](rules/direction.md) ·
[looks](rules/looks.md) · [sequencing](rules/sequencing.md) · [components](rules/components.md) ·
[layout](rules/layout.md) ·
[animation](rules/animation.md) · [text](rules/text.md) ·
[shapes](rules/shapes.md) · [media](rules/media.md) ·
[performance](rules/performance.md) · [testing](rules/testing.md) ·
[footage](rules/footage.md) · [captions](rules/captions.md) ·
[research](rules/research.md) ·
[transitions](rules/transitions.md) (optional) · [fonts](rules/fonts.md)
(optional)
