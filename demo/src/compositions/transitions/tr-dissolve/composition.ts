import { dissolve } from "@konva-motion/transitions";
import { transitionComp } from "../_shared.js";
import { type DissolveProps, defaults } from "./schema.js";

export default transitionComp<DissolveProps>("tr-dissolve", defaults, (p) =>
  dissolve({
    lineWidth: p.lineWidth,
    spreadColor: p.spreadColor,
    hotColor: p.hotColor,
    pow: p.pow,
    intensity: p.intensity,
  }),
);
