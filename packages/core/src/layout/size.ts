import Konva from "konva";
import { isDerivedWrite, withDerivedWrites } from "../effects/dirty.js";
import { structureVersion } from "../engine/structure.js";
import type { SizeInput, SizeValue } from "./flex/types.js";

/**
 * One sizing API: `width()` / `height()` on every smoove node.
 *
 * A smoove node keeps two sizes. The size you asked for (px, `%`, or `"auto"`)
 * is the *declared* size, stored under an internal attr so `clone()` carries
 * it. The size it came out is Konva's own `width`/`height`, which Konva draws,
 * caches and hit-tests from. The setter writes the first; the getter returns
 * the second, laying out first if anything changed since the last pass — the
 * way reading `offsetWidth` forces a browser reflow.
 */

export const DECLARED_WIDTH = "__kmWidth";
export const DECLARED_HEIGHT = "__kmHeight";

export type { SizeInput };

export function declaredWidth(n: Konva.Node): SizeValue | undefined {
  return n.attrs[DECLARED_WIDTH] as SizeValue | undefined;
}

export function declaredHeight(n: Konva.Node): SizeValue | undefined {
  return n.attrs[DECLARED_HEIGHT] as SizeValue | undefined;
}

// ----- layout epoch ----------------------------------------------------------

/**
 * Bumped by every attribute write anywhere, except derived ones (layout's own
 * write-back runs under `withDerivedWrites`). A layout root records the epoch
 * it last laid out at; a size read re-runs layout only when the epoch moved.
 *
 * Global rather than per-tree, like the structure version: a write elsewhere
 * costs at most one extra layout, and only when somebody reads a size.
 */
let epoch = 1;

export function layoutEpoch(): number {
  return epoch;
}

const warned = new Set<string>();

function install(): void {
  const nodeProto = Konva.Node.prototype as Konva.Node & { __kmSizePatched?: boolean };
  if (nodeProto.__kmSizePatched) return;
  nodeProto.__kmSizePatched = true;

  const origSetAttr = nodeProto._setAttr;
  nodeProto._setAttr = function patchedSetAttr(this: Konva.Node, key: string, val: unknown) {
    if (!isDerivedWrite()) epoch += 1;
    if ((key === "flexWidth" || key === "flexHeight") && !warned.has(key)) {
      warned.add(key);
      const fn = key === "flexWidth" ? "width()" : "height()";
      console.warn(`smoove: \`${key}\` is no longer read by layout. Use ${fn} instead.`);
    }
    return origSetAttr.call(this, key, val);
  } as typeof origSetAttr;

  // Drawing reads sizes constantly (a Rect draws from `this.width()`); it must
  // never trigger a layout mid-paint.
  for (const proto of [Konva.Container.prototype, Konva.Shape.prototype] as const) {
    const p = proto as unknown as {
      drawScene: (...a: unknown[]) => unknown;
      drawHit: (...a: unknown[]) => unknown;
    };
    for (const name of ["drawScene", "drawHit"] as const) {
      const orig = p[name];
      p[name] = function patchedDraw(this: unknown, ...args: unknown[]) {
        drawDepth += 1;
        try {
          return orig.apply(this, args);
        } finally {
          drawDepth -= 1;
        }
      };
    }
  }
}

// ----- flush on read ---------------------------------------------------------

let layoutDepth = 0;
let drawDepth = 0;

/** Bracket a layout pass: size reads inside it never re-enter layout. */
export function enterLayout(): void {
  layoutDepth += 1;
}

export function exitLayout(): void {
  layoutDepth -= 1;
}

const laidOutAt = new WeakMap<Konva.Node, { epoch: number; structure: number }>();

/** Record that `root` is laid out as of now. */
export function markLaidOut(root: Konva.Node): void {
  laidOutAt.set(root, { epoch, structure: structureVersion() });
}

type LayoutContainer = Konva.Node & { _kmRole?: string; _kmComputeLayout?: () => void };

/**
 * Make sure the layout `n` sits in is current. Walks up to the outermost smoove
 * container and re-runs its layout if anything changed since it last ran.
 */
export function flushLayout(n: Konva.Node): void {
  if (layoutDepth > 0 || drawDepth > 0) return;
  // A leaf sits in its parent's layout; a container may be the root itself.
  const start = n as LayoutContainer;
  let cur: LayoutContainer | null =
    start._kmRole === "container" ? start : (n.getParent() as LayoutContainer | null);
  let root: LayoutContainer | null = null;
  while (cur && cur._kmRole === "container") {
    root = cur;
    cur = cur.getParent() as LayoutContainer | null;
  }
  if (!root?._kmComputeLayout) return;
  const last = laidOutAt.get(root);
  if (last && last.epoch === epoch && last.structure === structureVersion()) return;
  const r = root;
  withDerivedWrites(() => r._kmComputeLayout?.());
  markLaidOut(r);
}

// ----- the mixin -------------------------------------------------------------

function normalize(v: SizeInput): SizeValue | undefined {
  return v === "auto" ? undefined : v;
}

/** The sizing surface {@link Sized} adds to a node. */
export interface SizedApi {
  /** Read the laid-out width in px, or set the size you want: px, `"50%"` or `"auto"`. */
  width(): number;
  width(v: SizeInput): this;
  /** Read the laid-out height in px, or set the size you want: px, `"50%"` or `"auto"`. */
  height(): number;
  height(v: SizeInput): this;
  /** @internal Write the laid-out width, leaving the declared size alone. */
  _kmBoxWidth(px: number): void;
  /** @internal Write the laid-out height, leaving the declared size alone. */
  _kmBoxHeight(px: number): void;
}

// biome-ignore lint/suspicious/noExplicitAny: mixin constructors take any args.
type MixinCtor<T> = new (...args: any[]) => T;
// biome-ignore lint/suspicious/noExplicitAny: mixin base accepts any Konva node constructor.
type NodeCtor = abstract new (...args: any[]) => Konva.Node;

/**
 * Give a Konva node class the smoove sizing API. Overrides `setWidth` /
 * `getWidth` (and height), which every Konva path goes through: `width(v)`,
 * `setAttrs({ width })` and the constructor config.
 *
 * These run during `super()` in a subclass constructor, before its fields
 * exist, so they touch only `this.attrs` and module state.
 */
export function Sized<B extends NodeCtor>(Base: B): B & MixinCtor<SizedApi> {
  const base = Base.prototype as unknown as {
    setWidth(px: number): void;
    getWidth(): number;
    setHeight(px: number): void;
    getHeight(): number;
  };

  abstract class SizedNode extends Base {
    setWidth(v: SizeInput): this {
      const d = normalize(v);
      this._setAttr(DECLARED_WIDTH, d);
      if (typeof d === "number") base.setWidth.call(this, d);
      return this;
    }

    getWidth(): number {
      flushLayout(this);
      return base.getWidth.call(this);
    }

    setHeight(v: SizeInput): this {
      const d = normalize(v);
      this._setAttr(DECLARED_HEIGHT, d);
      if (typeof d === "number") base.setHeight.call(this, d);
      return this;
    }

    getHeight(): number {
      flushLayout(this);
      return base.getHeight.call(this);
    }

    /** @internal Write the laid-out width, leaving the declared size alone. */
    _kmBoxWidth(px: number): void {
      base.setWidth.call(this, px);
    }

    /** @internal Write the laid-out height, leaving the declared size alone. */
    _kmBoxHeight(px: number): void {
      base.setHeight.call(this, px);
    }
  }
  return SizedNode as unknown as B & MixinCtor<SizedApi>;
}

install();
