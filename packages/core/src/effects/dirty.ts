import Konva from "konva";
import type { GlUniforms } from "../gl/types.js";

const VERSION = Symbol("smoove.fx.contentVersion");

type Tracked = Konva.Node & { [VERSION]?: number };

/**
 * Nodes whose content version is being tracked — i.e. nodes that own an effect
 * chain. Kept as a set so the change hooks can early-exit for the overwhelmingly
 * common case of a scene with no effects at all.
 */
const tracked = new Set<Konva.Node>();

let patched = false;

/**
 * Bump every tracked node on `node`'s ancestor-or-self chain.
 *
 * The walk is why the hooks are global rather than per-instance: Konva fires
 * `_fireChangeEvent` only on the node that changed, and `_remove` lives on
 * `Node.prototype` (removal is child-initiated), so a parent can never observe
 * its own subtree by patching itself. Walking up from the changed node instead
 * keeps per-node versions accurate — which matters, because a single global
 * epoch would invalidate a static burning title's cached distance field every
 * time anything else in the composition animated.
 */
let derivedDepth = 0;

/**
 * Run `fn` with content-version bumps suppressed, for writes that are *derived*
 * from state rather than new content.
 *
 * Two callers need this, and without it nothing that uses layout can ever hit a
 * cache. The flex pass re-writes children's sizes every tick, and drawing a
 * `Block` re-writes its private background fill, so a card invalidated itself
 * eight times per frame and rebuilt its distance field from scratch on every
 * frame.
 *
 * Suppressing is safe because anything that genuinely changes the picture is
 * itself an attribute write that bumps before these run: an updater setting
 * `gap` bumps, then the layout it triggers is suppressed, so the net effect is
 * one bump. When nothing changed, nothing bumps and the cache holds.
 */
export function withDerivedWrites<T>(fn: () => T): T {
  derivedDepth++;
  try {
    return fn();
  } finally {
    derivedDepth--;
  }
}

/** Whether the current write runs inside {@link withDerivedWrites}. */
export function isDerivedWrite(): boolean {
  return derivedDepth > 0;
}

function bumpAncestors(node: Konva.Node): void {
  if (derivedDepth > 0) return;
  if (tracked.size === 0) return;
  let current: Konva.Node | null = node;
  while (current) {
    if (tracked.has(current)) bumpContentVersion(current);
    current = current.getParent() as Konva.Node | null;
  }
}

/**
 * Install the change hooks on Konva's prototypes. Called once, lazily, the
 * first time any node is tracked, so a composition with no effects never pays
 * for them.
 */
function installHooks(): void {
  if (patched) return;
  patched = true;

  const nodeProto = Konva.Node.prototype as unknown as {
    _fireChangeEvent: (attr: string, oldVal: unknown, newVal: unknown) => void;
    _remove: () => void;
  };
  const containerProto = Konva.Container.prototype as unknown as {
    add: (...children: Konva.Node[]) => unknown;
  };

  const fireChangeEvent = nodeProto._fireChangeEvent;
  nodeProto._fireChangeEvent = function (attr, oldVal, newVal) {
    if (!isTranslationOnly(attr)) bumpAncestors(this as unknown as Konva.Node);
    return fireChangeEvent.call(this, attr, oldVal, newVal);
  };

  const add = containerProto.add;
  containerProto.add = function (...children: Konva.Node[]) {
    bumpAncestors(this as unknown as Konva.Node);
    return add.apply(this, children);
  };

  // Child-initiated: bump before detaching, while the parent chain is intact.
  const remove = nodeProto._remove;
  nodeProto._remove = function () {
    bumpAncestors(this as unknown as Konva.Node);
    return remove.call(this);
  };
}

/**
 * Monotonic content version for `node`: the signal an effect chain uses to
 * decide whether its cached capture and anything derived from it (a distance
 * field, a pooled bitmap) are still valid.
 *
 * Reading a node's version starts tracking it. Bumped by any non-translation
 * attribute change, child add, or child removal anywhere in its subtree.
 */
export function contentVersion(node: Konva.Node): number {
  if (!tracked.has(node)) {
    installHooks();
    tracked.add(node);
  }
  return (node as Tracked)[VERSION] ?? 0;
}

/** Read `node`'s version without starting to track it. */
export function peekContentVersion(node: Konva.Node): number {
  return (node as Tracked)[VERSION] ?? 0;
}

export function bumpContentVersion(node: Konva.Node): void {
  const n = node as Tracked;
  n[VERSION] = (n[VERSION] ?? 0) + 1;
}

/** Stop tracking `node`. Its stored version is left alone. */
export function untrackNode(node: Konva.Node): void {
  tracked.delete(node);
}

/**
 * Attributes that move a node without changing its pixels. A write to one of
 * these does not invalidate a cached capture: the pipeline re-blits the cached
 * output at the new position instead, so a static burning title sliding across
 * frame never rebuilds its distance field.
 *
 * Rotation and scale are deliberately excluded — they change the rasterization.
 */
export function isTranslationOnly(attr: string): boolean {
  return attr === "x" || attr === "y";
}

/**
 * Order-independent, stable string key for a param set. Used to detect that an
 * effect chain's params are unchanged since the last frame.
 *
 * Keys and values are length-delimited so `{a: 1, b: 2}` cannot collide with
 * `{ab: 1, "": 2}`.
 */
export function fingerprint(params: Readonly<Record<string, unknown>> | GlUniforms): string {
  const keys = Object.keys(params).sort();
  let out = "";
  for (const k of keys) {
    const v = (params as Record<string, unknown>)[k];
    const s = Array.isArray(v) ? v.join(",") : String(v);
    out += `${k.length}:${k}=${s.length}:${s};`;
  }
  return out;
}
