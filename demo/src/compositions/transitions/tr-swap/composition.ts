import { swap } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";
import { type SwapProps, defaults } from "./schema.js";

export default transitionComp<SwapProps>("tr-swap", defaults, (p) =>
  swap({ reflection: p.reflection, perspective: p.perspective, depth: p.depth }),
);
