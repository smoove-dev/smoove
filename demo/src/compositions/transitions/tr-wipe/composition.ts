import { wipe } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";
import { defaults, type WipeProps } from "./schema.js";

export default transitionComp<WipeProps>("tr-wipe", defaults, (p) =>
  wipe({ direction: p.direction }),
);
