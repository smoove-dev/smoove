import { wipe } from "@konva-motion/transitions";
import { transitionComp } from "../_shared.js";
import { type WipeProps, defaults } from "./schema.js";

export default transitionComp<WipeProps>("tr-wipe", defaults, (p) =>
  wipe({ direction: p.direction }),
);
