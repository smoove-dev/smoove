import { ripple } from "@konva-motion/transitions";
import { transitionComp } from "../_shared.js";
import { type RippleProps, defaults } from "./schema.js";

export default transitionComp<RippleProps>("tr-ripple", defaults, (p) =>
  ripple({ amplitude: p.amplitude, speed: p.speed }),
);
