import type { Presentation } from "../types.js";

/**
 * Opacity cross-dissolve. Both layers fade simultaneously: at `progress = 0.5`
 * the incoming and outgoing layers are each at 0.5 opacity. (Remotion's default
 * keeps the exiting scene fully opaque; we cross-fade so the midpoint is a true
 * 50/50 blend.)
 */
export function fade(): Presentation {
  return {
    enter(layer, progress) {
      layer.opacity(progress);
    },
    exit(layer, progress) {
      layer.opacity(1 - progress);
    },
  };
}
