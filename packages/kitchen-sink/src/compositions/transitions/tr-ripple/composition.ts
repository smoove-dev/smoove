import { ripple } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";
import { defaults, type RippleProps } from "./schema.js";

export default transitionComp<RippleProps>("tr-ripple", defaults, (p) =>
  ripple({ amplitude: p.amplitude, speed: p.speed }),
);
