# Unified Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline in the main session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `width()`/`height()` become the one sizing API on every smoove node; `flexWidth`/`flexHeight` leave the public surface.

**Architecture:** A `Sized` mixin overrides Konva's `setWidth`/`getWidth`/`setHeight`/`getHeight` (the pair every Konva path routes through: `width(v)`, `setAttrs`, the constructor config). The setter stores the *declared* size under an internal attr; the getter flushes layout if anything changed, then returns Konva's computed pixel box. Layout writes go through the base Konva setter.

**Tech Stack:** TypeScript, Konva 10, flexily, Vitest + skia-canvas.

**Spec:** `docs/superpowers/specs/2026-10-17-unified-sizing-design.md`

## Global Constraints

- Getter always returns pixels (number). Setter accepts `number | "${n}%" | "auto"`; `"auto"` is stored as `undefined`.
- Declared size lives in attrs `__kmWidth` / `__kmHeight` (so `clone()` keeps it), never a class field.
- Layout writes call the base Konva setter, never `_setAttr` directly (radius/points shapes map width onto geometry).
- Overrides run during `super()` in constructors: they may touch only `this.attrs` and module state.
- `x()`/`y()` semantics unchanged. No `position: "absolute"`.
- Setting `flexWidth`/`flexHeight` has no effect and warns once.
- Don't commit unless Rotem asks.

## Review Focus

- `Circle`/`Star` given `width(100)`: radius becomes 50 and `width()` reads 100 (Task 3).
- `node.clone()` keeps a `"50%"` width (Task 3).
- Drawing a layer never triggers a layout pass, and layout never recurses through a getter (Task 2).
- `setAttrs({ width: "50%" })` and the constructor config behave exactly like `width("50%")` (Task 3).
- A wrapping `Text` with a fixed width and auto height reports its wrapped height on read (Task 3).

---

### Task 1: The sizing core

**Files:**
- Create: `packages/core/src/layout/size.ts`
- Modify: `packages/core/src/effects/dirty.ts` (export `isDerivedWrite(): boolean` → `derivedDepth > 0`)
- Test: `packages/core/src/layout/size.test.ts`

**Interfaces — Produces:**
- `DECLARED_WIDTH = "__kmWidth"`, `DECLARED_HEIGHT = "__kmHeight"`
- `declaredWidth(n: Konva.Node): SizeValue | undefined`, `declaredHeight(…)`
- `layoutEpoch(): number`: bumped by a global, idempotent patch of `Konva.Node.prototype._setAttr` (install once at module load, like `engine/structure.ts`) on any write outside `withDerivedWrites`. The same patch warns once per key when the key is `flexWidth`/`flexHeight`.
- `markLaidOut(root: Konva.Node): void`: records `[layoutEpoch(), structureVersion()]` in a module `WeakMap`.
- `flushLayout(n: Konva.Node): void`: walks up while the parent is a smoove container (`_kmRole === "container"`); if the topmost such container's recorded pair is stale, runs `withDerivedWrites(() => root._kmComputeLayout())`. No-op when there is no container, while a layout is running, or while a layer is drawing.
- `layoutDepth` guards (`enterLayout()`/`exitLayout()`) and a draw guard: patch `Konva.Layer.prototype.drawScene` and `drawHit` to raise a depth counter.
- `Sized<B extends new (...a: any[]) => Konva.Node>(Base: B)` mixin adding:
  - `setWidth(v: SizeValue | "auto" | undefined): this`: writes `DECLARED_WIDTH`; when px, also calls `Base.prototype.setWidth`. Same for height.
  - `getWidth(): number`: `flushLayout(this)`, then `Base.prototype.getWidth`.
  - `_kmBoxWidth(px: number): void` / `_kmBoxHeight(px)`: base-setter write, for layout and intrinsic sizing.

- [ ] **Step 1: Failing tests** in `size.test.ts`:
  - `"bumps the epoch on an attr write"`: `const e = layoutEpoch(); new Konva.Rect().setAttr("fill", "red"); expect(layoutEpoch()).toBeGreaterThan(e)`
  - `"does not bump inside withDerivedWrites"`: epoch unchanged
  - `"warns once on flexWidth"`: spy `console.warn`; two `setAttr("flexWidth", 1)` → called once, message contains `width()`
- [ ] **Step 2:** `pnpm --filter @smoove/core test size`: FAIL (module missing)
- [ ] **Step 3:** Implement `size.ts` per the interfaces above.
- [ ] **Step 4:** Same command: PASS

### Task 2: Containers (`Flex`, `Block`) and the layout pass

**Files:**
- Modify: `packages/core/src/layout/flex/flex.ts` (`Flex extends Sized(Konva.Group)`, `layoutRoot`, `buildChildren`, `_kmPlace`)
- Modify: `packages/core/src/layout/block.ts` (`Block extends Sized(Konva.Group)`, `pickKonvaConfig`, `_kmPlace`)
- Test: `packages/core/src/layout/size.test.ts`

**Interfaces — Consumes:** everything from Task 1.

- `layoutRoot(group)`: drop the `alwaysSetSize` param and always write the computed size back; read sizes with `declaredWidth/Height`; a `"%"` on a root resolves against `group.getComposition()`'s `width()`/`height()`; wrap the body in `enterLayout()`/`exitLayout()`; end with `markLaidOut(group)`; write sizes with `_kmBoxWidth/_kmBoxHeight`.
- `buildChildren`: every `child.attrs.flexWidth`/`flexHeight` becomes `declaredWidth(child)`/`declaredHeight(child)`.
- Constructors: stop copying `config.width` into `flexWidth` and stop stripping `width`/`height` in `pickKonvaConfig`; the config now reaches `setWidth` through Konva.
- `_kmPlace`: `_kmBoxWidth`/`_kmBoxHeight` for size; `x()`/`y()` unchanged.

- [ ] **Step 1: Failing tests** (scene helper as in `align-hug.test.ts`, 1280×720 comp):
  - `"width() in an updater reflows on the same frame"`: row Block with two 100px children; updater sets `a.width(300)`; `comp.setFrame(1)`; `b.x()` is `300`
  - `"reads are fresh after a set"`: child of a 1280px column; `c.width("50%")`; `c.width()` is `640` before any `setFrame`
  - `"width() returns the declared px immediately"`: `c.width(200); c.width()` is `200`
  - `"auto returns a Block to hugging"`: Block `width: 500` with a 120px child; `b.width("auto")`; `b.width()` is `120`
  - `"root 100% fills the composition"`: root `new Block({ width: "100%" })`; after `setFrame(0)`, `width()` is `1280`
  - `"hugging root Flex reports its size"`: root Flex with a 90px child; `width()` is `90`
  - `"drawing never runs layout"`: spy `_kmComputeLayout` on the root; `setFrame(1)`; reset spy; `seq.draw()`; spy not called
- [ ] **Step 2:** `pnpm --filter @smoove/core test size`: the new tests FAIL
- [ ] **Step 3:** Implement the changes listed above.
- [ ] **Step 4:** `pnpm --filter @smoove/core test`: all PASS (including `align-hug` and conformance)

### Task 3: Leaves (`FlexShape`, `Text`, `Image`, `Code`, `Lottie`)

**Files:**
- Modify: `packages/core/src/layout/flex/mixin.ts` (`Wrapped extends Sized(Base)`, `pickLeafConfig` stops stripping `width`/`height`, `applyLeafFlexAttrs` drops `flexWidth`/`flexHeight`, `leafMeasure` reads `declared*`, `leafPlace` writes `_kmBox*`)
- Modify: `packages/core/src/layout/text/text.ts` (`Sized(Konva.Group)`; the nine `flexWidth`/`flexHeight` reads become `declared*`; self-size writes such as `this.height(ownH)` become `_kmBoxHeight(ownH)`)
- Modify: `packages/core/src/layout/image.ts` (`Sized(Konva.Group)`; `_kmMeasure` reads `declared*`)
- Modify: `packages/code/src/code.ts:293-294`, `packages/lottie/src/lottie.ts:197-198` (`declared*` checks; intrinsic writes via `_kmBox*`)
- Test: `packages/core/src/layout/size.test.ts`

- [ ] **Step 1: Failing tests:**
  - `"Circle width sets the radius"`: `new Circle({ width: 100 })`; `radius()` is `50`, `width()` is `100`
  - `"clone keeps a declared percent"`: `r.width("50%")`; `r.clone().getAttr("__kmWidth")` is `"50%"`
  - `"setAttrs and config match width()"`: three Rects in a 1280px row, sized by config, `setAttrs`, and `width()` with `"25%"`: all read `320`
  - `"wrapping Text reports its height"`: `Text` with `width: 200` and a long string; `height()` is greater than one line height without a `setFrame`
  - `"unsized Image still uses its bitmap"`: keep the conformance `leaves` cases green
- [ ] **Step 2:** `pnpm --filter @smoove/core test size`: FAIL
- [ ] **Step 3:** Implement the file changes listed above.
- [ ] **Step 4:** `pnpm --filter @smoove/core test` and `pnpm --filter @smoove/code test` and `pnpm --filter @smoove/lottie test`: PASS

### Task 4: `Video` (media)

**Files:**
- Modify: `packages/media/src/video/index.ts:131-132,220-221` (`Video extends Sized(Konva.Group)`; constructor stops copying into `flexWidth`; measure reads `declared*`; place writes `_kmBox*`)

- [ ] **Step 1:** Add `"video honours width()"` to `packages/media` tests: a `Video` with `width: "50%"` in a 1280px row reads `640`.
- [ ] **Step 2:** `pnpm --filter @smoove/media test`: FAIL, then implement, then PASS

### Task 5: Docs, examples, changesets

**Files:**
- Modify: `packages/docs/content/docs/layout/flex.mdx`: replace the `flexWidth` callout with "animate `width()`"; add a short **Breaking out of a Flex** section: to place a node by hand, move it to the `Sequence` or a plain `Group`.
- Modify: `skills/smoove-video/rules/layout.md`, `skills/smoove-video/rules/assets/flex-card.composition.ts`: same message; the gotcha section becomes "`width()` drives layout; `x()`/`y()` on a Flex child do not".
- Modify: every `setAttr("flexWidth"|"flexHeight")` / `setAttrs({ flexWidth })` → `width()`/`height()` in `packages/docs/src/demos/{dynamic-props,flex-layout,wrapper-vs-raw}.ts`, `packages/kitchen-sink/src/compositions/{snoove-showcase/scenes/03-layout,shapes-playground/composition,text-fit/composition}.ts`, `packages/core/conformance/cases/reflow.ts`.
- Create: `.changeset/*.md`: `@smoove/core` **minor** (breaking); `@smoove/media`, `@smoove/code`, `@smoove/lottie` **patch**. Invoke `/smoove-writing` before writing any prose here or in the docs.

- [ ] **Step 1:** Make the edits above.
- [ ] **Step 2:** `git grep -n -E "flexWidth|flexHeight" -- packages skills ':!**/dist/**' ':!**/build/**'` shows only `size.ts` (the warning).
- [ ] **Step 3:** `pnpm build && pnpm -r test && pnpm --filter @smoove/core test:conformance:types && pnpm check`: all PASS.
- [ ] **Step 4:** Run the kitchen-sink `snoove-showcase` and `shapes-playground` comps in the studio (`:5190`) and confirm the layout scene animates as before.
