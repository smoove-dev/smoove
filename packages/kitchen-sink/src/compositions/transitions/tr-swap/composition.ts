import { swap } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";
import { defaults, type SwapProps } from "./schema.js";

export default transitionComp<SwapProps>("tr-swap", defaults, (p) =>
  swap({ reflection: p.reflection, perspective: p.perspective, depth: p.depth }),
);
