import Konva from "konva";

/**
 * Content-version tracking for effected nodes (nodes/Sequences with
 * `effects: [...]`). The effect pipeline skips the expensive capture → upload →
 * shader → readback chain when a node's captured content cannot have changed
 * since the last frame (see `apply.ts`).
 *
 * A node's version bumps on any attr/tree mutation inside its subtree, with
 * one deliberate exception: `x`/`y` writes on the effected node itself (or on
 * a node the effected node sits *under*) are pure translations — the captured
 * pixels are position-independent because the capture region follows
 * `getClientRect()`. Without this carve-out the extremely common
 * "static content, animated position" case would never cache-hit.
 *
 * Wiring is one prototype patch on `Konva.Node._fireChangeEvent` (plus
 * add/remove/destroy), installed lazily the first time a node with effects is
 * seen, so effect-free apps never pay for it.
 */

const versions = new WeakMap<Konva.Node, number>();
const effected = new WeakSet<Konva.Node>();
/** Iterable mirror of {@link effected} for descendant invalidation (weak, pruned on read). */
const effectedRefs = new Set<WeakRef<Konva.Node>>();

export function getContentVersion(node: Konva.Node): number {
  return versions.get(node) ?? 0;
}

function bump(node: Konva.Node): void {
  versions.set(node, (versions.get(node) ?? 0) + 1);
}

/** Translation-only attrs: safe for the effected node itself and for its ancestors. */
function isTranslation(attr: string): boolean {
  return attr === "x" || attr === "y";
}

/** Invalidate for a mutation observed at `origin` (an attr change or child add/remove). */
export function invalidateEffected(origin: Konva.Node, attr?: string): void {
  const translation = attr !== undefined && isTranslation(attr);
  // Effected ancestors (including origin itself): a descendant mutation always
  // changes their captured content; a mutation *on the effected node itself*
  // that is a pure translation does not.
  let n: Konva.Node | null = origin;
  while (n) {
    if (effected.has(n) && !(translation && n === origin)) bump(n);
    n = n.getParent() as Konva.Node | null;
  }
  // Effected descendants: an ancestor translation moves the whole subtree
  // (regions follow), anything else (scale, rotation, clip, visibility…)
  // changes their captured pixels.
  if (translation || !(origin as Konva.Container).getChildren) return;
  for (const ref of effectedRefs) {
    const e = ref.deref();
    if (!e) {
      effectedRefs.delete(ref);
      continue;
    }
    if (e !== origin && (origin as Konva.Container).isAncestorOf(e)) bump(e);
  }
}

let patched = false;

function patchKonva(): void {
  if (patched) return;
  patched = true;

  type FireChange = (attr: string, oldVal: unknown, newVal: unknown) => void;
  const nodeProto = Konva.Node.prototype as unknown as { _fireChangeEvent: FireChange };
  const origFire = nodeProto._fireChangeEvent;
  nodeProto._fireChangeEvent = function (this: Konva.Node, attr, oldVal, newVal) {
    invalidateEffected(this, attr);
    origFire.call(this, attr, oldVal, newVal);
  };

  const containerProto = Konva.Container.prototype;
  const origAdd = containerProto.add;
  containerProto.add = function (this: Konva.Container, ...children) {
    invalidateEffected(this);
    return origAdd.apply(this, children) as ReturnType<typeof origAdd>;
  };

  const origRemove = Konva.Node.prototype.remove;
  Konva.Node.prototype.remove = function (this: Konva.Node) {
    const parent = this.getParent() as Konva.Node | null;
    if (parent) invalidateEffected(parent);
    return origRemove.call(this);
  };
}

/** Register a node whose `effects` chain wants content versioning. */
export function trackEffected(node: Konva.Node): void {
  if (effected.has(node)) return;
  patchKonva();
  effected.add(node);
  effectedRefs.add(new WeakRef(node));
}

/** Stop tracking (effects removed). The version map entry stays — it's weak. */
export function untrackEffected(node: Konva.Node): void {
  effected.delete(node);
  for (const ref of effectedRefs) {
    const e = ref.deref();
    if (!e || e === node) effectedRefs.delete(ref);
  }
}
