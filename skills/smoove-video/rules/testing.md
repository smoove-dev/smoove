# Testing a composition

A composition is a pure function of the frame, so it can be asserted like any
other function. `@smoove/core/testing` drives the clock and reports what is
actually on screen, with no browser and no rendering.

Use it when a brief carries numbers ("the title lands by 0.5s", "six cards on
screen at the end"). Those are acceptance criteria, and this turns them into
tests instead of something you eyeball once.

## Set it up

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
// src/test/setup.ts — the same backend the server renderer uses
import "konva/skia-backend";
```

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

## Gotchas

- `await comp.whenReady()` first. Fonts and images load asynchronously, and a
  box measured before the real face lands is measured against a fallback.
- `probeAt` leaves the playhead where it drove it, so successive calls read as
  a walk along the timeline rather than independent probes.
- Assert numbers you derived from the composition's own updater, not numbers
  you read out of a passing test. A test that only records current behaviour
  will not catch the day it changes.
