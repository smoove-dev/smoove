import { linearBlur } from "@konva-motion/transitions";
import { transitionComp } from "../_shared.js";
import { type LinearBlurProps, defaults } from "./schema.js";

export default transitionComp<LinearBlurProps>("tr-linear-blur", defaults, (p) =>
  linearBlur({ intensity: p.intensity }),
);
