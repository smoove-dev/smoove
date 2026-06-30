import { flip } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";
import { type FlipProps, defaults } from "./schema.js";

export default transitionComp<FlipProps>("tr-flip", defaults, (p) =>
  flip({ direction: p.direction }),
);
