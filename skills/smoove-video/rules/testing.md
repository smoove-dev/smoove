# Testing a composition

A composition is a pure function of the frame, so it can be asserted like any
other function. `@smoove/core/testing` drives the clock and reports what is
actually on screen, with no browser and no rendering.

Use it when a brief carries numbers ("the title lands by 0.5s", "six cards on
screen at the end"). Those are acceptance criteria, and this turns them into
tests instead of something you eyeball once.

## Set it up

New `npm create smoove` projects come set up: `npm test` runs vitest, and
the sample composition has a `composition.test` next to it to copy from. Put
each composition's tests beside it the same way.

If `vitest.config.*` is missing (an older scaffold, or a project you wired
yourself), add vitest, the renderer's Node backend, and a `test` script:

```bash
npm i -D vitest @smoove/renderer
npm pkg set scripts.test="vitest run"
```

vitest is Vite, so the smoove plugin goes straight into a vitest config and
composition modules import directly, media imports and all:

```ts
// vitest.config.ts
import { smoove } from "@smoove/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [smoove()],
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

```ts
// src/test/setup.ts: the server renderer's Node backend (skia canvas plus
// Node font and media loaders). Must run before any composition is built.
import "@smoove/renderer/register";
```

Use `@smoove/renderer/register`, not the bare `konva/skia-backend`. The bare
backend has no font loader, so any comp with a `Font` or a
`@smoove/google-fonts` node (almost all of them) throws
`ReferenceError: FontFace is not defined`. The register import also lets a
`Video` load in tests.

On `@smoove/core` 0.4.0 and earlier, `probeAt`/`countAt` don't type-check
against a composition with typed `props`. Later versions accept it; on those
versions, pass `comp as unknown as Composition`.

## Assert a frame

```ts
import { countAt, probeAt } from "@smoove/core/testing";
import { describe, expect, it } from "vitest";
import comp from "./composition.js";

describe("intro", () => {
  it("puts the title in place by half a second", async () => {
    await comp.whenReady();

    const [title] = probeAt(comp, { time: 0.5 }, ".title");
    expect(title?.visible).toBe(true);
    expect(title?.box.y).toBeCloseTo(180, 1);
    expect(title?.paint).toEqual({ kind: "color", color: "#f5f5f5" });

    expect(countAt(comp, { time: 6.0 }, ".card")).toBe(6);
  });
});
```

- `probeAt(comp, at, selector)` drives the composition to `at` and reports
  every match. `at` is a global frame number, or `{ time }` in seconds
  (rounded to the nearest frame).
- `countAt(comp, at, selector)` counts only what actually paints.
- `probe(comp, selector)` reads the frame the composition already sits on.
- Selectors are Konva selectors: `#id`, `.name`, `TypeName`. Give the nodes
  you plan to assert on a `name`, the same way you would for `query()`.

Each probe reports `box` (stage-space, axis-aligned, via `measure`), `opacity`
(with every ancestor folded in), `visible`, `paint`, `name`, and the `node`
itself for anything the probe does not cover.

`visible` is the honest question: it is false for a node in a sequence that is
out of range, for a hidden ancestor, and for anything whose effective opacity
reached zero. A node that exists in the tree but paints nothing counts as not
on screen.

`paint` is what the node resolved to, not what was configured:
`{ kind: "color", color }` or `{ kind: "gradient", stops }`, or undefined when
nothing paints. A `Block` reports its background here even though it paints
through an internal rect.

## What a probe can and can't tell you

Probes and `measure()` lay layouts out on demand. That makes `box` right even
for a layout playback doesn't reflow (on `@smoove/core` 0.4.0 and earlier,
one behind a plain `Group`: see "Current limitations" in
[layout.md](layout.md)), so a probe can pass while the studio paints a stale
frame. Probes are good for timing, visibility, counts and paint. To check
what playback itself laid out, step the clock with `comp.setFrame(n)` and
read the raw attributes, with no probe or measure in between (both write
positions too):

```ts
// row: gap 10, child `a` grows 10px a frame from 50, `b` follows it
comp.setFrame(5);
const b = comp.queryOne(".b")!;
expect(b.attrs.x).toBe(110); // what playback placed, parent-local
```

Step to a frame other than the one the playhead sits on: a `setFrame` to the
current frame is skipped.

Pick probe frames a few frames after an entrance starts. With an eased fade
the first frame is opacity 0, and opacity 0 counts as not visible:

```ts
const t = cue("hook", "nobody");
expect(probeAt(comp, t - 2, ".stamp")[0]?.visible).toBe(false);
expect(probeAt(comp, t + 6, ".stamp")[0]?.visible).toBe(true); // not t
```

## Reading a `Text`'s content

`getText()` returns the content (`.text()` is not wired through, see
[text.md](text.md)). A probe hands back a plain Konva node, so narrow it
first:

```ts
import type { Text } from "@smoove/core";

const textOf = (node: unknown) => (node as Text).getText();
```

On `@smoove/core` 0.4.0 and earlier there's no `getText()`; read the private
field instead: `(node as { _fullText: string })._fullText`.

## Cues from data

When timing comes from a transcript, assert against the same data the comp
anchors to, so the test survives a re-cut. A counter that drops one when the
speaker says "one less":

```ts
import { cue } from "./timeline.js"; // word -> output frame, from the transcript

it("reads 45,999 after 'one less'", async () => {
  await comp.whenReady();
  const [before] = probeAt(comp, cue("enrolled", "46") + 30, ".counter");
  expect(textOf(before?.node)).toBe("46,000");
  const [after] = probeAt(comp, cue("dropped", "one") + 2, ".counter");
  expect(textOf(after?.node)).toBe("45,999");
});
```

`cue(phrase, word)` is a few lines over the word list, see "Cues from data"
in [sequencing.md](sequencing.md).

## Gotchas

- `await comp.whenReady()` first. Fonts and images load asynchronously, and a
  box measured before the real face lands is measured against a fallback.
- `probeAt` leaves the playhead where it drove it, so successive calls read as
  a walk along the timeline rather than independent probes.
- Assert numbers you derived from the composition's own updater, not numbers
  you read out of a passing test. A test that only records current behaviour
  will not catch the day it changes.
