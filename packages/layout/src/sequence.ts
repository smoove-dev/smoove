import type { Sequence } from "@konva-motion/core";
import type { FlexGroup } from "./flex-group.js";

export function bindLayout(sequence: Sequence, group: FlexGroup): () => void {
  return sequence.register(() => group.computeLayout());
}
