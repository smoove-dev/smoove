import Konva from "konva";

/**
 * Global scene-graph **structure version** — a monotonic counter bumped on
 * every `add`, `remove`, and `destroy` anywhere in any Konva tree. Caches that
 * derive from tree shape (a timeline's tickable list, `query()` results) store
 * the version they were computed at and recompute only when it moved.
 *
 * A single global counter (rather than per-stage bookkeeping) trades a little
 * over-invalidation for a lot of simplicity: structural changes are rare next
 * to frame ticks, a spurious recompute is just one `find()`, and a global
 * counter needs no stage lookups on the hot path — a cache hit is one Map get
 * and one number compare. Detached subtrees are handled for free: mounting one
 * is itself an `add`, which bumps the version.
 *
 * The counter is fed by a small, idempotent patch of Konva's structural
 * mutators, installed once at module load. Only smoove containers overriding
 * `add`/`remove` was considered and rejected: one raw `Konva.Group` mid-tree
 * would silently serve stale caches.
 */

let version = 1;

/** The current structure version. Compare, don't interpret. */
export function structureVersion(): number {
  return version;
}

/** @internal test hook + escape hatch for exotic mutations Konva can't see. */
export function bumpStructureVersion(): void {
  version += 1;
}

type Structural = {
  __kmStructurePatched?: boolean;
};

function install(): void {
  const containerProto = Konva.Container.prototype as Konva.Container & Structural;
  if (containerProto.__kmStructurePatched) return;
  containerProto.__kmStructurePatched = true;

  const origAdd = containerProto.add;
  containerProto.add = function patchedAdd(this: Konva.Container, ...children) {
    const out = origAdd.apply(this, children);
    version += 1;
    return out;
  } as typeof origAdd;

  const nodeProto = Konva.Node.prototype;
  const origRemove = nodeProto.remove;
  nodeProto.remove = function patchedRemove(this: Konva.Node) {
    version += 1;
    return origRemove.apply(this);
  } as typeof origRemove;

  const origDestroy = nodeProto.destroy;
  nodeProto.destroy = function patchedDestroy(this: Konva.Node) {
    version += 1;
    return origDestroy.apply(this);
  } as typeof origDestroy;
}

install();
